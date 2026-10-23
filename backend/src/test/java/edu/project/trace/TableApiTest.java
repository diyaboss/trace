package edu.project.trace;

import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class TableApiTest {
    private ExplorerQuery incident(Map<String, List<String>> query) { return ExplorerQuery.parse(TableCatalog.INCIDENT, query); }
    @Test void bindsQuotesAndEscapesWildcards() {
        var query = incident(Map.of("q", List.of("employee's 100%_\\")));
        assertFalse(query.where().contains("employee"));
        assertEquals(List.of("%employee's 100\\%\\_\\\\%"), query.bindings());
        assertTrue(query.where().contains("ESCAPE '\\'"));
    }
    @Test void semanticSeverityAndNullsLast() {
        var query = incident(Map.of("sort", List.of("severity"), "order", List.of("desc")));
        assertTrue(query.orderBy().contains("WHEN 'CRITICAL' THEN 4"));
        assertTrue(query.orderBy().endsWith("i.detected_at DESC, i.incident_id DESC"));
        assertEquals("i.resolved_at asc NULLS LAST, i.incident_id asc", incident(Map.of("sort", List.of("resolved_at"), "order", List.of("asc"))).orderBy());
    }
    @Test void rejectsUntrustedIdentifiersAndInvalidBounds() {
        for (var query : List.of(Map.of("sort", List.of("title; DROP TABLE INCIDENT")), Map.of("order", List.of("descending")),
                Map.of("filter.title.eq", List.of("hello")), Map.of("page_size", List.of("51")), Map.of("page", List.of("0")),
                Map.of("page", List.of("1.5")), Map.of("filter.status.eq", List.of("BOGUS")), Map.of("sql", List.of("SELECT 1")),
                Map.of("filter.detected_at.gte", List.of("2026-10-08")), Map.of("filter.employee_id.eq", List.of("0")))) {
            assertEquals(400, assertThrows(ApiException.class, () -> incident(query)).status);
        }
        assertEquals(404, assertThrows(ApiException.class, () -> TableCatalog.get("SYS.USER$")).status);
    }
    @Test void rejectsDuplicatesAndNinthFilter() {
        assertThrows(ApiException.class, () -> incident(Map.of("filter.status.eq", List.of("OPEN", "RESOLVED"))));
        Map<String,List<String>> query = new LinkedHashMap<>();
        query.put("filter.severity.eq", List.of("HIGH")); query.put("filter.severity.ne", List.of("LOW"));
        query.put("filter.status.eq", List.of("OPEN")); query.put("filter.status.ne", List.of("RESOLVED"));
        query.put("filter.incident_id.eq", List.of("1")); query.put("filter.employee_id.eq", List.of("1")); query.put("filter.threat_actor_id.eq", List.of("1"));
        query.put("filter.detected_at.gte", List.of("2026-10-01T00:00:00Z"));
        assertEquals(8, incident(query).bindings().size());
        query.put("filter.detected_at.lt", List.of("2026-10-09T00:00:00Z")); assertThrows(ApiException.class, () -> incident(query));
    }
    @Test void catalogMatchesReferenceReadsAndCapabilities() {
        assertEquals(4, TableCatalog.all().size());
        for (var table : TableCatalog.all()) {
            assertEquals(table.name().equals("INCIDENT"), table.can_create());
            assertTrue(table.column(table.default_sort()).sortable());
        }
        var employees = ExplorerQuery.parse(TableCatalog.get("EMPLOYEE"), Map.of("q", List.of("maya"), "filter.department_id.eq", List.of("1")));
        assertEquals(4, employees.bindings().size()); assertTrue(employees.where().contains(" OR "));
        assertEquals(1, incident(Map.of()).page()); assertEquals(25, incident(Map.of()).page_size());
        assertEquals(2147483647, incident(Map.of("page", List.of("2147483647"))).page());
    }
    @Test void elevenGPaginationSortsBeforeRownumAndBindsUpperThenLower() throws Exception {
        var query = incident(Map.of("page", List.of("2"), "page_size", List.of("25"), "sort", List.of("severity"), "q", List.of("finance")));
        String sql = query.pageSql("SELECT i.incident_id, i.title FROM INCIDENT i");
        assertTrue(sql.indexOf("ORDER BY CASE") < sql.indexOf("WHERE ROWNUM <= ?"));
        assertTrue(sql.contains("WHERE trace_row_number > ?"));
        assertTrue(sql.stripTrailing().endsWith("ORDER BY trace_row_number"));
        assertFalse(sql.contains("OFFSET")); assertFalse(sql.contains("FETCH"));
        assertEquals(25, query.lowerBound()); assertEquals(50, query.upperBound());
        Map<Integer, Object> bound = new HashMap<>();
        var statement = (java.sql.PreparedStatement) java.lang.reflect.Proxy.newProxyInstance(getClass().getClassLoader(), new Class[]{java.sql.PreparedStatement.class}, (proxy, method, args) -> {
            if (method.getName().startsWith("set") && args.length == 2) bound.put((Integer) args[0], args[1]);
            return null;
        });
        query.bindPage(statement);
        assertEquals("%finance%", bound.get(1)); assertEquals(50L, bound.get(2)); assertEquals(25L, bound.get(3));
        var largePage = incident(Map.of("page", List.of("2147483647"), "page_size", List.of("50")));
        assertEquals(107374182350L, largePage.upperBound()); assertEquals(107374182300L, largePage.lowerBound());
    }
}
