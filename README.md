# Trace — Incident & Evidence Workspace

DBMS mini-project: Incident and Evidence Management System.

A React website (`frontend/`) talks to a small Java API (`backend/`, Javalin + JDBC), which runs prepared SQL against **Oracle Database XE 11g** (`database/`). The first slice is complete: Incident create, read, update and delete, with search, filters, sorting and paging.

- **Every SQL command, with file and line:** [docs/sql-reference.md](docs/sql-reference.md)
- **API contract:** [docs/contract/api-v1.md](docs/contract/api-v1.md)
- **Oracle 11g notes:** [docs/backend/oracle-11g-compatibility.md](docs/backend/oracle-11g-compatibility.md). The JDBC connection to 11.2.0.2 has since been verified locally with `--check-database`.

## Quick start

1. **Database.** As SYSTEM, run `database/000_create_app_user.sql`. Then, as TRACE_APP, run `001_core_schema.sql` and `002_core_seed.sql` in SQL*Plus.
2. **Frontend build.** In `frontend/`, run `npm ci` then `npm run build`.
3. **Backend build.** In `backend/`, run `mvn -B -ntp package` (Java 21).
4. **Run.** `.\start-server.ps1` asks for the TRACE_APP password, then serves the app at http://localhost:7000.

The sections below are the original backend delivery notes.

## Delivery status

- Implemented: core DDL, coherent synthetic seed records, frozen API contract, prepared Incident operations, allowlisted explorer queries, validation, UTC responses, loopback server, optional compiled-frontend serving, unit/HTTP tests, opt-in real Oracle tests.
- Preserved: employee `designation`, threat actor `actor_type` and `suspected_origin`, all 13 conceptual entities and the five junction relationships in the schema reference.
- Pending at the user's request: Oracle credentials, schema execution, real JDBC persistence checks, frontend integration.
- Deferred by the blueprint's acceptance gate: related table DDL and all remaining CRUD, dependency counts, relationship writes, and browser acceptance. Only four tables are exposed.

Read [verification results](docs/backend/verification.md) for precisely what passed and what did not run.

## Build

Install Java 21 and Maven 3.9.x (or use the workspace-local tool paths in the verification report). From `trace/backend`:

```powershell
java -version
mvn --version
mvn -B -ntp clean verify
```

This runs unit and HTTP contract tests. Oracle integration tests require explicit configuration and opt-in. Maven produces a self-contained `backend/target/trace-1.0.0.jar`.

On this Windows host, use the TEMP/TMP workaround in the backend guide before Maven/Java. A separately delivered `trace-api.jar` is ready to run with Java 21; it still requires Oracle environment variables for data operations.

## Oracle setup later

XE 11g has no PDB. For the first manual step, connect in SQL*Plus as SYSTEM using `sqlplus SYSTEM@localhost:1521/XE` (local password prompt), then run `database/000_create_app_user.sql`. It creates only a new TRACE_APP with CREATE SESSION, CREATE TABLE, CREATE SEQUENCE and a 100 MiB USERS quota. It refuses to alter an existing user. The API never connects as SYS or SYSTEM or creates users. Create a separate `TRACE_TEST` later; the test username must end in `_TEST`.

First run the read-only JDBC probe described below. Only after it passes, connect as each dedicated schema in SQL Developer/SQL*Plus to execute core scripts. No script has been executed for you.

Connect as each schema in SQL Developer and run as a **script (F5)**, in order:

```sql
@database/001_core_schema.sql
@database/002_core_seed.sql
```

Use paths relative to your SQL client or absolute paths. Run once in empty schemas. Scripts never drop existing objects. Oracle DDL commits automatically, so a schema script failure may leave earlier objects created; inspect and repair before rerunning. No schema script was executed during this delivery.

Configure variables in the same PowerShell window used to launch Java:

```powershell
$env:TRACE_DB_URL = 'jdbc:oracle:thin:@localhost:1521:XE'
$env:TRACE_DB_USER = 'TRACE_APP'
$traceSecret = Read-Host 'Application database password' -AsSecureString
$env:TRACE_DB_PASSWORD = [System.Net.NetworkCredential]::new('', $traceSecret).Password
cd backend
java -jar target/trace-1.0.0.jar --check-database
# Start the API after successful probe and manual core schema/seed setup:
# java -jar target/trace-1.0.0.jar
```

`.env.example` documents values; the server does not load `.env` files. It binds only to `127.0.0.1:7000`. Health returns success only after `SELECT 1 FROM DUAL` succeeds. Configuration mistakes exit with a short message; a later database outage returns a structured error.

## Verify

```powershell
Invoke-RestMethod 'http://127.0.0.1:7000/api/health'
Invoke-RestMethod 'http://127.0.0.1:7000/api/tables'
Invoke-RestMethod 'http://127.0.0.1:7000/api/incidents?sort=severity&order=desc'
```

For create/edit/delete and independent SQL verification, follow [the backend guide](backend/README.md).

## Frontend handoff

Start with [API v1](docs/contract/api-v1.md), [schema reference](docs/contract/schema-reference.md), and [example payloads](docs/contract/examples). Use `/api` fetch URLs. Vite should proxy them to `http://127.0.0.1:7000`.

After the frontend owner builds `frontend/dist`, run Java from `backend`; it serves that directory along with `/api`. Set `TRACE_FRONTEND_DIST` for another location. Only `/` and `/explore` use the SPA entrypoint; missing API routes remain JSON 404s. There is no permissive CORS configuration.

The first real vertical slice is not accepted until create → SQL verification → reload → edit → cancel delete → delete passes against Oracle and the browser. Preserve that gate before implementing additional CRUD.
