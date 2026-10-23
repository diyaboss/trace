package edu.project.trace;

import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import java.time.*;
import static org.junit.jupiter.api.Assertions.*;

class IncidentValidationTest {
    static ObjectNode input() {
        ObjectNode node = App.JSON.createObjectNode();
        node.put("title", "  Test incident  "); node.putNull("description"); node.put("severity", "HIGH"); node.put("status", "OPEN");
        node.put("detected_at", "2026-10-08T09:10:00+05:30"); node.putNull("resolved_at"); node.put("employee_id", 7); node.putNull("threat_actor_id");
        return node;
    }
    @Test void normalizesTextAndTime() {
        var node = input(); node.put("description", "  ");
        var record = IncidentInput.parse(node);
        assertEquals("Test incident", record.title()); assertNull(record.description());
        assertEquals(OffsetDateTime.parse("2026-10-08T03:40:00Z"), record.detected_at());
    }
    @Test void rejectsMissingNullableKeysAndUnknownFields() {
        var node = input(); node.remove("description");
        assertTrue(assertThrows(ApiException.class, () -> IncidentInput.parse(node)).fields.containsKey("description"));
        node.set("description", App.JSON.nullNode()); node.put("reporter_name", "Injected");
        assertEquals(400, assertThrows(ApiException.class, () -> IncidentInput.parse(node)).status);
    }
    @Test void checksAllFieldValues() {
        var node = input(); node.put("title", " "); node.put("description", "x".repeat(10001)); node.put("severity", "high");
        node.put("status", "INVALID"); node.put("employee_id", 1.5); node.put("threat_actor_id", "1"); node.put("detected_at", "2026-10-08T09:10:00");
        var error = assertThrows(ApiException.class, () -> IncidentInput.parse(node));
        assertEquals(422, error.status);
        for (String field : new String[]{"title","description","severity","status","employee_id","threat_actor_id","detected_at"}) assertTrue(error.fields.containsKey(field), field);
    }
    @Test void checksResolutionLifecycle() {
        var node = input(); node.put("status", "RESOLVED");
        assertTrue(assertThrows(ApiException.class, () -> IncidentInput.parse(node)).fields.containsKey("resolved_at"));
        node.put("resolved_at", "2026-10-08T03:39:00Z");
        assertThrows(ApiException.class, () -> IncidentInput.parse(node));
        node.put("resolved_at", "2026-10-08T03:40:00Z"); assertNotNull(IncidentInput.parse(node).resolved_at());
        node.put("status", "OPEN"); assertThrows(ApiException.class, () -> IncidentInput.parse(node));
    }
    @Test void handlesUnicodeAndIdBounds() {
        var node = input(); node.put("title", "🙂".repeat(160)); assertNotNull(IncidentInput.parse(node));
        node.put("title", "🙂".repeat(161)); assertThrows(ApiException.class, () -> IncidentInput.parse(node));
        assertEquals(9999999999L, IncidentInput.parseId("9999999999"));
        for (String id : new String[]{"0","-1","1.0","1e2","10000000000","1 OR 1=1"}) assertThrows(ApiException.class, () -> IncidentInput.parseId(id));
    }
    @Test void rejectsDuplicateJsonKeysAndTrailingContent() {
        assertThrows(com.fasterxml.jackson.core.JsonProcessingException.class, () -> App.JSON.readTree("{\"title\":\"a\",\"title\":\"b\"}"));
        assertThrows(com.fasterxml.jackson.core.JsonProcessingException.class, () -> App.JSON.readTree("{} {}"));
    }
    @Test void mapsOracleErrorsWithoutLeakingInternals() {
        var fk = ApiException.database(new java.sql.SQLException("ORA-02291 (TRACE_TEST.FK_INCIDENT_EMPLOYEE) secret", "23000", 2291));
        assertEquals(422, fk.status); assertTrue(fk.fields.containsKey("employee_id")); assertFalse(fk.body().toString().contains("secret"));
        assertEquals(409, ApiException.database(new java.sql.SQLException("", "", 2292)).status);
        assertEquals(503, ApiException.database(new java.sql.SQLException("", "", 17002)).status);
        assertEquals(500, ApiException.database(new java.sql.SQLException("", "", 942)).status);
    }
}
