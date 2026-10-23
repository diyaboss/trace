-- Synthetic data only. Run once after 001_core_schema.sql.
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK
INSERT INTO DEPARTMENT VALUES (1, 'IT Operations');
INSERT INTO DEPARTMENT VALUES (2, 'Finance');
INSERT INTO DEPARTMENT VALUES (3, 'People Operations');
INSERT INTO EMPLOYEE VALUES (1, 'Maya', 'Sen', 'maya.sen@example.test', 'Systems engineer', 1);
INSERT INTO EMPLOYEE VALUES (2, 'Rohan', 'Mehta', 'rohan.mehta@example.test', 'IT coordinator', 1);
INSERT INTO EMPLOYEE VALUES (3, 'Leena', 'Shah', 'leena.shah@example.test', 'Accountant', 2);
INSERT INTO EMPLOYEE VALUES (4, 'Kabir', 'Das', 'kabir.das@example.test', 'Finance associate', 2);
INSERT INTO EMPLOYEE VALUES (5, 'Nisha', 'Kapoor', 'nisha.kapoor@example.test', 'People partner', 3);
INSERT INTO EMPLOYEE VALUES (6, 'Arjun', 'Iyer', 'arjun.iyer@example.test', 'Support specialist', 1);
INSERT INTO EMPLOYEE VALUES (7, 'Aditi', 'Rao', 'aditi.rao@example.test', 'Finance analyst', 2);
INSERT INTO EMPLOYEE VALUES (8, 'Ishaan', 'Roy', 'ishaan.roy@example.test', 'HR associate', 3);
INSERT INTO THREAT_ACTOR VALUES (1, 'Synthetic actor Alpha', 'External', NULL);
INSERT INTO THREAT_ACTOR VALUES (2, 'Synthetic actor Beta', 'Unknown', NULL);
INSERT INTO THREAT_ACTOR VALUES (3, 'Unreferenced demonstration actor', NULL, NULL);
DECLARE
    titles SYS.ODCIVARCHAR2LIST := SYS.ODCIVARCHAR2LIST(
        'Suspicious access to finance workstation', 'Unexpected outbound traffic',
        'Repeated failed authentication', 'Unapproved software installation',
        'Phishing message reported', 'Endpoint isolation required',
        'Sensitive document sharing alert', 'Unexpected privileged account activity',
        'Employee''s workstation reported 100% CPU', 'Unrecognized scheduled task',
        'Suspicious archive detected', 'Legacy access token revoked');
    levels SYS.ODCIVARCHAR2LIST := SYS.ODCIVARCHAR2LIST('CRITICAL','HIGH','MEDIUM','LOW','HIGH','CRITICAL','MEDIUM','HIGH','LOW','MEDIUM','HIGH','LOW');
    states SYS.ODCIVARCHAR2LIST := SYS.ODCIVARCHAR2LIST('INVESTIGATING','OPEN','CONTAINED','OPEN','RESOLVED','CONTAINED','OPEN','INVESTIGATING','RESOLVED','OPEN','RESOLVED','RESOLVED');
    detected TIMESTAMP(3) WITH TIME ZONE;
    resolved TIMESTAMP(3) WITH TIME ZONE;
BEGIN
    FOR n IN 1..12 LOOP
        detected := SYSTIMESTAMP - NUMTODSINTERVAL(13 - n, 'DAY');
        resolved := NULL;
        IF states(n) = 'RESOLVED' THEN resolved := detected + INTERVAL '2' HOUR; END IF;
        INSERT INTO INCIDENT (incident_id, title, description, severity, status, detected_at, resolved_at, employee_id, threat_actor_id)
        VALUES (100 + n, titles(n), 'Synthetic training incident. Review the report and record the investigation outcome.', levels(n), states(n), detected, resolved,
                CASE WHEN n = 1 THEN 7 ELSE MOD(n-1,7)+1 END,
                CASE WHEN MOD(n,3) = 0 THEN 1 WHEN MOD(n,4) = 0 THEN 2 ELSE NULL END);
    END LOOP;
END;
/
COMMIT;
SELECT severity, status, COUNT(*) AS incident_count FROM INCIDENT GROUP BY severity, status;
