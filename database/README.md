# Oracle XE 11g (11.2.0.2) core scripts

See docs/backend/oracle-11g-compatibility.md first: SQL is adapted; authenticated JDBC compatibility is not established. After the read-only probe passes, run `001_core_schema.sql` then `002_core_seed.sql` in a NEW empty application schema and repeat in a separate test schema. Use SQL*Plus or SQL Developer Run Script (F5). Scripts contain SQL client commands and a PL/SQL block; do not split them on semicolons with a generic script runner. These scripts must not be applied to existing database objects.

Core tables: DEPARTMENT, EMPLOYEE, THREAT_ACTOR, INCIDENT. Employee department membership and reporting employee references are mandatory. Attribution is optional. Explicit SEQ_DEPARTMENT, SEQ_EMPLOYEE, SEQ_THREAT_ACTOR, SEQ_INCIDENT start at 1000; synthetic IDs remain below that value. IDs are positive NUMBER(10), and sequences cap generated values at 9999999999. Each writer must supply the corresponding NEXTVAL; no identity, ID default, or trigger is used. Sequence allocations are not rolled back, so gaps are normal.

Seed: three departments, eight employees, three actors, twelve incidents with all severities/statuses. Employee 8 and actor 3 are unreferenced. Detection times are relative to seed execution. Seeds commit together; all data uses fictional names and reserved `example.test` addresses.

Named foreign keys are restrictive. The initial schema has no Incident children, so core incidents have no dependents. Dependency counts, restrictive Incident child relationships, and transaction relationship demonstrations belong to the later verified phase. Do not create the remaining tables until the initial Oracle/browser slice passes.

Optional supplied attributes have provisional nullable bounds: designation 120 characters, actor_type 80, suspected_origin 120. The core name fields are mandatory; email is unique. API description length is bounded at 10000 characters; Oracle stores descriptions as CLOB.

Independent checks:

```sql
SELECT table_name FROM user_tables ORDER BY table_name;
SELECT sequence_name, min_value, max_value, increment_by FROM user_sequences ORDER BY sequence_name;
SELECT constraint_name, constraint_type, status FROM user_constraints ORDER BY table_name, constraint_name;
SELECT COUNT(*) FROM INCIDENT; -- 12 after initial seed
SELECT incident_id, title, status, detected_at, resolved_at FROM INCIDENT ORDER BY incident_id;
SELECT employee_id, designation, department_id FROM EMPLOYEE ORDER BY employee_id;
```

`course_queries.sql` covers joins, aggregation, NOT EXISTS, derived duration, and a reversible update. No script was executed against Oracle during this delivery. DDL implicitly commits; scripts are not migration tools and are deliberately not destructive/idempotent reset scripts.

## First manual SQL*Plus setup step

Connect using `sqlplus SYSTEM@localhost:1521/XE`; SQL*Plus prompts for SYSTEM's password locally. Then run `@database/000_create_app_user.sql` using the file's actual path. The script prompts locally for the new TRACE_APP password with HIDE, grants only CREATE SESSION/TABLE/SEQUENCE and a 100 MiB USERS quota, and refuses to alter an existing TRACE_APP. USERS/TEMP are the default XE tablespaces assumed here. The script uses SQL*Plus substitution; use a password containing no double quote or ampersand with this script. No password is passed on the command line or requested in chat.

To connect as the new account: `CONNECT TRACE_APP@localhost:1521/XE`; enter its password at the local prompt. A new Oracle user owns its same-named schema automatically. There is no PDB, C## prefix, or ALTER SESSION SET CONTAINER step. Do not run project DDL as SYSTEM.
