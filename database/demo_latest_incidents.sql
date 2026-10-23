-- Demo helper: show the newest incidents, so a record created in the app
-- can be seen arriving in Oracle. Run in SQL*Plus with:  @database/demo_latest_incidents.sql
-- Works when connected as TRACE_APP, or as SYSTEM after:
--   ALTER SESSION SET CURRENT_SCHEMA = TRACE_APP;
SET LINESIZE 200
SET PAGESIZE 50
COLUMN incident_id FORMAT 9999999999 HEADING 'ID'
COLUMN title FORMAT A50 TRUNCATED
COLUMN severity FORMAT A8
COLUMN status FORMAT A13
COLUMN reported_by FORMAT A18
COLUMN detected FORMAT A17

SELECT *
FROM (
    SELECT i.incident_id,
           i.title,
           i.severity,
           i.status,
           e.first_name || ' ' || e.last_name AS reported_by,
           TO_CHAR(i.detected_at, 'DD-MON HH24:MI') AS detected
    FROM INCIDENT i
    JOIN EMPLOYEE e ON e.employee_id = i.employee_id
    ORDER BY i.incident_id DESC
)
WHERE ROWNUM <= 5;

SELECT COUNT(*) AS total_incidents FROM INCIDENT;
