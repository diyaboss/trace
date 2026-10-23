package edu.project.trace;

import io.javalin.Javalin;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import java.net.*;
import java.net.http.*;
import java.sql.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

/** Real Oracle integration, opt-in, using a preinitialized dedicated TRACE_TEST schema. */
@EnabledIfEnvironmentVariable(named = "TRACE_TEST_DB_USER", matches = ".+")
class IncidentApiTest {
    static Db db;
    static Javalin app;
    static HttpClient client = HttpClient.newHttpClient();
    static String base;
    static List<Long> created = new ArrayList<>();
    @BeforeAll static void start() throws Exception {
        Assumptions.assumeTrue(Boolean.getBoolean("trace.test.database"), "Enable with -Dtrace.test.database=true");
        String user = System.getenv("TRACE_TEST_DB_USER");
        assertTrue(user.toUpperCase(Locale.ROOT).endsWith("_TEST"), "Integration username must end in _TEST");
        assertFalse(user.equalsIgnoreCase(System.getenv("TRACE_DB_USER")), "Use a separate schema");
        db = Db.environment("TRACE_TEST_DB_"); db.health();
        app = App.create(db, null).start("127.0.0.1", 0); base = "http://127.0.0.1:" + app.port();
    }
    @AfterAll static void stop() throws Exception {
        try {
            if (db != null) try (Connection connection = db.open(); PreparedStatement statement = connection.prepareStatement("DELETE FROM INCIDENT WHERE incident_id = ?")) {
                for (long id : created) { statement.setLong(1, id); statement.executeUpdate(); }
            }
        } finally { if (app != null) app.stop(); }
    }
    static HttpResponse<String> request(String method, String path, String body) throws Exception {
        return client.send(HttpRequest.newBuilder(URI.create(base + path)).header("Content-Type", "application/json")
                .method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString());
    }
    @Test void crudPersistsWithIndependentSqlAndRollsBackBadReplacement() throws Exception {
        var node = IncidentValidationTest.input(); String title = "Oracle " + UUID.randomUUID() + " employee's 100%_\\"; node.put("title", title);
        var added = request("POST", "/api/incidents", node.toString()); assertEquals(201, added.statusCode(), added.body());
        long id = App.JSON.readTree(added.body()).at("/data/incident_id").asLong(); created.add(id);
        assertTrue(id >= 1000 && id <= 9999999999L, "IDs come from seq_incident");
        assertEquals("/api/incidents/" + id, added.headers().firstValue("Location").orElseThrow());
        assertEquals("2026-10-08T03:40:00Z", App.JSON.readTree(added.body()).at("/data/detected_at").asText());
        assertEquals(title, sqlTitle(id));
        assertEquals(200, request("GET", "/api/incidents/" + id, null).statusCode());
        node.put("employee_id", 9999999999L); node.put("title", "must rollback");
        var rejected = request("PUT", "/api/incidents/" + id, node.toString()); assertEquals(422, rejected.statusCode(), rejected.body()); assertEquals(title, sqlTitle(id));
        node.put("employee_id", 7); node.put("status", "RESOLVED"); node.put("resolved_at", "2026-10-08T05:40:00+02:00");
        node.put("title", title + " updated"); var updated = request("PUT", "/api/incidents/" + id, node.toString()); assertEquals(200, updated.statusCode(), updated.body()); assertEquals(title + " updated", sqlTitle(id));
        // Cancellation sends no DELETE request; a second GET confirms it still exists.
        assertEquals(200, request("GET", "/api/incidents/" + id, null).statusCode());
        assertEquals(204, request("DELETE", "/api/incidents/" + id, null).statusCode()); assertNull(sqlTitle(id));
        assertEquals(404, request("GET", "/api/incidents/" + id, null).statusCode()); assertEquals(404, request("DELETE", "/api/incidents/" + id, null).statusCode());
    }
    @Test void literalSearchAndStablePaginationMatchBothIncidentEndpoints() throws Exception {
        var node = IncidentValidationTest.input(); String token = UUID.randomUUID().toString();
        for (String suffix : List.of("100%_\\'", "100abc")) {
            node.put("title", token + suffix); var response = request("POST", "/api/incidents", node.toString());
            assertEquals(201, response.statusCode(), response.body()); created.add(App.JSON.readTree(response.body()).at("/data/incident_id").asLong());
        }
        String literal = URLEncoder.encode(token + "100%_\\'", java.nio.charset.StandardCharsets.UTF_8);
        var matched = App.JSON.readTree(request("GET", "/api/incidents?q=" + literal, null).body()); assertEquals(1, matched.at("/pagination/total").asInt());
        String query = "?q=" + token + "&sort=title&order=asc&page_size=1";
        var first = App.JSON.readTree(request("GET", "/api/incidents" + query + "&page=1", null).body());
        var second = App.JSON.readTree(request("GET", "/api/incidents" + query + "&page=2", null).body());
        assertEquals(2, first.at("/pagination/total").asInt()); assertNotEquals(first.at("/data/0/incident_id"), second.at("/data/0/incident_id"));
        var generic = App.JSON.readTree(request("GET", "/api/tables/INCIDENT/rows" + query + "&page=1", null).body()); assertEquals(first.get("data"), generic.get("data"));
        assertTrue(App.JSON.readTree(request("GET", "/api/incidents" + query + "&page=3", null).body()).get("data").isEmpty());
    }
    @Test void healthReferencesAndMissingRecords() throws Exception {
        assertEquals(200, request("GET", "/api/health", null).statusCode());
        var node = IncidentValidationTest.input(); node.put("threat_actor_id", 9999999999L);
        var invalid = request("POST", "/api/incidents", node.toString()); assertEquals(422, invalid.statusCode()); assertTrue(App.JSON.readTree(invalid.body()).at("/error/field_errors").has("threat_actor_id"));
        assertEquals(404, request("GET", "/api/incidents/9999999999", null).statusCode());
        for (String table : List.of("DEPARTMENT", "EMPLOYEE", "THREAT_ACTOR")) assertEquals(200, request("GET", "/api/tables/" + table + "/rows", null).statusCode());
        assertEquals(400, request("GET", "/api/tables/DEPARTMENT/rows?sort=password", null).statusCode());
    }
    static String sqlTitle(long id) throws Exception {
        try (Connection connection = db.open(); PreparedStatement statement = connection.prepareStatement("SELECT title FROM INCIDENT WHERE incident_id = ?")) {
            statement.setLong(1, id); try (ResultSet rows = statement.executeQuery()) { return rows.next() ? rows.getString(1) : null; }
        }
    }
}
