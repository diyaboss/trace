package edu.project.trace;

import java.sql.*;
import java.time.*;
import java.util.*;

public final class IncidentDao {
    private final Db db;
    public IncidentDao(Db db) { this.db = db; }
    private static final String SELECT = """
        SELECT i.incident_id, i.title, i.description, i.severity, i.status,
               i.detected_at, i.resolved_at, i.employee_id,
               e.first_name || ' ' || e.last_name AS reporter_name,
               d.department_id, d.department_name, i.threat_actor_id,
               t.actor_name AS threat_actor_name
        FROM INCIDENT i
        JOIN EMPLOYEE e ON e.employee_id = i.employee_id
        JOIN DEPARTMENT d ON d.department_id = e.department_id
        LEFT JOIN THREAT_ACTOR t ON t.threat_actor_id = i.threat_actor_id
        """;
    public Map<String, Object> listIncidents(ExplorerQuery query) throws SQLException {
        try (Connection connection = db.open()) {
            connection.setAutoCommit(false);
            // A read-only Oracle transaction gives the count and rows the same snapshot.
            try (Statement transaction = connection.createStatement()) { transaction.execute("SET TRANSACTION READ ONLY"); }
            try {
                long total;
                try (PreparedStatement count = connection.prepareStatement("SELECT COUNT(*) FROM INCIDENT i" + query.where())) {
                    query.bind(count); try (ResultSet rows = count.executeQuery()) { rows.next(); total = rows.getLong(1); }
                }
                List<Incident> incidents = new ArrayList<>();
                try (PreparedStatement statement = connection.prepareStatement(query.pageSql(SELECT))) {
                    query.bindPage(statement); try (ResultSet rows = statement.executeQuery()) { while (rows.next()) incidents.add(read(rows)); }
                }
                connection.commit();
                return Map.of("data", incidents, "pagination", query.pagination(total));
            } catch (SQLException | RuntimeException e) { connection.rollback(); throw e; }
        }
    }
    public Incident getIncident(long id) throws SQLException {
        try (Connection connection = db.open()) { return getIncident(connection, id); }
    }
    private Incident getIncident(Connection connection, long id) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(SELECT + " WHERE i.incident_id = ?")) {
            statement.setLong(1, id); try (ResultSet rows = statement.executeQuery()) { if (!rows.next()) throw ApiException.missing(); return read(rows); }
        }
    }
    public Incident addIncident(IncidentInput input) throws SQLException {
        try (Connection connection = db.open()) {
            connection.setAutoCommit(false);
            try {
                long id;
                // NEXTVAL is allocated on this connection; sequence gaps on rollback are normal.
                try (PreparedStatement nextId = connection.prepareStatement("SELECT seq_incident.NEXTVAL FROM DUAL");
                     ResultSet keys = nextId.executeQuery()) {
                    if (!keys.next()) throw new SQLException("Missing sequence value");
                    id = keys.getLong(1);
                }
                try (PreparedStatement statement = connection.prepareStatement("""
                    INSERT INTO INCIDENT (title, description, severity, status, detected_at, resolved_at, employee_id, threat_actor_id, incident_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """)) {
                    bindInput(statement, input); statement.setLong(9, id); statement.executeUpdate();
                }
                Incident saved = getIncident(connection, id); connection.commit(); return saved;
            } catch (SQLException | RuntimeException e) { connection.rollback(); throw e; }
        }
    }
    public Incident updateIncident(long id, IncidentInput input) throws SQLException {
        try (Connection connection = db.open()) {
            connection.setAutoCommit(false);
            try {
                try (PreparedStatement statement = connection.prepareStatement("""
                    UPDATE INCIDENT SET title = ?, description = ?, severity = ?, status = ?,
                        detected_at = ?, resolved_at = ?, employee_id = ?, threat_actor_id = ?
                    WHERE incident_id = ?
                    """)) {
                    bindInput(statement, input); statement.setLong(9, id);
                    if (statement.executeUpdate() == 0) throw ApiException.missing();
                }
                Incident saved = getIncident(connection, id); connection.commit(); return saved;
            } catch (SQLException | RuntimeException e) { connection.rollback(); throw e; }
        }
    }
    public void deleteIncident(long id) throws SQLException {
        try (Connection connection = db.open(); PreparedStatement statement = connection.prepareStatement("DELETE FROM INCIDENT WHERE incident_id = ?")) {
            statement.setLong(1, id); if (statement.executeUpdate() == 0) throw ApiException.missing();
        }
    }
    private void bindInput(PreparedStatement statement, IncidentInput input) throws SQLException {
        statement.setString(1, input.title());
        if (input.description() == null) statement.setNull(2, Types.CLOB); else statement.setCharacterStream(2, new java.io.StringReader(input.description()));
        statement.setString(3, input.severity()); statement.setString(4, input.status()); statement.setObject(5, input.detected_at());
        if (input.resolved_at() == null) statement.setNull(6, Types.TIMESTAMP_WITH_TIMEZONE); else statement.setObject(6, input.resolved_at());
        statement.setLong(7, input.employee_id());
        if (input.threat_actor_id() == null) statement.setNull(8, Types.NUMERIC); else statement.setLong(8, input.threat_actor_id());
    }
    private static Incident read(ResultSet rows) throws SQLException {
        long actor = rows.getLong("threat_actor_id"); Long actorId = rows.wasNull() ? null : actor;
        OffsetDateTime resolved = rows.getObject("resolved_at", OffsetDateTime.class);
        return new Incident(rows.getLong("incident_id"), rows.getString("title"), rows.getString("description"), rows.getString("severity"), rows.getString("status"),
                rows.getObject("detected_at", OffsetDateTime.class).toInstant(), resolved == null ? null : resolved.toInstant(),
                rows.getLong("employee_id"), rows.getString("reporter_name"), rows.getLong("department_id"), rows.getString("department_name"), actorId, rows.getString("threat_actor_name"));
    }
}
