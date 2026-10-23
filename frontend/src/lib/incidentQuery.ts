import { SEVERITIES, STATUSES, type FilterOperator, type Incident } from '../api/types';
import { formatDate, SEVERITY_LABEL, STATUS_LABEL } from './format';

/**
 * Explorer URL parameters use the API's own names (q, page, page_size, sort,
 * order, filter.<field>.<op>), so the URL is the query. The drawer's
 * `incident` param is the only extra key.
 */

export type FilterKind = 'enum' | 'id' | 'timestamp';

export interface FilterField {
  key: keyof Incident;
  label: string;
  kind: FilterKind;
  operators: FilterOperator[];
  values?: readonly string[];
  valueLabels?: Record<string, string>;
}

// Matches the Incident entry in docs/contract/examples/table-catalog.json.
export const INCIDENT_FILTER_FIELDS: FilterField[] = [
  { key: 'severity', label: 'Severity', kind: 'enum', operators: ['eq', 'ne'], values: SEVERITIES, valueLabels: SEVERITY_LABEL },
  { key: 'status', label: 'Status', kind: 'enum', operators: ['eq', 'ne'], values: STATUSES, valueLabels: STATUS_LABEL },
  { key: 'detected_at', label: 'Detected', kind: 'timestamp', operators: ['gte', 'lt'] },
  { key: 'resolved_at', label: 'Resolved', kind: 'timestamp', operators: ['gte', 'lt'] },
  { key: 'incident_id', label: 'Incident ID', kind: 'id', operators: ['eq'] },
  { key: 'employee_id', label: 'Reporter ID', kind: 'id', operators: ['eq'] },
  { key: 'threat_actor_id', label: 'Threat actor ID', kind: 'id', operators: ['eq'] },
];

export const INCIDENT_SORTS = ['incident_id', 'title', 'severity', 'status', 'detected_at', 'resolved_at'] as const;
export const DEFAULT_SORT = 'detected_at';
export const DEFAULT_ORDER = 'desc';
export const PAGE_SIZES = [10, 25, 50] as const;
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_FILTERS = 8;

export function operatorLabel(field: FilterField, op: FilterOperator): string {
  if (field.kind === 'timestamp') return op === 'gte' ? 'on or after' : 'on or before';
  return op === 'ne' ? 'is not' : 'is';
}

export interface ActiveFilter {
  param: string;
  field: FilterField;
  op: FilterOperator;
  value: string;
}

export function readFilters(params: URLSearchParams): ActiveFilter[] {
  const filters: ActiveFilter[] = [];
  for (const [param, value] of params) {
    const [prefix, key, op] = param.split('.');
    if (prefix !== 'filter') continue;
    const field = INCIDENT_FILTER_FIELDS.find((f) => f.key === key);
    if (!field || !field.operators.includes(op as FilterOperator)) continue;
    filters.push({ param, field, op: op as FilterOperator, value });
  }
  return filters;
}

/**
 * "On or before <day>" is stored as `lt` the start of the following local day
 * (exclusive), so the label shows the day before the stored instant.
 */
export function describeFilter({ field, op, value }: ActiveFilter): string {
  let shown = value;
  if (field.kind === 'enum') shown = field.valueLabels?.[value] ?? value;
  if (field.kind === 'timestamp') {
    const time = Date.parse(value);
    shown = Number.isNaN(time) ? value : formatDate(new Date(op === 'lt' ? time - 1 : time));
  }
  return `${field.label} ${operatorLabel(field, op)} ${shown}`;
}

export function hasQueryConstraints(params: URLSearchParams): boolean {
  return Boolean(params.get('q')) || readFilters(params).length > 0;
}

/** Client-side mirror of the server predicates, used only to explain where a saved record went. */
export function matchesQuery(incident: Incident, params: URLSearchParams): boolean {
  const q = params.get('q');
  if (q && !incident.title.toLowerCase().includes(q.toLowerCase())) return false;
  return readFilters(params).every(({ field, op, value }) => {
    const actual = incident[field.key];
    if (actual === null || actual === undefined) return false;
    if (field.kind === 'enum') return op === 'eq' ? actual === value : actual !== value;
    if (field.kind === 'id') return actual === Number(value);
    const time = Date.parse(String(actual));
    return op === 'gte' ? time >= Date.parse(value) : time < Date.parse(value);
  });
}

/** Build the API query from URL params, dropping anything the API would not accept. */
export function apiQueryFromParams(params: URLSearchParams): Record<string, string> {
  const query: Record<string, string> = {};
  const sort = params.get('sort');
  query.sort = sort && (INCIDENT_SORTS as readonly string[]).includes(sort) ? sort : DEFAULT_SORT;
  const order = params.get('order');
  query.order = order === 'asc' || order === 'desc' ? order : DEFAULT_ORDER;
  const page = Number(params.get('page'));
  query.page = String(Number.isInteger(page) && page >= 1 ? page : 1);
  const size = Number(params.get('page_size'));
  query.page_size = String((PAGE_SIZES as readonly number[]).includes(size) ? size : DEFAULT_PAGE_SIZE);
  const q = params.get('q')?.slice(0, 100);
  if (q) query.q = q;
  for (const filter of readFilters(params).slice(0, MAX_FILTERS)) query[filter.param] = filter.value;
  return query;
}
