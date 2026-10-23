# Trace Java API

Use Java 21 and Maven 3.9.x. `mvn -B -ntp verify` builds the executable JAR and runs non-database tests. Direct dependencies and Maven plugins are pinned in pom.xml. Runtime uses Javalin 7.2.3, ojdbc11 21.23.0.0, Jackson 2.20.0, and SLF4J Simple 2.0.17.

Target database: Oracle XE 11g **11.2.0.2**, with sequence-backed inserts and nested ROWNUM pagination. The retained JDBC/runtime combination is an **unverified experimental candidate**, not a certified exact database combination. See docs/backend/oracle-11g-compatibility.md. No legacy framework/runtime rewrite has been made.

## Start

Create only the new dedicated account using the database README, then set `TRACE_DB_URL`, `TRACE_DB_USER`, and `TRACE_DB_PASSWORD` in the launching process. `.env.example` is not automatically read. Default local port 7000; optional `TRACE_PORT`. From this directory:

Use `TRACE_DB_URL=jdbc:oracle:thin:@localhost:1521:XE` (SID form), or `jdbc:oracle:thin:@//localhost:1521/XE` when using the XE service name. Local tnsnames.ora lists XE on port 1521. There is no XEPDB1/container setup in 11g. After creating only the dedicated account, set its password using a local prompt (root README) and check compatibility before creating project objects:

```powershell
java -jar target/trace-1.0.0.jar --check-database
```

The probe performs read-only health, timestamp bind/readback, ROWNUM paging, CLOB read and literal-search checks without requiring tables. A pass provides experimental evidence only. Then manually initialize a NEW empty schema using the database guide, and start:

```powershell
java -jar target/trace-1.0.0.jar
```

The API is available at `http://127.0.0.1:7000/api`. If `../frontend/dist/index.html` exists, Java also serves the compiled frontend, including `/explore`. Set `TRACE_FRONTEND_DIST` to override that path.

On this Windows host, Java's default temporary socket directory caused loopback initialization to fail. Before Maven or Java, use the existing short writable directory from verification:

```powershell
$env:TEMP = 'C:\Users\Diya Gupta\Documents\Codex\work\trace-sockets'
$env:TMP = $env:TEMP
```

Other machines can use their normal temp directory; see the verification report for details.

## HTTP verification sequence after Oracle setup

Run from `backend` in another PowerShell window. All writes use synthetic records:

```powershell
$traceBase = 'http://127.0.0.1:7000/api'
Invoke-RestMethod "$traceBase/health"
Invoke-RestMethod "$traceBase/tables"
Invoke-RestMethod "$traceBase/incidents?filter.status.ne=RESOLVED&sort=severity&order=desc"

$traceInput = Get-Content -Raw ../docs/contract/examples/incident-input.json
$traceCreated = Invoke-RestMethod "$traceBase/incidents" -Method Post -ContentType 'application/json' -Body ([Text.Encoding]::UTF8.GetBytes($traceInput))
$traceId = $traceCreated.data.incident_id
$traceCreated.data
Invoke-RestMethod "$traceBase/incidents/$traceId"

$traceReplacement = $traceInput | ConvertFrom-Json
$traceReplacement.title = 'Verification incident updated'
$traceReplacement.status = 'RESOLVED'
$traceReplacement.resolved_at = '2026-10-08T06:10:00Z'
Invoke-RestMethod "$traceBase/incidents/$traceId" -Method Put -ContentType 'application/json' -Body ([Text.Encoding]::UTF8.GetBytes(($traceReplacement | ConvertTo-Json)))

# Canceling deletion means do not send DELETE. GET should still return the record.
Invoke-RestMethod "$traceBase/incidents/$traceId"
# After independently checking the row in SQL Developer, remove the verification record.
Invoke-WebRequest "$traceBase/incidents/$traceId" -Method Delete
```

Substitute the returned ID in SQL Developer between operations:

```sql
SELECT incident_id, title, status, employee_id, detected_at, resolved_at
FROM INCIDENT WHERE incident_id = <returned_id>;
-- After DELETE:
SELECT COUNT(*) FROM INCIDENT WHERE incident_id = <returned_id>; -- expected 0
```

Useful negative requests:

```powershell
# Expected 400, unknown sortable column.
Invoke-RestMethod "$traceBase/incidents?sort=password"
# Expected 422 with field errors.
Invoke-RestMethod "$traceBase/incidents" -Method Post -ContentType 'application/json' -Body '{}'
# Expected 404, only the four catalog tables are exposed.
Invoke-RestMethod "$traceBase/tables/EVIDENCE/rows"
```

PowerShell surfaces non-2xx responses as errors; inspect the JSON response body. The DELETE success body is empty (204). Health success proves an actual Oracle SELECT, not only HTTP server startup.

## Real Oracle tests, later

Initialize a separate empty `TRACE_TEST` schema with both core scripts. Set `TRACE_TEST_DB_URL`, `TRACE_TEST_DB_USER`, `TRACE_TEST_DB_PASSWORD` in the Maven process. The test username must end in `_TEST` and differ from `TRACE_DB_USER`. There is no automatic schema creation/reset and no H2 substitution.

```powershell
$env:TRACE_TEST_DB_URL = 'jdbc:oracle:thin:@localhost:1521:XE'
$env:TRACE_TEST_DB_USER = 'TRACE_TEST'
$traceTestSecret = Read-Host 'Test schema password' -AsSecureString
$env:TRACE_TEST_DB_PASSWORD = [System.Net.NetworkCredential]::new('', $traceTestSecret).Password
mvn -B -ntp '-Dtrace.test.database=true' verify
```

Tests create uniquely labeled Incident records, verify them through independent SQL connections, and clean up only those IDs. They test real CRUD/readback, foreign-key failures, rollback of an invalid replacement, literal apostrophe/wildcard search, deterministic pages, reference reads, UTC serialization, missing records, and health.

Dependency-blocked Incident deletion and multi-statement relationship rollback await the relationship phase; browser cancellation/reload/keyboard behavior belongs to the frontend owner's Playwright suite. The current HTTP cancellation check confirms that a record remains when no DELETE is sent; it does not simulate a browser dialog.

## API boundaries

Only Incident has writes. No generic SQL or generic write endpoint exists. Full replacement PUT requires all eight writable keys. JSON unknown fields and duplicate keys are rejected. GET/DELETE reject request bodies. Search/filter/pagination limits and supported fields are in docs/contract/api-v1.md. The request-body ceiling is 64 KiB, including chunked bodies; oversize requests return shared JSON errors (413).

No database credentials were provided or embedded in this delivery. Read docs/backend/verification.md before claiming Oracle acceptance.
