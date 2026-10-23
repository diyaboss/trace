# Schema reference — supplied conceptual design

The user supplied 13 entities and the relationships below. This document preserves those entities. Only the first four core tables are materialized in the current phase. Non-core attribute sizes/enums will be frozen before their phase begins.

| Entity | Supplied attributes | Physical foreign keys |
|---|---|---|
| DEPARTMENT | department_id (PK), department_name | — |
| EMPLOYEE | employee_id (PK), first_name, last_name, email, designation | department_id → DEPARTMENT |
| INCIDENT | incident_id (PK), title, description, severity, status, detected_at, resolved_at | employee_id → EMPLOYEE; nullable threat_actor_id → THREAT_ACTOR |
| ALERT | alert_id (PK), alert_type, source, severity, timestamp | incident_id → INCIDENT |
| ASSET | asset_id (PK), hostname, asset_type, operating_system, criticality, ip_address | department_id → DEPARTMENT |
| VULNERABILITY | vulnerability_id (PK), cve_id, description, severity, patch_status | — |
| SECURITY_ANALYST | analyst_id (PK), first_name, last_name, email, specialization, certification | — |
| INVESTIGATION | investigation_id (PK), start_date, end_date, findings, status | incident_id → INCIDENT |
| EVIDENCE | evidence_id (PK), evidence_type, collected_at, file_hash, storage_location | incident_id → INCIDENT |
| EVIDENCE_LOG | log_no, action, timestamp, remarks | evidence_id → EVIDENCE; PK (evidence_id, log_no) |
| SYSTEM_LOG | system_log_id (PK), log_type, log_source, timestamp, log_data | asset_id → ASSET |
| RESPONSE_ACTION | action_id (PK), action_type, description, start_time, completion_time, status | incident_id → INCIDENT; analyst_id → SECURITY_ANALYST |
| THREAT_ACTOR | threat_actor_id (PK), actor_name, actor_type, suspected_origin | — |

## Required junctions

| Table | Composite primary key, also foreign keys |
|---|---|
| INCIDENT_ASSET | (incident_id, asset_id) |
| ASSET_VULNERABILITY | (asset_id, vulnerability_id) |
| INCIDENT_ANALYST | (incident_id, analyst_id) |
| INVESTIGATION_ANALYST | (investigation_id, analyst_id) |
| INCIDENT_SYSTEM_LOG | (incident_id, system_log_id) |

No artificial IDs on these junctions. All relationship FKs are mandatory except Incident attribution. Employee on an Incident means **reported by employee**. The reporting employee determines the returned department; department is not a writable Incident field.

## Current physical core

IDs: positive NUMBER(10), explicitly generated with Oracle 11g SEQ_DEPARTMENT, SEQ_EMPLOYEE, SEQ_THREAT_ACTOR, SEQ_INCIDENT. Each starts at 1000, increments by 1, and has MAXVALUE 9999999999 NOCYCLE. Core seed IDs occupy the lower range. Writers bind the allocated NEXTVAL; no identity syntax or ID defaults/triggers are used. Sequence gaps after rollback are normal. This physical implementation change does not alter API keys or supplied attributes.

- DEPARTMENT: department_name VARCHAR2(120 CHAR), mandatory.
- EMPLOYEE: first_name/last_name VARCHAR2(80 CHAR), email VARCHAR2(254 CHAR), all mandatory; nullable designation VARCHAR2(120 CHAR); mandatory department_id. Email unique.
- THREAT_ACTOR: actor_name VARCHAR2(160 CHAR), mandatory; nullable actor_type VARCHAR2(80 CHAR), suspected_origin VARCHAR2(120 CHAR).
- INCIDENT: title VARCHAR2(160 CHAR), description CLOB, severity VARCHAR2(8 CHAR), status VARCHAR2(13 CHAR), detected_at/resolved_at TIMESTAMP(3) WITH TIME ZONE. Description and attribution nullable; resolved_at is conditional.

Core enums, dates, errors, and list behavior are frozen in API v1. All eight writable keys must be present, including nullable keys. Required strings trim; optional empty strings normalize to null. Input offsets normalize to UTC. Database precision is milliseconds; shorter fractional formatting in a response represents the same ISO instant.

Resolution time is mandatory exactly when status is RESOLVED, otherwise null, and may not precede detection. Oracle enforces this with named constraints. Duration is derived. Restrictive FKs preserve referenced data; no cascades remove history.

Later phases retain the supplied timestamp attribute names. Investigation dates represent calendar dates. SHA-256 evidence metadata uses VARCHAR2(64), IP addresses VARCHAR2(45). Evidence log history is appended after locking the parent evidence row to allocate the next log_no. This schema does not record handler identity or promise tamper-proof custody.
