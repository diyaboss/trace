# Viva guide

**Explain one request:** a React fetch sends JSON to a Javalin route. The route validates writable fields and calls IncidentDao. The DAO executes prepared SQL over JDBC. Oracle enforces relationships. JSON returns the saved record with readable reporter/department labels.

**Why prepared statements?** Client values remain data, including apostrophes. Identifiers cannot be bound; a fixed catalog allowlists those. LIKE wildcard characters are escaped before binding, so search is a literal substring.

**Why a DAO without a service?** There are only ordinary database operations. A forwarding service or repository interface would add ceremony without useful behavior.

**Why INNER and LEFT JOIN?** Reporter and department are mandatory, so INNER JOIN is appropriate. Attribution is unknown for many incidents; LEFT JOIN preserves those rows and returns null actor data.

**Why normalization?** Department and employee information are stored once and referenced by keys. Five M:N relationships later require junction tables with composite keys. The weak Evidence Log key is evidence_id plus log_no.

**Where is validation authoritative?** Frontend improves user feedback; routes reject invalid requests; Oracle keys and CHECK constraints remain authoritative for direct SQL and race conditions.

**What do transactions protect?** A write and its readback either complete together or roll back. Count and paged rows share an Oracle read-only snapshot. Later atomic incident/link writes will need several statements within one transaction.

**Why UTC?** An explicit input timezone identifies an instant. UTC response values are unambiguous. Browsers display local time. Investigation DATE values will represent calendar dates, a different concept.

**Why no stored duration?** It is derived from resolved_at minus detected_at. Storing it would create a redundant value that can become inconsistent after edits.

**Why no cascading deletion?** Evidence, history, and investigation links should block deletion. Resolve an incident for normal lifecycle completion. The initial schema has no incident child tables yet; later restrictive FKs supply this rule.

**What has been verified?** See verification.md. Compilation/unit/HTTP checks do not prove Oracle SQL behavior. Do not claim the full vertical slice or all 18 physical tables are complete before real Oracle and browser acceptance.
