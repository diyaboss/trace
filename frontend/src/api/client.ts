import type { ErrorEnvelope } from './types';

/**
 * kind:
 *  - "api":         the server answered with the shared error envelope.
 *  - "unreachable": no usable answer (connection refused, proxy error, non-JSON reply).
 */
export class ApiError extends Error {
  readonly kind: 'api' | 'unreachable';
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: Record<string, string>;
  readonly details: Record<string, unknown>;
  /** True for a write whose outcome is unknown: it may have reached the server. */
  readonly uncertain: boolean;

  constructor(init: {
    kind: 'api' | 'unreachable';
    status: number;
    code: string;
    message: string;
    fieldErrors?: Record<string, string>;
    details?: Record<string, unknown>;
    uncertain?: boolean;
  }) {
    super(init.message);
    this.name = 'ApiError';
    this.kind = init.kind;
    this.status = init.status;
    this.code = init.code;
    this.fieldErrors = init.fieldErrors ?? {};
    this.details = init.details ?? {};
    this.uncertain = init.uncertain ?? false;
  }
}

export function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

function isEnvelope(value: unknown): value is ErrorEnvelope {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false;
  const error = (value as { error: unknown }).error;
  return typeof error === 'object' && error !== null && 'code' in error && 'message' in error;
}

/**
 * The single place that talks HTTP. Relative /api URLs only.
 * Writes are never retried automatically.
 */
export async function request<T>(
  method: Method,
  path: string,
  options: { body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const isWrite = method !== 'GET';
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      signal: options.signal,
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch (error) {
    if (isAbort(error)) throw error;
    throw new ApiError({
      kind: 'unreachable',
      status: 0,
      code: 'NETWORK',
      message: 'Couldn’t reach the Trace API.',
      uncertain: isWrite,
    });
  }

  // 204 No Content (DELETE): never parse a body.
  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let json: unknown = undefined;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
  }

  if (response.ok) {
    if (json === undefined) {
      throw new ApiError({
        kind: 'unreachable',
        status: response.status,
        code: 'INVALID_RESPONSE',
        message: 'The server returned an unreadable response.',
        uncertain: isWrite,
      });
    }
    return json as T;
  }

  if (isEnvelope(json)) {
    throw new ApiError({
      kind: 'api',
      status: response.status,
      code: json.error.code,
      message: json.error.message,
      fieldErrors: json.error.field_errors ?? {},
      details: json.error.details ?? {},
    });
  }

  // No shared envelope: typically the dev proxy reporting that Java is not running.
  throw new ApiError({
    kind: 'unreachable',
    status: response.status,
    code: 'NO_ENVELOPE',
    message: 'Couldn’t reach the Trace API.',
    uncertain: isWrite,
  });
}

/** A short, user-facing sentence for any failure. */
export function describeError(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Something went wrong. Try again.';
  if (error.uncertain) {
    return 'The connection was lost before the server confirmed this change. Refresh and check the record before trying again.';
  }
  if (error.kind === 'unreachable') return 'Couldn’t reach the Trace API. Check that the Java server is running.';
  if (error.status === 503) return 'The database is unavailable. Check the Oracle connection and try again.';
  return error.message;
}

/** Builds a query string, omitting empty values. Keys are sent exactly as given. */
export function toQuery(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}
