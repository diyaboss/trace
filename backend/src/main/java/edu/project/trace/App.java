package edu.project.trace;

import com.fasterxml.jackson.core.JsonFactory;
import com.fasterxml.jackson.core.StreamReadFeature;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import io.javalin.Javalin;
import io.javalin.http.HttpResponseException;
import io.javalin.http.staticfiles.Location;
import io.javalin.json.JavalinJackson;
import java.nio.file.*;
import java.sql.SQLException;
import java.util.Map;

public final class App {
    public static final ObjectMapper JSON = new ObjectMapper(JsonFactory.builder().enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION).build())
            .registerModule(new JavaTimeModule()).disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);

    public static Javalin create(Db db, Path frontend) {
        var incidents = new IncidentRoutes(new IncidentDao(db));
        var tables = new TableRoutes(new TableDao(db, new IncidentDao(db)));
        return Javalin.create(config -> {
            config.http.maxRequestSize = 65536;
            config.http.defaultContentType = "application/json; charset=utf-8";
            config.jsonMapper(new JavalinJackson(JSON, false));
            config.jetty.host = "127.0.0.1";
            if (frontend != null && Files.isRegularFile(frontend.resolve("index.html"))) {
                config.staticFiles.add(files -> { files.directory = frontend.toAbsolutePath().toString(); files.location = Location.EXTERNAL; });
                config.routes.get("/", ctx -> ctx.contentType("text/html; charset=utf-8").result(Files.readString(frontend.resolve("index.html"))));
                config.routes.get("/explore", ctx -> ctx.contentType("text/html; charset=utf-8").result(Files.readString(frontend.resolve("index.html"))));
            }
            config.routes.before("/api/*", ctx -> {
                ctx.header("Cache-Control", "no-store");
                if (ctx.method().name().equals("GET") || ctx.method().name().equals("DELETE")) {
                    if (!ctx.body().isEmpty()) throw new ApiException(400, "INVALID_REQUEST", "GET and DELETE requests do not accept a body.");
                }
            });
            config.routes.get("/api/health", ctx -> {
                if (!ctx.queryParamMap().isEmpty()) throw ApiException.query("Health does not accept query parameters.");
                try { db.health(); } catch (SQLException e) { throw new ApiException(503, "DATABASE_UNAVAILABLE", "Database unavailable. Check the connection and try again."); }
                ctx.json(Map.of("status", "ok", "database", "connected"));
            });
            config.routes.get("/api/incidents", incidents::list);
            config.routes.get("/api/incidents/{id}", incidents::get);
            config.routes.post("/api/incidents", incidents::add);
            config.routes.put("/api/incidents/{id}", incidents::update);
            config.routes.delete("/api/incidents/{id}", incidents::delete);
            config.routes.get("/api/tables", tables::catalog);
            config.routes.get("/api/tables/{table}/rows", tables::rows);
            config.routes.exception(ApiException.class, (e, ctx) -> ctx.status(e.status).json(e.body()));
            config.routes.exception(JsonProcessingException.class, (e, ctx) -> ctx.status(400).json(new ApiException(400, "INVALID_JSON", "Send valid JSON with no duplicate keys or trailing content.").body()));
            config.routes.exception(SQLException.class, (e, ctx) -> {
                var safe = ApiException.database(e); ctx.status(safe.status).json(safe.body());
                System.err.println("Database operation failed (Oracle code " + e.getErrorCode() + ").");
            });
            config.routes.exception(HttpResponseException.class, (e, ctx) -> ctx.status(e.getStatus()).json(new ApiException(e.getStatus(), "INVALID_REQUEST", e.getStatus() == 413 ? "Request body exceeds 64 KiB." : "The request could not be processed.").body()));
            config.routes.exception(Exception.class, (e, ctx) -> {
                System.err.println("Unexpected server failure: " + e.getClass().getSimpleName());
                ctx.status(500).json(new ApiException(500, "INTERNAL_ERROR", "The server could not complete this operation.").body());
            });
            config.routes.error(404, ctx -> ctx.json(new ApiException(404, "NOT_FOUND", "Resource not found.").body()));
        });
    }
    public static void main(String[] args) {
        try {
            Db db = Db.environment("TRACE_DB_");
            if (args.length == 1 && args[0].equals("--check-database")) {
                try { CompatibilityProbe.check(db); }
                catch (SQLException e) {
                    System.err.println("Database probe failed (Oracle code " + e.getErrorCode() + "). Check local configuration; no compatibility claim is established.");
                    System.exit(2);
                }
                return;
            }
            if (args.length != 0) throw new IllegalArgumentException("Use no arguments to start, or --check-database for the read-only probe.");
            int port = Integer.parseInt(System.getenv().getOrDefault("TRACE_PORT", "7000"));
            Path frontend = Path.of(System.getenv().getOrDefault("TRACE_FRONTEND_DIST", "../frontend/dist"));
            Javalin app = create(db, frontend).start("127.0.0.1", port);
            Runtime.getRuntime().addShutdownHook(new Thread(app::stop));
        } catch (IllegalArgumentException e) { System.err.println("Trace configuration error: " + e.getMessage()); System.exit(1); }
    }
}
