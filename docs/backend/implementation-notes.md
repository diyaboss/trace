# Implementation notes

An HTTP route validates and calls a DAO. The DAO opens a JDBC connection, prepares SQL, binds values, reads rows, and closes resources. There is no ORM, service layer, dependency injection, pool, universal write engine, or fake database.

`IncidentInput` parses a Jackson JSON tree deliberately: it distinguishes a missing nullable key from a present null and rejects coerced string/fractional IDs. Strict parser settings reject duplicate keys and trailing JSON. Enums are exact; timestamps require an offset. Foreign-key existence is enforced by Oracle, with named constraint errors mapped to field errors.

`ExplorerQuery` is a small validation/query helper, not an additional application layer. It uses catalog definitions to choose fixed column names and operator fragments. Values are bound. Search uses case-insensitive literal substring patterns with escaped backslash, percent, and underscore. All filters AND together. Count and rows share identical predicates and a single read-only Oracle transaction snapshot. Pagination offsets use long arithmetic. Sorting is deterministic with nulls last; severity has semantic ranking plus detected_at/ID tie-breakers.

Create and replacement-update explicitly disable auto-commit, execute the mutation, read the joined returned record on the same connection, then commit. A failed read or constraint rolls back the mutation. Deletes are one statement with ordinary restrictive FK enforcement. Creation explicitly selects SEQ_INCIDENT.NEXTVAL on that connection and binds it into INSERT. No generated-key/ROWID assumption remains; rollback can leave a sequence gap.

Oracle 11g pagination uses a sorted inner SELECT, middle ROWNUM upper bound, then outer numbered-row lower bound/order. Limits are bound as longs (upper bound first, lower bound second). The internal row number is ignored by row mapping and never enters the API payload. Semantic sorts and PK tie-breakers remain inside the sorted SELECT. See oracle-11g-compatibility.md for exact dependency support limits and the read-only local probe.

JDBC reads TIMESTAMP WITH TIME ZONE as OffsetDateTime and returns Instant JSON. Null attribution remains JSON null. CLOBs use character streams for writes and getString for bounded description reads. `Db` stores configuration, never a shared connection; connection/read timeouts bound temporary outages.

Javalin 7 registers routes inside `config.routes` during creation, per its [documentation](https://javalin.io/documentation). Java serves an existing frontend build without editing it. Route registration, exception mapping, and body-size policy are centralized in App. API responses do not expose Oracle messages, SQL, URLs, passwords, or stack traces. Console SQL failures log only the numeric Oracle code.

The catalog is available without Oracle; it describes implemented capabilities. Health and data reads require actual Oracle. No fallback dataset masks outages. `.env.example` is documentation only. The server is loopback-only, designed for synthetic single-user coursework.

Dependency-blocked delete uses 409 if Oracle raises ORA-02292; detailed relationship counts are not implemented until relationship tables exist. Related-record CRUD, append-only evidence policy, views, and atomic assignment controls stay deferred behind the initial acceptance gate.
