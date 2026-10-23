# Trace — Website Actions and SQL Reference

24 Oct 2026 · Live version: https://claude.ai/artifact/D3Gt9v31CXBCVaifwntUCh

## How a click reaches Oracle

Every SQL statement the website runs lives in four Java files of the backend; the React frontend never contains SQL. A click sends an HTTP request, a Java route receives it, a DAO method runs prepared SQL through JDBC, and Oracle executes it.

All files below are in `backend/src/main/java/edu/project/trace/`:

| File | Role | SQL it holds |
| --- | --- | --- |
| `IncidentDao.java` | Data Access Object for incidents | SELECT, INSERT, UPDATE, DELETE, sequence, transactions |
| `ExplorerQuery.java` | Builds the WHERE, ORDER BY and paging parts from the URL's search, filters and sort | WHERE fragments, ORDER BY, ROWNUM paging |
| `TableDao.java` | Read-only queries for the Employee and Threat actor pickers | SELECT, COUNT |
| `Db.java` | Opens the Oracle connection | Health check |

Two notes for the viva:

- `COMMIT` and `ROLLBACK` are issued through JDBC calls (`connection.commit()`, `connection.rollback()`) rather than as SQL text; Oracle runs them the same way.
- Every `?` is a JDBC bind parameter: values travel separately from the SQL text, which prevents SQL injection.

## 1. Opening the site (Overview page)

The Overview runs a health check and the same incident list query as Explore Data, limited to five unresolved incidents.

| Action | SQL | File : line |
| --- | --- | --- |
| Database status line | `SELECT 1 FROM DUAL` | `Db.java : 25` |
| Unresolved incidents list | The incident list query (section 2) with `WHERE i.status <> ?` (value `RESOLVED`), severity sort, 5 rows | `IncidentDao.java : 21`, `ExplorerQuery.java : 55, 59` |

## 2. Explore Data: load, search, filter, sort, page, refresh

Every one of these actions runs the same read-only transaction: a count for the total, then one page of rows. Only the WHERE, ORDER BY and page numbers change.

**The transaction, every time**

| SQL | File : line |
| --- | --- |
| `SET TRANSACTION READ ONLY` | `IncidentDao.java : 25` |
| `SELECT COUNT(*) FROM INCIDENT i WHERE …` (the "N incidents" total) | `IncidentDao.java : 28` |
| Main query, run as a paged query | `IncidentDao.java : 32` |
| `SELECT i.incident_id, i.title, … FROM INCIDENT i` | `IncidentDao.java : 10–16` |
| `JOIN EMPLOYEE e ON e.employee_id = i.employee_id` | `IncidentDao.java : 17` |
| `JOIN DEPARTMENT d ON d.department_id = e.department_id` | `IncidentDao.java : 18` |
| `LEFT JOIN THREAT_ACTOR t ON t.threat_actor_id = i.threat_actor_id` | `IncidentDao.java : 19` |
| `COMMIT` | `IncidentDao.java : 35` |
| `ROLLBACK` (on error) | `IncidentDao.java : 37` |

**What each action adds**

| Action | SQL added | File : line |
| --- | --- | --- |
| Search titles | `LOWER(i.title) LIKE LOWER(?) ESCAPE '\'` | `ExplorerQuery.java : 34` |
| Filter "is" | `i.<column> = ?` | `ExplorerQuery.java : 55` (operators at line 10) |
| Filter "is not" | `i.<column> <> ?` | `ExplorerQuery.java : 55` |
| Filter "on or after" | `i.<column> >= ?` | `ExplorerQuery.java : 55` |
| Filter "on or before" | `i.<column> < ?` (start of the next day) | `ExplorerQuery.java : 55` |
| Several filters and search together | `WHERE … AND …` | `ExplorerQuery.java : 64` |
| Sort by Severity | `ORDER BY CASE i.severity WHEN 'LOW' THEN 1 … WHEN 'CRITICAL' THEN 4 END DESC NULLS LAST, i.detected_at DESC, i.incident_id DESC` | `ExplorerQuery.java : 59` |
| Sort by ID, Title, Status, Detected or Resolved | `ORDER BY i.<column> ASC or DESC NULLS LAST` | `ExplorerQuery.java : 61` |
| Tie-breaker for those sorts | `, i.incident_id ASC or DESC` | `ExplorerQuery.java : 62` |
| Pages and rows per page (Oracle 11g) | `SELECT ordered_rows.*, ROWNUM AS trace_row_number …` | `ExplorerQuery.java : 86–87` |
| Upper bound of the page | `WHERE ROWNUM <= ?` | `ExplorerQuery.java : 92` |
| Lower bound of the page | `WHERE trace_row_number > ?` | `ExplorerQuery.java : 94` |
| Bound values (page × page size) | — | `ExplorerQuery.java : 80–81` |

## 3. Opening one incident

Clicking a row or title loads that single record with its reporter, department and threat actor.

| SQL | File : line |
| --- | --- |
| `SELECT … FROM INCIDENT i JOIN EMPLOYEE … JOIN DEPARTMENT … LEFT JOIN THREAT_ACTOR … WHERE i.incident_id = ?` | `IncidentDao.java : 44` |

## 4. Create incident (Create incident button)

Creation is one transaction: take a new ID from the sequence, insert the row, read it back, then commit. Any failure rolls the whole thing back.

| Step | SQL | File : line |
| --- | --- | --- |
| 1 | `SELECT seq_incident.NEXTVAL FROM DUAL` (new ID, starts at 1000) | `IncidentDao.java : 54` |
| 2 | `INSERT INTO INCIDENT (title, description, severity, status, detected_at, resolved_at, employee_id, threat_actor_id, incident_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)` | `IncidentDao.java : 60–61` |
| 3 | `SELECT … WHERE i.incident_id = ?` (reads back the saved row) | `IncidentDao.java : 44` |
| 4 | `COMMIT` | `IncidentDao.java : 65` |
| On error | `ROLLBACK` | `IncidentDao.java : 66` |

The frontend side of the same click: `IncidentForm.tsx : 161` calls `addIncident`, which sends `POST /api/incidents` (`incidents.ts : 15`); the route is mapped at `App.java : 47` and handled at `IncidentRoutes.java : 12`.

## 5. Edit incident (Save changes)

An edit replaces all eight writable columns in one transaction, then reads the row back before committing.

| Step | SQL | File : line |
| --- | --- | --- |
| 1 | `UPDATE INCIDENT SET title = ?, description = ?, severity = ?, status = ?, detected_at = ?, resolved_at = ?, employee_id = ?, threat_actor_id = ? WHERE incident_id = ?` | `IncidentDao.java : 74–76` |
| 2 | `SELECT … WHERE i.incident_id = ?` (reads back) | `IncidentDao.java : 44` |
| 3 | `COMMIT` | `IncidentDao.java : 81` |
| On error | `ROLLBACK` | `IncidentDao.java : 82` |

## 6. Delete incident (trash icon → Delete incident)

Deletion is a single statement; JDBC's default auto-commit commits it immediately. The row is removed from the screen only after Oracle confirms.

| SQL | File : line |
| --- | --- |
| `DELETE FROM INCIDENT WHERE incident_id = ?` | `IncidentDao.java : 86` |

The frontend side of the same click: `DeleteIncidentDialog.tsx : 40` calls `deleteIncident`, which sends `DELETE /api/incidents/{id}` (`incidents.ts : 26`); the route is mapped at `App.java : 49` and handled at `IncidentRoutes.java : 20`.

## 7. "Reported by" and "Threat actor" search in the form

Typing in these boxes runs a read-only paged query on EMPLOYEE or THREAT_ACTOR through `TableDao`.

| SQL | File : line |
| --- | --- |
| `SET TRANSACTION READ ONLY` | `TableDao.java : 18` |
| `SELECT COUNT(*) FROM EMPLOYEE WHERE …` (or `THREAT_ACTOR`) | `TableDao.java : 21` |
| `SELECT employee_id, first_name, last_name, email, designation, department_id FROM EMPLOYEE` (or the actor columns `FROM THREAT_ACTOR`), paged with ROWNUM | `TableDao.java : 25` |
| Employees: `LOWER(first_name) LIKE ? OR LOWER(last_name) LIKE ? OR LOWER(email) LIKE ?` | `ExplorerQuery.java : 34, 37` |
| Threat actors: `LOWER(actor_name) LIKE ?` | `ExplorerQuery.java : 34` |
| `COMMIT` | `TableDao.java : 35` |
| `ROLLBACK` (on error) | `TableDao.java : 36` |

## Actions that run no SQL, and viva points

These happen only in the browser: showing or hiding columns, closing the record panel, Cancel buttons, the "discard unsaved changes" prompt, form validation messages, keyboard shortcuts and the hero animation. Previous and Next only change the page number; the reload they trigger runs the section 2 queries.

Points worth saying to the examiner:

- **DAO pattern.** All incident SQL sits in one class, `IncidentDao.java`; routes never touch the database directly.
- **Prepared statements.** Every value is a `?` bind parameter, so user input can never change the SQL itself.
- **Transactions.** Create and edit use `setAutoCommit(false)`, then `COMMIT` or `ROLLBACK`; list queries use `SET TRANSACTION READ ONLY` so the count and rows see the same snapshot.
- **Joins.** The list joins EMPLOYEE and DEPARTMENT (inner joins) and THREAT_ACTOR (LEFT JOIN, because attribution is optional).
- **Oracle 11g paging.** 11g has no `OFFSET … FETCH`, so pages use a nested `ROWNUM` query.
- **Sequence.** New IDs come from `SEQ_INCIDENT` (starts at 1000), so they never collide with the seed rows 101–112.
