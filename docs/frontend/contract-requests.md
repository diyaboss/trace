# Contract requests from the frontend

The contract was sufficient to build the Incident slice without inventing API behavior. The items below are gaps or ambiguities for the contract owner. The frontend works with the current contract in every case.

## 1. Full-name search for employees (request)

`GET /api/tables/EMPLOYEE/rows?q=` matches `q` against `first_name`, `last_name`, and `email` separately (OR of substrings). A user typing "Aditi Rao" into the reporter picker gets no results.

- **Current workaround:** the picker sends only the first word and narrows by the remaining words locally across up to 50 rows. This can miss a match when the first word appears in more than 50 employees.
- **Request:** also match `first_name || ' ' || last_name`, or AND whitespace-separated tokens. The query parameters and response shape would not change.

## 2. Dependency details on 409 (clarification)

The contract example shows `details.dependencies` with per-table counts. `docs/backend/implementation-notes.md` says counts are not produced until relationship tables exist, so `details` is currently `{}`. The frontend shows the counts when present and a generic explanation otherwise. Please confirm the shape (`{table, count}`) before the relationship phase, and whether `table` will be the physical table name.

## 3. Reading related records (future)

The blueprint's 409 message should offer links to the blocking records. That needs the relationship-phase read contract (Section D notes it is not defined yet). No action is needed now.

## 4. Error message wording (informational)

The UI shows the server's `message` for 400/404/409, but for 503 and unreachable it uses its own text. No change requested.

## 5. 413 status (informational)

413 appears in the transport note but not in the status table. The frontend treats it as a generic API error and shows its message. Incident payloads are far below 64 KiB.
