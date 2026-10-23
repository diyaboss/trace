import { request, toQuery } from './client';
import type { CatalogTable, TableRowsResponse } from './types';

export async function getCatalog(signal?: AbortSignal) {
  const body = await request<{ data: CatalogTable[] }>('GET', '/tables', { signal });
  return body.data;
}

export function getTableRows<T = Record<string, unknown>>(
  table: string,
  query: Record<string, string | number | undefined>,
  signal?: AbortSignal,
) {
  return request<TableRowsResponse<T>>('GET', `/tables/${encodeURIComponent(table)}/rows${toQuery(query)}`, {
    signal,
  });
}
