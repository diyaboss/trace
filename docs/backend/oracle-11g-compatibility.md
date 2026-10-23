# Oracle XE 11g compatibility assessment — 8 October 2026

**SQL has been adapted for 11.2.0.2. Exact JDBC connectivity is NOT established.** No database session, DDL, user creation, privilege change, or application mutation was performed during this adaptation.

## Exact versions and evidence

| Component | Exact version | Evidence / conclusion |
|---|---|---|
| Installed database | Oracle Database XE 11.2.0.2 | User verified `SELECT banner FROM v$version`. Windows service points at the 11.2 installation. |
| Locally bundled legacy JDBC | ojdbc6 11.2.0.2.0 | Read-only inspection of Oracle home's `jdbc/lib/ojdbc6.jar` manifest. Not selected or added to the app. |
| Application JDBC candidate | `com.oracle.database.jdbc:ojdbc11:21.23.0.0` | Existing pinned dependency retained. JDK 21 is listed for this exact release, but its current supported database list excludes 11g. [Oracle downloads](https://www.oracle.com/database/technologies/appdev/jdbc-downloads.html) |
| Application runtime tested | Eclipse Temurin 21.0.12.1 | Workspace-local toolchain. Compilation/HTTP tests prove application execution, not Oracle certification or database interoperability. |
| HTTP framework | Javalin 7.2.3 | Requires Java 17 or later. [Javalin documentation](https://javalin.io/documentation) |

The cached candidate JAR SHA-1 is `02dff94f9f2ba95bac8150a42db59b8ab7c6bf12`, matching Oracle's published 21.23.0.0 ojdbc11 checksum. Artifact identity is verified; it does not establish database compatibility.

Oracle's historical 19c interoperability table names **Database 11.2.0.4**, not 11.2.0.2. Do not transfer certification to an earlier patch level or a different driver release. [Oracle JDBC compatibility table](https://docs.oracle.com/en/database/oracle/oracle-database/19/jjdbc/JDBC-getting-started.html)

The JDBC FAQ limits JDK 7/8 support in the 11.2 driver family to 11.2.0.3/11.2.0.4. Thus the installed 11.2.0.2.0 driver's historical JDK 6 option cannot run this backend. The FAQ also distinguishes Oracle JVM certification from use on other JVMs; Temurin testing is local evidence. [Oracle JDBC FAQ](https://www.oracle.com/database/technologies/faq-jdbc.html)

## Decision and tradeoff

No dependency or Java/framework downgrade is made. Java 21 + Javalin 7 + ojdbc11 21.23 remains an **experimental candidate** for this fixed legacy database. There is no claim that a modern driver necessarily fails; there is also no successful authenticated connection evidence yet.

A historically aligned legacy-runtime path would require replacing Javalin and rewriting records, text blocks, modern collections/switches, HTTP tests, and JDBC time handling. Substituting ojdbc6 alone would also lose the standard OffsetDateTime/JDBC 4.2 mappings. That is a significant backend change, so it is not undertaken as part of this SQL adaptation. Switching to a random ojdbc8/19c version would not establish exact 11.2.0.2 support either. Oracle is not reinstalled, patched, or reconfigured.

## What changed

Four explicit sequences replace identity syntax: `SEQ_DEPARTMENT`, `SEQ_EMPLOYEE`, `SEQ_THREAT_ACTOR`, `SEQ_INCIDENT`. All start at 1000, increment by 1, max at 9999999999, NOCYCLE. Seed IDs are explicit and below 1000. Incident creation allocates NEXTVAL on its connection, binds the ID into INSERT, reads the saved row, and commits. Rollback does not reclaim sequence values; gaps are expected. Other tables remain read-only in the API; future writers must use their corresponding sequence. No triggers or sequence defaults are needed.

Both Incident and generic reads sort in the innermost query, number/bound rows in the middle query, then filter the lower bound and order by that row number outside. Existing severity ranking, nulls-last policy, PK tie-breakers, predicates, and read-only snapshot consistency remain. Pagination helper columns are never included in JSON. This follows the 11g [ROWNUM ordering rules](https://docs.oracle.com/cd/E11882_01/server.112/e41084/pseudocolumns009.htm).

All schema attributes, endpoint routes, JSON names, error envelopes, catalog fields, UTC semantics, and one-based pagination are preserved. XE 11g uses `jdbc:oracle:thin:@localhost:1521:XE` (SID form), not a PDB. Local tnsnames.ora names service XE and port 1521. [XE 11g Java connection guide](https://docs.oracle.com/cd/E17781_01/appdev.112/e18805.pdf)

## Establish experimental compatibility locally

The probe requires an authenticated dedicated account, so it cannot precede creating that new account. User creation is an independent setup step, not evidence of JDBC compatibility. `database/000_create_app_user.sql` is an optional manual SQL*Plus script that creates only a previously absent TRACE_APP user. It has not been executed.

After creating the account, configure URL/user/password **locally** as described in backend/README.md, then run:

```powershell
java -jar target/trace-1.0.0.jar --check-database
```

This performs SELECTs only: actual connection/health, timestamp bind/readback, generated-row ROWNUM paging, CLOB read, and literal wildcard search. It needs no project tables or sequences and rolls back its read-only transaction. It reports actual driver, Java vendor/version, and database version without reporting passwords or connection URLs. Exit 0 means those smoke checks worked experimentally; it does not mean certified support or verified CRUD.

Only after this passes should you manually run the core schema/seeds in a **new empty** schema, then use the separate TRACE_TEST schema and opt-in integration tests to establish sequence-backed CRUD and persistence. If the probe fails, retain its numeric Oracle error locally and revisit the runtime/driver tradeoff; do not change listener, authentication, or existing objects to force it through.
