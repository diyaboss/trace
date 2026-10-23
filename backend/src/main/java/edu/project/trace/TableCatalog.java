package edu.project.trace;

import java.util.*;

public final class TableCatalog {
    public record Column(String key, String label, String type, boolean nullable, boolean sortable,
            boolean searchable, List<String> filter_operators, List<String> values) {}
    public record Table(String name, String label, String kind, List<String> primary_key, boolean can_create,
            boolean can_update, boolean can_delete, String default_sort, String default_order, List<Column> columns) {
        public Column column(String key) {
            return columns.stream().filter(c -> c.key().equals(key)).findFirst().orElseThrow(() -> ApiException.query("Unsupported column: " + key));
        }
    }
    private static Column column(String key, String label, String type, boolean nullable, boolean sortable, boolean searchable, String... operators) {
        return new Column(key, label, type, nullable, sortable, searchable, List.of(operators), null);
    }
    private static Column enumeration(String key, String label, List<String> values) {
        return new Column(key, label, "enum", false, true, false, List.of("eq", "ne"), values);
    }
    private static Table reference(String name, String label, String id, Column... columns) {
        return new Table(name, label, "entity", List.of(id), false, false, false, id, "asc", List.of(columns));
    }
    public static final Table INCIDENT = new Table("INCIDENT", "Incidents", "entity", List.of("incident_id"), true, true, true, "detected_at", "desc", List.of(
        column("incident_id", "Incident ID", "integer", false, true, false, "eq"),
        column("title", "Title", "text", false, true, true),
        column("description", "Description", "text", true, false, false),
        enumeration("severity", "Severity", IncidentInput.SEVERITIES), enumeration("status", "Status", IncidentInput.STATUSES),
        column("detected_at", "Detected at", "timestamp", false, true, false, "gte", "lt"),
        column("resolved_at", "Resolved at", "timestamp", true, true, false, "gte", "lt"),
        column("employee_id", "Reporter ID", "integer", false, false, false, "eq"),
        column("reporter_name", "Reporter", "text", false, false, false),
        column("department_id", "Department ID", "integer", false, false, false),
        column("department_name", "Department", "text", false, false, false),
        column("threat_actor_id", "Threat actor ID", "integer", true, false, false, "eq"),
        column("threat_actor_name", "Threat actor", "text", true, false, false)));
    private static final List<Table> TABLES = List.of(INCIDENT,
        reference("DEPARTMENT", "Departments", "department_id", column("department_id", "Department ID", "integer", false, true, false, "eq"), column("department_name", "Department name", "text", false, true, true)),
        reference("EMPLOYEE", "Employees", "employee_id", column("employee_id", "Employee ID", "integer", false, true, false, "eq"), column("first_name", "First name", "text", false, true, true), column("last_name", "Last name", "text", false, true, true), column("email", "Email", "text", false, true, true), column("designation", "Designation", "text", true, false, false), column("department_id", "Department ID", "integer", false, false, false, "eq")),
        reference("THREAT_ACTOR", "Threat actors", "threat_actor_id", column("threat_actor_id", "Threat actor ID", "integer", false, true, false, "eq"), column("actor_name", "Actor name", "text", false, true, true), column("actor_type", "Actor type", "text", true, false, false), column("suspected_origin", "Suspected origin", "text", true, false, false)));
    public static List<Table> all() { return TABLES; }
    public static Table get(String name) {
        return TABLES.stream().filter(t -> t.name().equals(name)).findFirst().orElseThrow(() -> new ApiException(404, "NOT_FOUND", "Table is not exposed."));
    }
    public static List<Map<String, Object>> payload() {
        return TABLES.stream().map(table -> {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("name", table.name()); result.put("label", table.label()); result.put("kind", table.kind()); result.put("primary_key", table.primary_key());
            result.put("can_create", table.can_create()); result.put("can_update", table.can_update()); result.put("can_delete", table.can_delete());
            result.put("default_sort", table.default_sort()); result.put("default_order", table.default_order());
            result.put("columns", table.columns().stream().map(column -> {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("key", column.key()); item.put("label", column.label()); item.put("type", column.type()); item.put("nullable", column.nullable());
                item.put("sortable", column.sortable()); item.put("searchable", column.searchable()); item.put("filter_operators", column.filter_operators());
                if (column.values() != null) item.put("values", column.values());
                return item;
            }).toList());
            return result;
        }).toList();
    }
}
