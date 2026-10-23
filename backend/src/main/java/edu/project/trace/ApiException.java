package edu.project.trace;

import java.sql.SQLException;
import java.util.Map;

public final class ApiException extends RuntimeException {
    public final int status;
    public final String code;
    public final Map<String, String> fields;
    public final Map<String, Object> details;

    public ApiException(int status, String code, String message) {
        this(status, code, message, Map.of(), Map.of());
    }
    public ApiException(int status, String code, String message, Map<String, String> fields, Map<String, Object> details) {
        super(message); this.status = status; this.code = code; this.fields = fields; this.details = details;
    }
    public Map<String, Object> body() {
        return Map.of("error", Map.of("code", code, "message", getMessage(), "field_errors", fields, "details", details));
    }
    public static ApiException query(String message) { return new ApiException(400, "INVALID_QUERY", message); }
    public static ApiException missing() { return new ApiException(404, "NOT_FOUND", "Incident not found."); }
    public static ApiException invalid(Map<String, String> fields) {
        return new ApiException(422, "VALIDATION_ERROR", "Please correct the highlighted fields.", fields, Map.of());
    }
    public static ApiException database(SQLException exception) {
        int code = exception.getErrorCode();
        String message = exception.getMessage() == null ? "" : exception.getMessage().toUpperCase();
        if (code == 2291) {
            if (message.contains("FK_INCIDENT_EMPLOYEE")) return invalid(Map.of("employee_id", "Choose an existing reporting employee."));
            if (message.contains("FK_INCIDENT_ACTOR")) return invalid(Map.of("threat_actor_id", "Choose an existing threat actor."));
            return invalid(Map.of("reference", "A referenced record does not exist."));
        }
        if (code == 2292) return new ApiException(409, "DEPENDENT_RECORDS", "This incident cannot be deleted while related records exist.");
        if (code == 1) return new ApiException(409, "CONFLICT", "A record with this unique value already exists.");
        if (code == 2290 || code == 1400 || code == 12899) return invalid(Map.of("record", "The record violates a database constraint."));
        if (code == 1017 || code == 28000 || code == 28001 || code == 17002 || code == 17008 || code == 17410 || code == 1033 || code == 1034 || code == 1089 || code == 3113 || code == 3114 || (code >= 12500 && code <= 12699) || exception instanceof java.sql.SQLTransientException || exception instanceof java.sql.SQLRecoverableException)
            return new ApiException(503, "DATABASE_UNAVAILABLE", "Database unavailable. Check the connection and try again.");
        return new ApiException(500, "INTERNAL_ERROR", "The server could not complete this operation.");
    }
}
