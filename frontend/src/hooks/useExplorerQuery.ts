import { useCallback, useEffect, useState } from 'react';
import { isAbort } from '../api/client';

export interface QueryState<T> {
  /** Last successful result; kept while a newer request is in flight. */
  data: T | null;
  /** True only before the first result (show skeletons). */
  initialLoading: boolean;
  /** True while refetching with previous data still shown. */
  refreshing: boolean;
  error: unknown;
  retry: () => void;
}

/**
 * Runs `load` whenever `key` changes. The previous request is aborted, so a
 * slow, obsolete response can never overwrite newer results.
 */
export function useExplorerQuery<T>(key: string, load: (signal: AbortSignal) => Promise<T>): QueryState<T> {
  const [data, setData] = useState<T | null>(null);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setPending(true);
    load(controller.signal)
      .then((result) => {
        setData(result);
        setError(null);
        setPending(false);
      })
      .catch((reason: unknown) => {
        if (isAbort(reason)) return;
        setError(reason);
        setPending(false);
      });
    return () => controller.abort();
    // `load` is recreated each render; `key` captures everything it depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return {
    data,
    initialLoading: pending && data === null,
    refreshing: pending && data !== null,
    error: pending ? null : error,
    retry,
  };
}
