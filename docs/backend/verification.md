# Verification — 8 October 2026

This report reflects the Oracle 11g adaptation. See oracle-11g-compatibility.md for exact support limits; passing Java/HTTP tests is not proof of authenticated Oracle compatibility.

## Passed

- Java 21 compilation and Maven verify succeeded.
- 17 tests passed: 7 input/error validation, 6 catalog/query validation, 4 actual HTTP contract tests.
- 0 test failures and 0 errors on the final run.
- Packaged shaded JAR started on loopback port 17000 and was stopped after verification.
- Real HTTP catalog exposed exactly INCIDENT, DEPARTMENT, EMPLOYEE, THREAT_ACTOR and was saved as the catalog example.
- Packaged server served `/` and `/explore` from a temporary HTML fixture. Unknown `/api` route remained a JSON 404.
- Unreachable Oracle health returned JSON 503; it did not report connection success or leak connection details.
- All five contract JSON examples parsed successfully.

HTTP tests cover malformed/duplicate JSON, missing/invalid fields before database access, unsupported sort/table/filter parameters, GET/DELETE body rejection, 64 KiB request ceiling, catalog shape, and the unavailable-database path. Query tests verify literal escaping, allowed operators, duplicate/eight-term limits, semantic severity, nulls-last ordering, and pagination bounds.

## Not run

Three real Oracle integration tests were skipped because credentials and schema setup were deferred by the user. Neither SQL script was run. No records, users, privileges, or database service settings were changed. No H2, in-memory database, or fake success responses were substituted.

Oracle DDL/seed validity, sequence-backed creation, real JDBC timestamp round-trip, persisted CRUD, literal search execution, database transaction rollback, and Oracle constraint enforcement remain unverified in this environment. Source tests exist to verify these once a dedicated schema is available. The read-only compatibility probe has not been run against the installed Oracle database. The retained ojdbc11 21.23.0.0 + Java 21 candidate is not documented as certified for exact database 11.2.0.2.

Frontend code and Playwright tests are outside Codex ownership in the brief. Browser create/edit/delete, refresh persistence, focus, Back, keyboard, mobile, reduced motion, and UI failure/unsaved-input states have not been evaluated. A static-serving fixture is not frontend acceptance.

Incident child tables are not created yet. Dependency counts/blocking deletion and multi-statement relationship rollback remain for the relationship phase after initial acceptance.

## Tools and reproducibility

Workspace-local tools: Eclipse Temurin Java 21.0.12.1, Maven 3.9.11. System Java/Maven installations and PATH were not changed. Downloads and Maven cache are under `work/`, outside the source delivery. Runtime dependencies/plugins are pinned in pom.xml.

From the original chat workspace, the final verification used this PowerShell sequence:

```powershell
$env:JAVA_HOME = (Get-ChildItem work/tools/jdk21 -Directory | Select-Object -First 1).FullName
$env:PATH = "$env:JAVA_HOME/bin;$env:PATH"
$env:TEMP = 'C:\Users\Diya Gupta\Documents\Codex\work\trace-sockets'
$env:TMP = $env:TEMP
$traceRepo = Join-Path (Get-Location) 'work/m2'
& ./work/tools/apache-maven-3.9.11/bin/mvn.cmd -B -ntp -f outputs/trace/backend/pom.xml "-Dmaven.repo.local=$traceRepo" verify
```

The initial HTTP run failed in the JDK's Windows temporary Unix-socket initialization, before application code. A short writable TEMP/TMP directory fixed it for both tests and packaged startup. The application does not hardcode this workaround. On this host, set those process variables before Maven/Java; on other hosts use normal `mvn verify` first. The directory must exist. Maven's packaging warnings concern overlapping third-party module/notice resources; packaged HTTP startup was independently verified.

The delivered JAR is `backend/target/trace-1.0.0.jar`. `trace-source.zip` contains source/scripts/docs only; the executable is also delivered separately as `trace-api.jar`. No active verification server was left running.
