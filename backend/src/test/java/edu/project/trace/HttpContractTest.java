package edu.project.trace;

import io.javalin.Javalin;
import org.junit.jupiter.api.*;
import java.net.*;
import java.net.http.*;
import static org.junit.jupiter.api.Assertions.*;

/** Uses an unreachable Oracle address to test HTTP behavior; never substitutes a fake database. */
class HttpContractTest {
    static Javalin app;
    static HttpClient client = HttpClient.newHttpClient();
    static String base;
    @BeforeAll static void start() {
        app = App.create(new Db("jdbc:oracle:thin:@127.0.0.1:1:XE", "TRACE_CONTRACT", "unavailable"), null).start("127.0.0.1", 0);
        base = "http://127.0.0.1:" + app.port();
    }
    @AfterAll static void stop() { if (app != null) app.stop(); }
    static HttpResponse<String> request(String method, String path, String body) throws Exception {
        return client.send(HttpRequest.newBuilder(URI.create(base + path)).header("Content-Type", "application/json")
            .method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString());
    }
    @Test void catalogWorksWithoutDatabaseAndUnknownRoutesHaveSharedErrors() throws Exception {
        var response = request("GET", "/api/tables", null); assertEquals(200, response.statusCode());
        assertEquals(4, App.JSON.readTree(response.body()).get("data").size());
        assertEquals(404, request("GET", "/api/tables/UNKNOWN/rows", null).statusCode());
        var unknown = request("GET", "/api/no-such-route", null); assertEquals(404, unknown.statusCode()); assertTrue(App.JSON.readTree(unknown.body()).has("error"));
    }
    @Test void healthMustQueryOracleAndReturnUsefulUnavailableError() throws Exception {
        var response = request("GET", "/api/health", null); assertEquals(503, response.statusCode());
        assertEquals("DATABASE_UNAVAILABLE", App.JSON.readTree(response.body()).at("/error/code").asText());
        assertFalse(response.body().contains("127.0.0.1"));
    }
    @Test void validationIsBeforeDatabaseAccess() throws Exception {
        assertEquals(400, request("POST", "/api/incidents", "{").statusCode());
        assertEquals(422, request("POST", "/api/incidents", "{}").statusCode());
        var node = IncidentValidationTest.input(); node.put("title", " ");
        var response = request("PUT", "/api/incidents/101", node.toString());
        assertEquals(422, response.statusCode()); assertTrue(App.JSON.readTree(response.body()).at("/error/field_errors").has("title"));
        assertEquals(400, request("GET", "/api/incidents?sort=bad", null).statusCode());
        assertEquals(400, request("GET", "/api/incidents/0", null).statusCode());
    }
    @Test void bodyLimitsAndReadBodiesAreEnforced() throws Exception {
        var large = request("POST", "/api/incidents", " ".repeat(65537)); assertEquals(413, large.statusCode()); assertTrue(App.JSON.readTree(large.body()).has("error"));
        assertEquals(400, request("GET", "/api/tables", "{}").statusCode());
        assertEquals(400, request("DELETE", "/api/incidents/101", "{}").statusCode());
        assertEquals(400, request("GET", "/api/incidents?filter.status.eq=OPEN&filter.status.eq=RESOLVED", null).statusCode());
    }
}
