-- Initial course examples; relationship demonstrations wait for the verified slice.
SELECT i.incident_id, i.title, e.first_name || ' ' || e.last_name AS reporter,
       d.department_name, t.actor_name
FROM INCIDENT i
JOIN EMPLOYEE e ON e.employee_id = i.employee_id
JOIN DEPARTMENT d ON d.department_id = e.department_id
LEFT JOIN THREAT_ACTOR t ON t.threat_actor_id = i.threat_actor_id
ORDER BY i.detected_at DESC, i.incident_id DESC;

SELECT severity, COUNT(*) AS incident_count
FROM INCIDENT WHERE status <> 'RESOLVED' GROUP BY severity;

SELECT e.employee_id, e.first_name, e.last_name
FROM EMPLOYEE e WHERE NOT EXISTS (SELECT 1 FROM INCIDENT i WHERE i.employee_id = e.employee_id);

-- Calendar time is derived, never a duration column.
SELECT incident_id, resolved_at - detected_at AS resolution_duration
FROM INCIDENT WHERE status = 'RESOLVED';

-- Reversible UPDATE demonstration. Execute deliberately in SQL Developer.
SAVEPOINT before_demo;
UPDATE INCIDENT SET title = title || ' [demo]' WHERE incident_id = 104;
SELECT incident_id, title FROM INCIDENT WHERE incident_id = 104;
ROLLBACK TO before_demo;
ROLLBACK;
