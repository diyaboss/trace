package edu.project.trace;

import java.sql.*;
import java.util.*;

public final class TableDao {
    private final Db db;
    private final IncidentDao incidents;
    public TableDao(Db db, IncidentDao incidents) { this.db = db; this.incidents = incidents; }
    public Map<String, Object> rows(TableCatalog.Table table, ExplorerQuery query) throws SQLException {
        if (table.name().equals("INCIDENT")) {
            Map<String, Object> result = new LinkedHashMap<>(incidents.listIncidents(query)); result.put("table", "INCIDENT"); return result;
        }
        // Every identifier below originates in TableCatalog, never a raw request value.
        String columns = String.join(", ", table.columns().stream().map(TableCatalog.Column::key).toList());
        try (Connection connection = db.open()) {
            connection.setAutoCommit(false);
            try (Statement transaction = connection.createStatement()) { transaction.execute("SET TRANSACTION READ ONLY"); }
            try {
                long total;
                try (PreparedStatement statement = connection.prepareStatement("SELECT COUNT(*) FROM " + table.name() + query.where())) {
                    query.bind(statement); try (ResultSet rows = statement.executeQuery()) { rows.next(); total = rows.getLong(1); }
                }
                List<Map<String, Object>> data = new ArrayList<>();
                try (PreparedStatement statement = connection.prepareStatement(query.pageSql("SELECT " + columns + " FROM " + table.name()))) {
                    query.bindPage(statement);
                    try (ResultSet rows = statement.executeQuery()) {
                        while (rows.next()) {
                            Map<String, Object> row = new LinkedHashMap<>();
                            for (var column : table.columns()) row.put(column.key(), column.type().equals("integer") ? rows.getLong(column.key()) : rows.getString(column.key()));
                            data.add(row);
                        }
                    }
                }
                connection.commit(); return Map.of("table", table.name(), "data", data, "pagination", query.pagination(total));
            } catch (SQLException | RuntimeException e) { connection.rollback(); throw e; }
        }
    }
}
