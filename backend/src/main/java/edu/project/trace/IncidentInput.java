package edu.project.trace;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.*;
import java.util.*;

public record IncidentInput(String title, String description, String severity, String status,
        OffsetDateTime detected_at, OffsetDateTime resolved_at, long employee_id, Long threat_actor_id) {
    public static final List<String> SEVERITIES = List.of("LOW", "MEDIUM", "HIGH", "CRITICAL");
    public static final List<String> STATUSES = List.of("OPEN", "INVESTIGATING", "CONTAINED", "RESOLVED");
    private static final Set<String> KEYS = Set.of("title", "description", "severity", "status", "detected_at", "resolved_at", "employee_id", "threat_actor_id");

    public static IncidentInput parse(JsonNode node) {
        if (!node.isObject()) throw new ApiException(400, "INVALID_REQUEST", "Send a JSON object.");
        node.fieldNames().forEachRemaining(key -> { if (!KEYS.contains(key)) throw new ApiException(400, "INVALID_REQUEST", "Unsupported input field: " + key); });
        Map<String, String> errors = new LinkedHashMap<>();
        for (String key : KEYS) if (!node.has(key)) errors.put(key, "Include this field, using null when allowed.");
        String title = text(node, "title", false, 160, errors);
        String description = text(node, "description", true, 10000, errors);
        String severity = enumeration(node, "severity", SEVERITIES, errors);
        String status = enumeration(node, "status", STATUSES, errors);
        OffsetDateTime detected = timestamp(node, "detected_at", false, errors);
        OffsetDateTime resolved = timestamp(node, "resolved_at", true, errors);
        Long employee = identifier(node, "employee_id", false, errors);
        Long actor = identifier(node, "threat_actor_id", true, errors);
        if ("RESOLVED".equals(status) && resolved == null) errors.put("resolved_at", "Enter a resolution timestamp for a resolved incident.");
        if (status != null && !"RESOLVED".equals(status) && resolved != null) errors.put("resolved_at", "Only resolved incidents may have a resolution timestamp.");
        if (detected != null && resolved != null && resolved.isBefore(detected)) errors.put("resolved_at", "Resolution time cannot be earlier than detection time.");
        if (!errors.isEmpty()) throw ApiException.invalid(errors);
        return new IncidentInput(title, description, severity, status, detected, resolved, employee, actor);
    }
    private static String text(JsonNode node, String key, boolean nullable, int max, Map<String, String> errors) {
        JsonNode value = node.get(key);
        if (value == null || value.isNull()) { if (!nullable) errors.put(key, "Enter a value."); return null; }
        if (!value.isTextual()) { errors.put(key, "Enter text."); return null; }
        String result = value.textValue().strip();
        if (result.isEmpty()) { if (!nullable) errors.put(key, "Enter a value."); return null; }
        if (result.codePointCount(0, result.length()) > max) errors.put(key, "Use at most " + max + " characters.");
        return result;
    }
    private static String enumeration(JsonNode node, String key, List<String> allowed, Map<String, String> errors) {
        JsonNode value = node.get(key);
        if (value == null || !value.isTextual() || !allowed.contains(value.textValue())) { errors.put(key, "Choose one of: " + String.join(", ", allowed)); return null; }
        return value.textValue();
    }
    private static Long identifier(JsonNode node, String key, boolean nullable, Map<String, String> errors) {
        JsonNode value = node.get(key);
        if (value != null && value.isNull() && nullable) return null;
        if (value == null || !value.isIntegralNumber() || !value.canConvertToLong() || value.longValue() < 1 || value.longValue() > 9999999999L) {
            errors.put(key, "Use a positive integer no greater than 9999999999."); return null;
        }
        return value.longValue();
    }
    private static OffsetDateTime timestamp(JsonNode node, String key, boolean nullable, Map<String, String> errors) {
        JsonNode value = node.get(key);
        if (value != null && value.isNull() && nullable) return null;
        try { if (value == null || !value.isTextual()) throw new DateTimeException("text required"); return parseTimestamp(value.textValue()); }
        catch (DateTimeException e) { errors.put(key, "Use an ISO timestamp with an explicit timezone."); return null; }
    }
    public static OffsetDateTime parseTimestamp(String value) {
        OffsetDateTime time = OffsetDateTime.parse(value).withOffsetSameInstant(ZoneOffset.UTC);
        if (time.getYear() < 1 || time.getYear() > 9999) throw new DateTimeException("Unsupported year");
        return time;
    }
    public static long parseId(String value) {
        if (value == null || !value.matches("[0-9]{1,10}")) throw ApiException.query("Use a positive integer ID.");
        long id = Long.parseLong(value);
        if (id < 1 || id > 9999999999L) throw ApiException.query("Use a positive integer ID.");
        return id;
    }
}
