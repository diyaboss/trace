/**
 * DEVELOPMENT FIXTURES — enabled only by `npm run dev:fixtures` (vite --mode fixtures).
 *
 * An in-memory stand-in for the Java API that follows docs/contract/api-v1.md:
 * the same routes, envelopes, status codes, validation rules, and query rules.
 * Data mirrors database/002_core_seed.sql and resets when the dev server restarts
 * (or on POST /__fixtures/reset, used by Playwright).
 *
 * It is a Vite dev-server plugin, so it can never be bundled into the production
 * build, and the real proxy is not configured while it is active: there is no
 * path by which a failed real API call silently falls back to this data.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

type Row = Record<string, unknown>;
interface Column {
  key: string;
  type: string;
  sortable: boolean;
  searchable: boolean;
  filter_operators: string[];
  values?: string[];
}
interface Table {
  name: string;
  primary_key: string[];
  default_sort: string;
  default_order: string;
  columns: Column[];
}

const catalogPath = fileURLToPath(new URL('../../docs/contract/examples/table-catalog.json', import.meta.url));
const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const STATUSES = ['OPEN', 'INVESTIGATING', 'CONTAINED', 'RESOLVED'];
const WRITABLE = ['title', 'description', 'severity', 'status', 'detected_at', 'resolved_at', 'employee_id', 'threat_actor_id'];
const MAX_ID = 9_999_999_999;

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields: Record<string, string> = {},
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}
const queryError = (message: string) => new HttpError(400, 'INVALID_QUERY', message);

function seed() {
  const departments: Row[] = [
    { department_id: 1, department_name: 'IT Operations' },
    { department_id: 2, department_name: 'Finance' },
    { department_id: 3, department_name: 'People Operations' },
  ];
  const employees: Row[] = [
    [1, 'Maya', 'Sen', 'Systems engineer', 1],
    [2, 'Rohan', 'Mehta', 'IT coordinator', 1],
    [3, 'Leena', 'Shah', 'Accountant', 2],
    [4, 'Kabir', 'Das', 'Finance associate', 2],
    [5, 'Nisha', 'Kapoor', 'People partner', 3],
    [6, 'Arjun', 'Iyer', 'Support specialist', 1],
    [7, 'Aditi', 'Rao', 'Finance analyst', 2],
    [8, 'Ishaan', 'Roy', 'HR associate', 3],
  ].map(([id, first, last, designation, dept]) => ({
    employee_id: id,
    first_name: first,
    last_name: last,
    email: `${String(first).toLowerCase()}.${String(last).toLowerCase()}@example.test`,
    designation,
    department_id: dept,
  }));
  const actors: Row[] = [
    { threat_actor_id: 1, actor_name: 'Synthetic actor Alpha', actor_type: 'External', suspected_origin: null },
    { threat_actor_id: 2, actor_name: 'Synthetic actor Beta', actor_type: 'Unknown', suspected_origin: null },
    { threat_actor_id: 3, actor_name: 'Unreferenced demonstration actor', actor_type: null, suspected_origin: null },
  ];
  const titles = [
    'Suspicious access to finance workstation', 'Unexpected outbound traffic',
    'Repeated failed authentication', 'Unapproved software installation',
    'Phishing message reported', 'Endpoint isolation required',
    'Sensitive document sharing alert', 'Unexpected privileged account activity',
    "Employee's workstation reported 100% CPU", 'Unrecognized scheduled task',
    'Suspicious archive detected', 'Legacy access token revoked',
  ];
  const levels = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'HIGH', 'CRITICAL', 'MEDIUM', 'HIGH', 'LOW', 'MEDIUM', 'HIGH', 'LOW'];
  const states = ['INVESTIGATING', 'OPEN', 'CONTAINED', 'OPEN', 'RESOLVED', 'CONTAINED', 'OPEN', 'INVESTIGATING', 'RESOLVED', 'OPEN', 'RESOLVED', 'RESOLVED'];
  const now = Date.now();
  const incidents: Row[] = titles.map((title, index) => {
    const n = index + 1;
    const detected = new Date(now - (13 - n) * 86_400_000);
    detected.setMilliseconds(0);
    return {
      incident_id: 100 + n,
      title,
      description: 'Synthetic training incident. Review the report and record the investigation outcome.',
      severity: levels[index],
      status: states[index],
      detected_at: detected.toISOString(),
      resolved_at: states[index] === 'RESOLVED' ? new Date(detected.getTime() + 7_200_000).toISOString() : null,
      employee_id: n === 1 ? 7 : ((n - 1) % 7) + 1,
      threat_actor_id: n % 3 === 0 ? 1 : n % 4 === 0 ? 2 : null,
    };
  });
  return { departments, employees, actors, incidents, nextId: 1000 };
}

let db = seed();

function joinedIncident(row: Row): Row {
  const employee = db.employees.find((e) => e.employee_id === row.employee_id)!;
  const department = db.departments.find((d) => d.department_id === employee.department_id)!;
  const actor = db.actors.find((a) => a.threat_actor_id === row.threat_actor_id);
  return {
    incident_id: row.incident_id,
    title: row.title,
    description: row.description,
    severity: row.severity,
    status: row.status,
    detected_at: row.detected_at,
    resolved_at: row.resolved_at,
    employee_id: row.employee_id,
    reporter_name: `${employee.first_name} ${employee.last_name}`,
    department_id: department.department_id,
    department_name: department.department_name,
    threat_actor_id: row.threat_actor_id,
    threat_actor_name: actor ? actor.actor_name : null,
  };
}

function tableRows(name: string): Row[] {
  switch (name) {
    case 'INCIDENT': return db.incidents.map(joinedIncident);
    case 'DEPARTMENT': return db.departments;
    case 'EMPLOYEE': return db.employees;
    case 'THREAT_ACTOR': return db.actors;
    default: return [];
  }
}

function parseId(value: string): number {
  if (!/^[0-9]{1,10}$/.test(value)) throw queryError('Use a positive integer ID.');
  const id = Number(value);
  if (id < 1 || id > MAX_ID) throw queryError('Use a positive integer ID.');
  return id;
}

/** ISO 8601 with an explicit offset, as the Java parser requires. */
function parseTimestamp(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

const SEVERITY_RANK: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

function query(table: Table, params: URLSearchParams) {
  const values = new Map<string, string>();
  for (const key of new Set(params.keys())) {
    const all = params.getAll(key);
    if (all.length !== 1) throw queryError(`Duplicate query parameter: ${key}`);
    values.set(key, all[0]);
  }
  const integer = (key: string, fallback: string, max: number) => {
    const raw = values.get(key) ?? fallback;
    const number = /^[0-9]+$/.test(raw) ? Number(raw) : NaN;
    if (!(number >= 1 && number <= max)) throw queryError(`${key} must be an integer between 1 and ${max}.`);
    return number;
  };
  const page = integer('page', '1', 2_147_483_647);
  const pageSize = integer('page_size', '25', 50);
  const sort = values.get('sort') ?? table.default_sort;
  const sortColumn = table.columns.find((c) => c.key === sort);
  if (!sortColumn) throw queryError(`Unsupported column: ${sort}`);
  if (!sortColumn.sortable) throw queryError('This column cannot be sorted.');
  const order = values.get('order') ?? table.default_order;
  if (order !== 'asc' && order !== 'desc') throw queryError('Order must be asc or desc.');

  const predicates: ((row: Row) => boolean)[] = [];
  let filters = 0;
  for (const [key, value] of values) {
    if (['page', 'page_size', 'sort', 'order'].includes(key)) continue;
    if (key === 'q') {
      if ([...value].length > 100) throw queryError('Search must contain at most 100 characters.');
      if (value) {
        const needle = value.toLowerCase();
        const searchable = table.columns.filter((c) => c.searchable).map((c) => c.key);
        predicates.push((row) => searchable.some((k) => String(row[k] ?? '').toLowerCase().includes(needle)));
      }
      continue;
    }
    const parts = key.split('.');
    if (parts.length !== 3 || parts[0] !== 'filter') throw queryError(`Unsupported query parameter: ${key}`);
    if (++filters > 8) throw queryError('Use at most eight filter terms.');
    const column = table.columns.find((c) => c.key === parts[1]);
    if (!column) throw queryError(`Unsupported column: ${parts[1]}`);
    const op = parts[2];
    if (!column.filter_operators.includes(op)) throw queryError(`Unsupported filter operator for ${column.key}`);
    let target: unknown;
    if (column.type === 'integer') target = parseId(value);
    else if (column.type === 'timestamp') {
      target = parseTimestamp(value);
      if (target === null) throw queryError('Use an ISO filter timestamp with an explicit timezone.');
    } else if (column.type === 'enum') {
      if (!column.values?.includes(value)) throw queryError('Invalid enum filter value.');
      target = value;
    } else throw queryError('Unsupported filter type.');
    const read = (row: Row) => (column.type === 'timestamp' && row[column.key] ? Date.parse(String(row[column.key])) : row[column.key]);
    predicates.push((row) => {
      const actual = read(row);
      if (actual === null || actual === undefined) return false; // SQL comparison with NULL
      if (op === 'eq') return actual === target;
      if (op === 'ne') return actual !== target;
      if (op === 'gte') return (actual as number) >= (target as number);
      return (actual as number) < (target as number);
    });
  }

  const rows = tableRows(table.name).filter((row) => predicates.every((p) => p(row)));
  const pk = table.primary_key[0];
  const direction = order === 'asc' ? 1 : -1;
  const compare = (a: unknown, b: unknown) => {
    if (a === b) return 0;
    if (a === null || a === undefined) return 1; // NULLS LAST in either direction
    if (b === null || b === undefined) return -1;
    if (typeof a === 'number' && typeof b === 'number') return (a - b) * direction;
    return String(a) < String(b) ? -direction : direction;
  };
  rows.sort((a, b) => {
    if (table.name === 'INCIDENT' && sort === 'severity') {
      return (
        (SEVERITY_RANK[String(a.severity)] - SEVERITY_RANK[String(b.severity)]) * direction ||
        Date.parse(String(b.detected_at)) - Date.parse(String(a.detected_at)) ||
        (b.incident_id as number) - (a.incident_id as number)
      );
    }
    const primary = compare(a[sort], b[sort]);
    if (primary !== 0 || sort === pk) return primary;
    return ((a[pk] as number) - (b[pk] as number)) * direction;
  });
  const start = (page - 1) * pageSize;
  return { data: rows.slice(start, start + pageSize), pagination: { page, page_size: pageSize, total: rows.length } };
}

function parseInput(body: unknown) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new HttpError(400, 'INVALID_REQUEST', 'Send a JSON object.');
  const node = body as Row;
  for (const key of Object.keys(node)) {
    if (!WRITABLE.includes(key)) throw new HttpError(400, 'INVALID_REQUEST', `Unsupported input field: ${key}`);
  }
  const errors: Record<string, string> = {};
  for (const key of WRITABLE) if (!(key in node)) errors[key] = 'Include this field, using null when allowed.';
  const text = (key: string, nullable: boolean, max: number) => {
    const value = node[key];
    if (value === null || value === undefined) { if (!nullable) errors[key] = 'Enter a value.'; return null; }
    if (typeof value !== 'string') { errors[key] = 'Enter text.'; return null; }
    const result = value.trim();
    if (!result) { if (!nullable) errors[key] = 'Enter a value.'; return null; }
    if ([...result].length > max) errors[key] = `Use at most ${max} characters.`;
    return result;
  };
  const enumeration = (key: string, allowed: string[]) => {
    const value = node[key];
    if (typeof value !== 'string' || !allowed.includes(value)) { errors[key] = `Choose one of: ${allowed.join(', ')}`; return null; }
    return value;
  };
  const identifier = (key: string, nullable: boolean) => {
    const value = node[key];
    if (value === null && nullable) return null;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > MAX_ID) {
      errors[key] = 'Use a positive integer no greater than 9999999999.';
      return null;
    }
    return value;
  };
  const timestamp = (key: string, nullable: boolean) => {
    const value = node[key];
    if (value === null && nullable) return null;
    const time = typeof value === 'string' ? parseTimestamp(value) : null;
    if (time === null) { errors[key] = 'Use an ISO timestamp with an explicit timezone.'; return null; }
    return time;
  };
  const title = text('title', false, 160);
  const description = text('description', true, 10000);
  const severity = enumeration('severity', SEVERITIES);
  const status = enumeration('status', STATUSES);
  const detected = timestamp('detected_at', false);
  const resolved = timestamp('resolved_at', true);
  const employee = identifier('employee_id', false);
  const actor = identifier('threat_actor_id', true);
  if (status === 'RESOLVED' && resolved === null) errors.resolved_at = 'Enter a resolution timestamp for a resolved incident.';
  if (status !== null && status !== 'RESOLVED' && resolved !== null) errors.resolved_at = 'Only resolved incidents may have a resolution timestamp.';
  if (detected !== null && resolved !== null && resolved < detected) errors.resolved_at = 'Resolution time cannot be earlier than detection time.';
  if (Object.keys(errors).length) throw new HttpError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', errors);
  // Foreign keys, as Oracle would enforce them.
  if (!db.employees.some((e) => e.employee_id === employee)) {
    throw new HttpError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', { employee_id: 'Choose an existing reporting employee.' });
  }
  if (actor !== null && !db.actors.some((a) => a.threat_actor_id === actor)) {
    throw new HttpError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', { threat_actor_id: 'Choose an existing threat actor.' });
  }
  return {
    title, description, severity, status,
    detected_at: new Date(detected!).toISOString(),
    resolved_at: resolved === null ? null : new Date(resolved).toISOString(),
    employee_id: employee, threat_actor_id: actor,
  };
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function send(res: ServerResponse, status: number, body?: unknown, headers: Record<string, string> = {}) {
  res.statusCode = status;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Trace-Fixtures', 'true');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  if (body === undefined) return res.end();
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function handle(req: IncomingMessage, res: ServerResponse, catalog: Table[]) {
  const url = new URL(req.url ?? '/', 'http://fixtures.local');
  const path = url.pathname;
  const method = req.method ?? 'GET';
  const raw = await readBody(req);
  const noQuery = () => { if ([...url.searchParams.keys()].length) throw queryError('This endpoint does not accept query parameters.'); };
  if ((method === 'GET' || method === 'DELETE') && raw) throw new HttpError(400, 'INVALID_REQUEST', 'GET and DELETE requests do not accept a body.');
  const incidentTable = catalog.find((t) => t.name === 'INCIDENT')!;
  const json = () => {
    if (!(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
      throw new HttpError(400, 'INVALID_REQUEST', 'Use Content-Type: application/json.');
    }
    try { return JSON.parse(raw); } catch { throw new HttpError(400, 'INVALID_JSON', 'Send valid JSON with no duplicate keys or trailing content.'); }
  };

  if (path === '/api/health' && method === 'GET') { noQuery(); return send(res, 200, { status: 'ok', database: 'connected' }); }
  if (path === '/api/tables' && method === 'GET') { noQuery(); return send(res, 200, { data: catalog }); }
  const rowsMatch = path.match(/^\/api\/tables\/([^/]+)\/rows$/);
  if (rowsMatch && method === 'GET') {
    const table = catalog.find((t) => t.name === decodeURIComponent(rowsMatch[1]));
    if (!table) throw new HttpError(404, 'NOT_FOUND', 'Resource not found.');
    return send(res, 200, { table: table.name, ...query(table, url.searchParams) });
  }
  if (path === '/api/incidents') {
    if (method === 'GET') return send(res, 200, query(incidentTable, url.searchParams));
    if (method === 'POST') {
      noQuery();
      const input = parseInput(json());
      const row = { incident_id: db.nextId++, ...input };
      db.incidents.push(row);
      return send(res, 201, { data: joinedIncident(row) }, { Location: `/api/incidents/${row.incident_id}` });
    }
  }
  const idMatch = path.match(/^\/api\/incidents\/([^/]*)$/);
  if (idMatch) {
    const id = parseId(idMatch[1]);
    const index = db.incidents.findIndex((i) => i.incident_id === id);
    if (method === 'GET') {
      noQuery();
      if (index < 0) throw new HttpError(404, 'NOT_FOUND', 'Incident not found.');
      return send(res, 200, { data: joinedIncident(db.incidents[index]) });
    }
    if (method === 'PUT') {
      noQuery();
      const input = parseInput(json());
      if (index < 0) throw new HttpError(404, 'NOT_FOUND', 'Incident not found.');
      db.incidents[index] = { incident_id: id, ...input };
      return send(res, 200, { data: joinedIncident(db.incidents[index]) });
    }
    if (method === 'DELETE') {
      noQuery();
      if (index < 0) throw new HttpError(404, 'NOT_FOUND', 'Incident not found.');
      db.incidents.splice(index, 1);
      return send(res, 204);
    }
  }
  throw new HttpError(404, 'NOT_FOUND', 'Resource not found.');
}

export function fixtureApi(): Plugin {
  return {
    name: 'trace-fixture-api',
    apply: 'serve',
    configureServer(server) {
      const catalog = (JSON.parse(readFileSync(catalogPath, 'utf8')) as { data: Table[] }).data;
      server.config.logger.info('\n  Trace: DEVELOPMENT FIXTURES active — /api is served from memory, not Oracle.\n');
      server.middlewares.use('/__fixtures/reset', (req, res) => {
        if (req.method !== 'POST') return send(res, 405);
        db = seed();
        send(res, 204);
      });
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/') && req.url !== '/api') return next();
        handle(req, res, catalog).catch((error: unknown) => {
          if (error instanceof HttpError) {
            return send(res, error.status, {
              error: { code: error.code, message: error.message, field_errors: error.fields, details: error.details },
            });
          }
          send(res, 500, { error: { code: 'INTERNAL_ERROR', message: 'The server could not complete this operation.', field_errors: {}, details: {} } });
        });
      });
    },
  };
}
