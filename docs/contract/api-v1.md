# Trace API v1 — frozen initial contract

Local demo, single user, synthetic data. Codex owns this contract. The frontend consumes it without independently changing names or nullability.

Schema clarification from the user's follow-up: EMPLOYEE also returns nullable `designation`; THREAT_ACTOR also returns nullable `actor_type` and `suspected_origin`. These preserve the supplied conceptual attributes. They are display-only columns, with no new filters/search/sorts. All existing Incident fields and endpoint behavior stay as specified below. Full catalog example lists the four initial tables.

Transport limit: request bodies larger than 64 KiB return HTTP 413 using the shared error envelope. Paths without an agreed query contract reject query parameters. Writable ID values are integer JSON numbers in the NUMBER(10) range 1–9999999999. Timestamp response strings may omit zero fractional digits; all represent UTC ISO instants with millisecond database precision.


Freeze this contract before either agent begins implementation.

### Shared conventions

| Concern | Contract |
|---|---|
| Base path | `/api` |
| Format | JSON, UTF-8 |
| JSON naming | `snake_case`, matching database vocabulary |
| IDs | Positive JSON integers; database IDs constrained to `NUMBER(10)` |
| Timestamps | ISO 8601 with explicit timezone; responses normalized to UTC |
| Null values | JSON `null`, never `"null"` |
| Severity | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| Incident status | `OPEN`, `INVESTIGATING`, `CONTAINED`, `RESOLVED` |
| Pagination | One-based page numbers |
| Write behavior | Wait for server confirmation before reporting success |
| Unknown input fields | Reject rather than silently ignore |
| Empty optional text | Normalize to null |
| Required text | Trim and reject if empty |

### Initial endpoints

| Method | Route | Success |
|---|---|---|
| GET | `/api/health` | 200 |
| GET | `/api/incidents` | 200 |
| GET | `/api/incidents/{id}` | 200 |
| POST | `/api/incidents` | 201 |
| PUT | `/api/incidents/{id}` | 200 |
| DELETE | `/api/incidents/{id}` | 204 |
| GET | `/api/tables` | 200 |
| GET | `/api/tables/{table}/rows` | 200 |

No GET or DELETE endpoint accepts a request body.

### A. Health check

```http
GET /api/health
```

Execute:

```sql
SELECT 1 FROM DUAL
```

Response:

```json
{
  "status": "ok",
  "database": "connected"
}
```

If Oracle is unavailable, return 503 with the shared error structure.

Do not expose credentials, connection strings, or database server details.

### B. Incident object

The same object shape is returned by list, detail, create, and update:

```json
{
  "incident_id": 101,
  "title": "Suspicious access to finance workstation",
  "description": "Repeated access attempts were detected outside normal working hours.",
  "severity": "CRITICAL",
  "status": "OPEN",
  "detected_at": "2026-10-08T03:40:00.000Z",
  "resolved_at": null,
  "employee_id": 7,
  "reporter_name": "Aditi Rao",
  "department_id": 2,
  "department_name": "Finance",
  "threat_actor_id": null,
  "threat_actor_name": null
}
```

Joined labels are read-only. Department is derived through the reporting employee; it is not another writable Incident column.

### C. Get incidents

```http
GET /api/incidents?page=1&page_size=25&sort=detected_at&order=desc
```

Filtered example, shown without URL encoding for readability:

```http
GET /api/incidents?filter.severity.eq=CRITICAL&filter.status.eq=OPEN&q=finance&page=1&page_size=25&sort=detected_at&order=desc
```

Response:

```json
{
  "data": [
    {
      "incident_id": 101,
      "title": "Suspicious access to finance workstation",
      "description": "Repeated access attempts were detected outside normal working hours.",
      "severity": "CRITICAL",
      "status": "OPEN",
      "detected_at": "2026-10-08T03:40:00.000Z",
      "resolved_at": null,
      "employee_id": 7,
      "reporter_name": "Aditi Rao",
      "department_id": 2,
      "department_name": "Finance",
      "threat_actor_id": null,
      "threat_actor_name": null
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 25,
    "total": 1
  }
}
```

**Supported parameters**

| Parameter | Rule |
|---|---|
| `q` | Case-insensitive literal substring search in title; maximum 100 characters |
| `page` | Integer ≥ 1; default 1 |
| `page_size` | Integer 1–50; default 25 |
| `sort` | `incident_id`, `title`, `severity`, `status`, `detected_at`, `resolved_at` |
| `order` | `asc` or `desc`; default `desc` |
| `filter.severity.eq/ne` | One allowed severity |
| `filter.status.eq/ne` | One allowed status |
| `filter.incident_id.eq` | Positive integer |
| `filter.employee_id.eq` | Positive integer |
| `filter.threat_actor_id.eq` | Positive integer |
| `filter.detected_at.gte/lt` | ISO timestamp with timezone |
| `filter.resolved_at.gte/lt` | ISO timestamp with timezone |

The slash notation above describes two separate parameter names; it is not a literal URL key.

Examples:

```text
filter.status.ne=RESOLVED
filter.detected_at.gte=2026-10-01T00:00:00Z
```

Rules:

- All filters combine with AND.
- Maximum eight filter terms.
- Duplicate occurrences of the same filter parameter are rejected.
- Unsupported parameters, fields, operators, or sort values return 400.
- A valid query with no matches returns an empty array and total 0.
- A page beyond the available results returns an empty array with the actual total.

**Home query**

```http
GET /api/incidents?filter.status.ne=RESOLVED&sort=severity&order=desc&page=1&page_size=5
```

Severity sort uses semantic severity ranking, followed by detection time descending and ID descending.

Other sorts add an ID tie-breaker. Nulls sort last.

### D. Get incident by ID

```http
GET /api/incidents/101
```

Response:

```json
{
  "data": {
    "incident_id": 101,
    "title": "Suspicious access to finance workstation",
    "description": "Repeated access attempts were detected outside normal working hours.",
    "severity": "CRITICAL",
    "status": "OPEN",
    "detected_at": "2026-10-08T03:40:00.000Z",
    "resolved_at": null,
    "employee_id": 7,
    "reporter_name": "Aditi Rao",
    "department_id": 2,
    "department_name": "Finance",
    "threat_actor_id": null,
    "threat_actor_name": null
  }
}
```

Errors: 400 for invalid ID syntax; 404 for an absent incident.

Related collections are not included in this initial contract. Add their read contract in the relationship phase before implementing those sections.

### E. Add incident

```http
POST /api/incidents
Content-Type: application/json
```

```json
{
  "title": "Suspicious access to finance workstation",
  "description": "Repeated access attempts were detected outside normal working hours.",
  "severity": "CRITICAL",
  "status": "OPEN",
  "detected_at": "2026-10-08T03:40:00.000Z",
  "resolved_at": null,
  "employee_id": 7,
  "threat_actor_id": null
}
```

Response:

- HTTP 201.
- `Location: /api/incidents/101`.
- Body: `{"data": <Incident object>}` using the exact object defined above.

All eight writable keys are required, including nullable keys.

**Validation**

- `title`: 1–160 characters after trimming.
- `description`: null or at most 10,000 characters.
- `employee_id`: must reference an existing employee.
- `threat_actor_id`: null or an existing actor.
- Severity/status: exact allowed enum values.
- `detected_at`: required valid timestamp.
- `resolved_at`: required when status is RESOLVED; otherwise null.
- `resolved_at` cannot precede `detected_at`.

The UI may default status to OPEN and detection time to now, but sends explicit values.

### F. Update incident

```http
PUT /api/incidents/101
Content-Type: application/json
```

```json
{
  "title": "Suspicious access to finance workstation",
  "description": "The workstation was isolated and the access path investigated.",
  "severity": "CRITICAL",
  "status": "RESOLVED",
  "detected_at": "2026-10-08T03:40:00.000Z",
  "resolved_at": "2026-10-08T06:10:00.000Z",
  "employee_id": 7,
  "threat_actor_id": null
}
```

Response:

- HTTP 200.
- Body: `{"data": <updated Incident object>}`.

This is full replacement of the writable fields. There is no PATCH endpoint initially.

Selecting RESOLVED in the form reveals a resolution timestamp, defaulted to now and editable. Reopening clears it.

The initial app uses last-save-wins for edits. Multi-user conflict detection is outside the local demonstration scope.

### G. Delete incident

```http
DELETE /api/incidents/101
```

Success:

```text
204 No Content
```

The frontend must not attempt to parse JSON from this response.

Errors:

- 404: record no longer exists.
- 409: dependent records prevent deletion.

Example:

```json
{
  "error": {
    "code": "DEPENDENT_RECORDS",
    "message": "This incident cannot be deleted while related records exist.",
    "field_errors": {},
    "details": {
      "dependencies": [
        {
          "table": "EVIDENCE",
          "count": 2
        },
        {
          "table": "ALERT",
          "count": 1
        }
      ]
    }
  }
}
```

Foreign-key enforcement is the final authority even if a dependency check was performed first.

### H. Table catalog

```http
GET /api/tables
```

Returns all currently supported table definitions. This example shows one complete entry:

```json
{
  "data": [
    {
      "name": "DEPARTMENT",
      "label": "Departments",
      "kind": "entity",
      "primary_key": ["department_id"],
      "can_create": false,
      "can_update": false,
      "can_delete": false,
      "default_sort": "department_id",
      "default_order": "asc",
      "columns": [
        {
          "key": "department_id",
          "label": "Department ID",
          "type": "integer",
          "nullable": false,
          "sortable": true,
          "searchable": false,
          "filter_operators": ["eq"]
        },
        {
          "key": "department_name",
          "label": "Department name",
          "type": "text",
          "nullable": false,
          "sortable": true,
          "searchable": true,
          "filter_operators": []
        }
      ]
    }
  ]
}
```

Catalog rules:

- `kind`: `entity`, `relationship`, or `view`.
- Column types: `integer`, `text`, `enum`, `timestamp`, `date`.
- Enum columns additionally have `values`.
- The column list defines the complete returned row shape.
- Incident includes its read-only joined labels.
- Capability flags are true only for implemented operations.
- The catalog is hand-authored backend configuration, not unrestricted database introspection.

### I. Generic table display

```http
GET /api/tables/DEPARTMENT/rows?page=1&page_size=25&sort=department_name&order=asc&q=fin
```

```json
{
  "table": "DEPARTMENT",
  "data": [
    {
      "department_id": 2,
      "department_name": "Finance"
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 25,
    "total": 1
  }
}
```

Use the same pagination and `filter.<field>.<operator>` convention as Incident queries.

Only catalog-declared search columns, sort columns, and filter operators are accepted.

**Initial reference table behavior**

| Table | Search fields | Exact filters | Sort fields |
|---|---|---|---|
| DEPARTMENT | `department_name` | `department_id` | ID, name |
| EMPLOYEE | `first_name`, `last_name`, `email` | `employee_id`, `department_id` | ID, first name, last name, email |
| THREAT_ACTOR | `actor_name` | `threat_actor_id` | ID, actor name |
| INCIDENT | Same as Incident endpoint | Same as Incident endpoint | Same as Incident endpoint |

The same endpoint supports reporter and threat-actor selection in forms through paginated search. Do not assume every selectable employee fits in the first 50 results.

A generic record can be reloaded by exact primary-key filters. For composite keys, send each key component as a separate exact filter.

Unknown or unexposed tables return 404.

There are **no generic write endpoints** in the initial contract.

### Shared errors

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please correct the highlighted fields.",
    "field_errors": {
      "title": "Enter a title.",
      "resolved_at": "Resolution time cannot be earlier than detection time."
    },
    "details": {}
  }
}
```

| HTTP status | Meaning |
|---|---|
| 400 | Malformed JSON, invalid query syntax, unsupported fields/operators |
| 404 | Record or exposed resource not found |
| 409 | Dependency or uniqueness conflict |
| 422 | Well-formed request with invalid values or missing referenced records |
| 503 | Database temporarily unavailable |
| 500 | Unexpected server failure |

All endpoints use this structure for applicable errors. Raw Oracle messages, SQL text, credentials, and stack traces stay out of responses.

