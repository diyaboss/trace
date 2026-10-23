package edu.project.trace;

import java.time.Instant;

public record Incident(long incident_id, String title, String description, String severity, String status,
        Instant detected_at, Instant resolved_at, long employee_id, String reporter_name, long department_id,
        String department_name, Long threat_actor_id, String threat_actor_name) {}
