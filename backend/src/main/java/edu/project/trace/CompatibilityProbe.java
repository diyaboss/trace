package edu.project.trace;

import java.sql.*;
import java.time.*;
import java.util.*;

/** Read-only smoke test. A pass is experimental evidence, never a certification claim. */
public final class CompatibilityProbe {
    private CompatibilityProbe() {}
    public static void check(Db db) throws SQLException {
        try (Connection connection = db.open()) {
            DatabaseMetaData metadata = connection.getMetaData();
            System.out.println("Java: " + System.getProperty("java.version") + " (" + System.getProperty("java.vendor") + ")");
            System.out.println("JDBC: " + metadata.getDriverName() + " " + metadata.getDriverVersion());
            System.out.println("Database: " + metadata.getDatabaseProductName() + " " + metadata.getDatabaseProductVersion().replace('\n', ' '));
            connection.setAutoCommit(false);
            try (Statement statement = connection.createStatement()) { statement.execute("SET TRANSACTION READ ONLY"); }
            try {
                try (PreparedStatement statement = connection.prepareStatement("SELECT 1 FROM DUAL"); ResultSet rows = statement.executeQuery()) {
                    if (!rows.next() || rows.getInt(1) != 1) throw new SQLException("Health query failed");
                }
                OffsetDateTime input = OffsetDateTime.parse("2026-10-08T09:10:00.123+05:30");
                try (PreparedStatement statement = connection.prepareStatement("SELECT CAST(? AS TIMESTAMP(3) WITH TIME ZONE) AS probe_time FROM DUAL")) {
                    statement.setObject(1, input);
                    try (ResultSet rows = statement.executeQuery()) {
                        if (!rows.next() || !input.toInstant().equals(rows.getObject("probe_time", OffsetDateTime.class).toInstant()))
                            throw new SQLException("Timestamp binding/readback failed");
                    }
                }
                ExplorerQuery query = ExplorerQuery.parse(TableCatalog.get("DEPARTMENT"), Map.of("page", List.of("2"), "page_size", List.of("2")));
                String generatedRows = """
                    SELECT LEVEL AS department_id, 'Probe' AS department_name
                    FROM DUAL CONNECT BY LEVEL <= 5
                    """;
                try (PreparedStatement statement = connection.prepareStatement(query.pageSql(generatedRows))) {
                    query.bindPage(statement);
                    try (ResultSet rows = statement.executeQuery()) {
                        if (!rows.next() || rows.getLong("department_id") != 3 || !rows.next() || rows.getLong("department_id") != 4 || rows.next())
                            throw new SQLException("ROWNUM pagination failed");
                    }
                }
                String text = "Employee's 100%_\\";
                try (PreparedStatement statement = connection.prepareStatement("""
                    SELECT TO_CLOB(?) AS probe_text FROM DUAL
                    WHERE LOWER(?) LIKE LOWER(?) ESCAPE '\\'
                    """)) {
                    statement.setString(1, text); statement.setString(2, text); statement.setString(3, "%" + ExplorerQuery.escape(text) + "%");
                    try (ResultSet rows = statement.executeQuery()) {
                        if (!rows.next() || !text.equals(rows.getString("probe_text"))) throw new SQLException("CLOB/literal-search read failed");
                    }
                }
                connection.rollback();
                System.out.println("PASS: read-only health, timestamp binding/readback, ROWNUM pagination, CLOB and literal-search checks.");
                System.out.println("Experimental result only. No writes or DDL ran; sequence CRUD and full Oracle integration still require separate verification.");
            } catch (SQLException | RuntimeException e) { connection.rollback(); throw e; }
        }
    }
}
