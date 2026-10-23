package edu.project.trace;

import io.javalin.http.Context;
import java.sql.SQLException;
import java.util.Map;

public final class IncidentRoutes {
    private final IncidentDao dao;
    public IncidentRoutes(IncidentDao dao) { this.dao = dao; }
    public void list(Context ctx) throws SQLException { ctx.json(dao.listIncidents(ExplorerQuery.parse(TableCatalog.INCIDENT, ctx.queryParamMap()))); }
    public void get(Context ctx) throws SQLException { noQuery(ctx); ctx.json(Map.of("data", dao.getIncident(IncidentInput.parseId(ctx.pathParam("id"))))); }
    public void add(Context ctx) throws Exception {
        Incident saved = dao.addIncident(input(ctx));
        ctx.status(201).header("Location", "/api/incidents/" + saved.incident_id()).json(Map.of("data", saved));
    }
    public void update(Context ctx) throws Exception {
        long id = IncidentInput.parseId(ctx.pathParam("id"));
        ctx.json(Map.of("data", dao.updateIncident(id, input(ctx))));
    }
    public void delete(Context ctx) throws SQLException { noQuery(ctx); dao.deleteIncident(IncidentInput.parseId(ctx.pathParam("id"))); ctx.status(204); }
    private void noQuery(Context ctx) { if (!ctx.queryParamMap().isEmpty()) throw ApiException.query("This endpoint does not accept query parameters."); }
    private IncidentInput input(Context ctx) throws Exception {
        String contentType = ctx.contentType();
        if (contentType == null || !contentType.split(";", 2)[0].strip().equalsIgnoreCase("application/json"))
            throw new ApiException(400, "INVALID_REQUEST", "Use Content-Type: application/json.");
        if (!ctx.queryParamMap().isEmpty()) throw ApiException.query("Writes do not accept query parameters.");
        var tree = App.JSON.readTree(ctx.body());
        if (tree == null) throw new ApiException(400, "INVALID_REQUEST", "Send a JSON object.");
        return IncidentInput.parse(tree);
    }
}
