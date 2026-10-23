package edu.project.trace;

import java.sql.*;
import java.time.*;
import java.util.*;

/** Validates HTTP query parameters against the hand-authored catalog. No client SQL is accepted. */
public record ExplorerQuery(int page, int page_size, String sort, String order, String where,
        String orderBy, List<Object> bindings) {
    private static final Map<String, String> OPERATORS = Map.of("eq", "=", "ne", "<>", "gte", ">=", "lt", "<");
    public static ExplorerQuery parse(TableCatalog.Table table, Map<String, List<String>> parameters) {
        Map<String, String> values = new LinkedHashMap<>();
        for (var entry : parameters.entrySet()) {
            if (entry.getValue().size() != 1) throw ApiException.query("Duplicate query parameter: " + entry.getKey());
            values.put(entry.getKey(), entry.getValue().getFirst());
        }
        int page = integer(values.getOrDefault("page", "1"), 1, Integer.MAX_VALUE, "page");
        int size = integer(values.getOrDefault("page_size", "25"), 1, 50, "page_size");
        String sort = values.getOrDefault("sort", table.default_sort());
        if (!table.column(sort).sortable()) throw ApiException.query("This column cannot be sorted.");
        String order = values.getOrDefault("order", table.default_order());
        if (!Set.of("asc", "desc").contains(order)) throw ApiException.query("Order must be asc or desc.");
        String prefix = table.name().equals("INCIDENT") ? "i." : "";
        List<String> clauses = new ArrayList<>(); List<Object> bindings = new ArrayList<>();
        int filters = 0;
        for (var entry : values.entrySet()) {
            String key = entry.getKey(), value = entry.getValue();
            if (Set.of("page", "page_size", "sort", "order").contains(key)) continue;
            if (key.equals("q")) {
                if (value.codePointCount(0, value.length()) > 100) throw ApiException.query("Search must contain at most 100 characters.");
                if (!value.isEmpty()) {
                    List<String> search = new ArrayList<>();
                    for (var column : table.columns()) if (column.searchable()) {
                        search.add("LOWER(" + prefix + column.key() + ") LIKE LOWER(?) ESCAPE '\\'");
                        bindings.add("%" + escape(value) + "%");
                    }
                    clauses.add("(" + String.join(" OR ", search) + ")");
                }
                continue;
            }
            String[] parts = key.split("\\.", -1);
            if (parts.length != 3 || !parts[0].equals("filter")) throw ApiException.query("Unsupported query parameter: " + key);
            if (++filters > 8) throw ApiException.query("Use at most eight filter terms.");
            var column = table.column(parts[1]); String operator = parts[2];
            if (!column.filter_operators().contains(operator)) throw ApiException.query("Unsupported filter operator for " + column.key());
            Object binding;
            try {
                binding = switch (column.type()) {
                    case "integer" -> IncidentInput.parseId(value);
                    case "timestamp" -> IncidentInput.parseTimestamp(value);
                    case "enum" -> { if (!column.values().contains(value)) throw ApiException.query("Invalid enum filter value."); yield value; }
                    default -> throw ApiException.query("Unsupported filter type.");
                };
            } catch (DateTimeException e) { throw ApiException.query("Use an ISO filter timestamp with an explicit timezone."); }
            clauses.add(prefix + column.key() + " " + OPERATORS.get(operator) + " ?"); bindings.add(binding);
        }
        String orderBy;
        if (table.name().equals("INCIDENT") && sort.equals("severity")) {
            orderBy = "CASE i.severity WHEN 'LOW' THEN 1 WHEN 'MEDIUM' THEN 2 WHEN 'HIGH' THEN 3 WHEN 'CRITICAL' THEN 4 END " + order + " NULLS LAST, i.detected_at DESC, i.incident_id DESC";
        } else {
            orderBy = prefix + sort + " " + order + " NULLS LAST";
            if (!table.primary_key().contains(sort)) orderBy += ", " + prefix + table.primary_key().getFirst() + " " + order;
        }
        return new ExplorerQuery(page, size, sort, order, clauses.isEmpty() ? "" : " WHERE " + String.join(" AND ", clauses), orderBy, List.copyOf(bindings));
    }
    private static int integer(String value, int min, int max, String field) {
        try { if (!value.matches("[0-9]+")) throw new NumberFormatException(); int number = Integer.parseInt(value); if (number < min || number > max) throw new NumberFormatException(); return number; }
        catch (NumberFormatException e) { throw ApiException.query(field + " must be an integer between " + min + " and " + max + "."); }
    }
    public static String escape(String value) { return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_"); }
    public int bind(PreparedStatement statement) throws SQLException {
        int index = 1;
        for (Object value : bindings) { if (value instanceof OffsetDateTime time) statement.setObject(index++, time); else statement.setObject(index++, value); }
        return index;
    }
    public void bindPage(PreparedStatement statement) throws SQLException {
        int index = bind(statement);
        statement.setLong(index++, upperBound()); statement.setLong(index, lowerBound());
    }
    public long lowerBound() { return ((long) page - 1) * page_size; }
    public long upperBound() { return (long) page * page_size; }
    /** Called only with fixed DAO SELECT fragments, not client-provided SQL. */
    public String pageSql(String select) {
        // Sort before assigning ROWNUM; an outer ROWNUM > offset predicate alone never works.
        return """
            SELECT * FROM (
                SELECT ordered_rows.*, ROWNUM AS trace_row_number
                FROM (
                    %s
                    ORDER BY %s
                ) ordered_rows
                WHERE ROWNUM <= ?
            )
            WHERE trace_row_number > ?
            ORDER BY trace_row_number
            """.formatted(select + where, orderBy);
    }
    public Map<String, Object> pagination(long total) { return Map.of("page", page, "page_size", page_size, "total", total); }
}
