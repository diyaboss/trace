// Types mirror docs/contract/api-v1.md exactly. Field names stay snake_case.

export const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export const STATUSES = ['OPEN', 'INVESTIGATING', 'CONTAINED', 'RESOLVED'] as const;

export type Severity = (typeof SEVERITIES)[number];
export type IncidentStatus = (typeof STATUSES)[number];

/** Returned by list, detail, create, and update. Joined labels are read-only. */
export interface Incident {
  incident_id: number;
  title: string;
  description: string | null;
  severity: Severity;
  status: IncidentStatus;
  detected_at: string;
  resolved_at: string | null;
  employee_id: number;
  reporter_name: string;
  department_id: number;
  department_name: string;
  threat_actor_id: number | null;
  threat_actor_name: string | null;
}

/** All eight writable keys are required on POST and PUT, including nullable ones. */
export interface IncidentInput {
  title: string;
  description: string | null;
  severity: Severity;
  status: IncidentStatus;
  detected_at: string;
  resolved_at: string | null;
  employee_id: number;
  threat_actor_id: number | null;
}

export interface Pagination {
  page: number;
  page_size: number;
  total: number;
}

export interface ListResponse<T> {
  data: T[];
  pagination: Pagination;
}

export interface TableRowsResponse<T = Record<string, unknown>> extends ListResponse<T> {
  table: string;
}

export type ColumnType = 'integer' | 'text' | 'enum' | 'timestamp' | 'date';
export type FilterOperator = 'eq' | 'ne' | 'gte' | 'lt';

export interface CatalogColumn {
  key: string;
  label: string;
  type: ColumnType;
  nullable: boolean;
  sortable: boolean;
  searchable: boolean;
  filter_operators: FilterOperator[];
  values?: string[];
}

export interface CatalogTable {
  name: string;
  label: string;
  kind: 'entity' | 'relationship' | 'view';
  primary_key: string[];
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
  default_sort: string;
  default_order: 'asc' | 'desc';
  columns: CatalogColumn[];
}

export interface Employee {
  employee_id: number;
  first_name: string;
  last_name: string;
  email: string;
  designation: string | null;
  department_id: number;
}

export interface ThreatActor {
  threat_actor_id: number;
  actor_name: string;
  actor_type: string | null;
  suspected_origin: string | null;
}

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    field_errors: Record<string, string>;
    details: Record<string, unknown>;
  };
}

export interface Dependency {
  table: string;
  count: number;
}
