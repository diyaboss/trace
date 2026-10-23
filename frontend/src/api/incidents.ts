import { request, toQuery } from './client';
import type { Incident, IncidentInput, ListResponse } from './types';

export type IncidentQuery = Record<string, string | number | undefined>;

export function listIncidents(query: IncidentQuery, signal?: AbortSignal) {
  return request<ListResponse<Incident>>('GET', `/incidents${toQuery(query)}`, { signal });
}

export async function getIncident(id: number, signal?: AbortSignal) {
  const body = await request<{ data: Incident }>('GET', `/incidents/${id}`, { signal });
  return body.data;
}

export async function addIncident(input: IncidentInput) {
  const body = await request<{ data: Incident }>('POST', '/incidents', { body: input });
  return body.data;
}

export async function updateIncident(id: number, input: IncidentInput) {
  const body = await request<{ data: Incident }>('PUT', `/incidents/${id}`, { body: input });
  return body.data;
}

/** Resolves on 204. Rejects with ApiError 404 or 409 (DEPENDENT_RECORDS). */
export function deleteIncident(id: number) {
  return request<void>('DELETE', `/incidents/${id}`);
}

export function checkHealth(signal?: AbortSignal) {
  return request<{ status: string; database: string }>('GET', '/health', { signal });
}
