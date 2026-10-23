package edu.project.trace;

import io.javalin.http.Context;
import java.sql.SQLException;
import java.util.Map;

public final class TableRoutes {
    private final TableDao dao;
    public TableRoutes(TableDao dao) { this.dao = dao; }
    public void catalog(Context ctx) {
        if (!ctx.queryParamMap().isEmpty()) throw ApiException.query("Catalog does not accept query parameters.");
        ctx.json(Map.of("data", TableCatalog.payload()));
    }
    public void rows(Context ctx) throws SQLException {
        var table = TableCatalog.get(ctx.pathParam("table"));
        ctx.json(dao.rows(table, ExplorerQuery.parse(table, ctx.queryParamMap())));
    }
}
