# UI verification — 8 October 2026

## Automated (Playwright, installed Chrome, fixture mode): 17/17 passed

- Create → view → reload (direct URL) → edit title and status to Resolved → cancel delete (Cancel focused by default; record still returns 200) → confirm delete (drawer closes, GET returns 404).
- Client validation: empty title, missing severity and reporter, empty detection time, resolution before detection; first invalid field focused, `aria-invalid` set.
- Server 422 `field_errors` mapped to the reporter field, with focus moved there.
- Apostrophe search (`Employee's`) is sent literally and finds the one matching record.
- Lost connection on create: input kept, outcome reported as unknown, no automatic retry.
- 503 on list: error with Retry, no table or fake rows; Retry recovers.
- Unsaved changes: Escape prompts (Keep editing keeps input); browser Back prompts; Discard closes.
- Filter chip, then open a record and press Back: drawer closes, filter stays, focus returns to the row link. Clear filters keeps search.
- No-match state is distinct from the empty table and offers a reset.
- Server-side sort by severity; `aria-sort` set on the header.
- Row delete through the same confirmation; the row disappears after success.
- Keyboard only: New incident → type → severity by arrow keys → reporter combobox → Ctrl+Enter → Escape returns focus to New incident.
- 375 px: drawer is full width at x=0; no horizontal page scroll.
- Reduced motion: drawer has no transform and skeletons do not animate.
- Overview: five unresolved incidents, Critical first; Close returns focus; "View all unresolved" opens the matching filter.
- Visual capture at 1280 and 375 px: overview, explorer, long-title drawer, edit, validation, no-match, error, delete confirmation. These were reviewed by eye; the review led to the sticky-header, search-row, error-icon, and banner fixes.

## Against the real Java API (`trace-api.jar`, Oracle not configured)

- `GET /api/tables` from Java is identical to `docs/contract/examples/table-catalog.json`, which the fixtures read.
- Java serves the built `dist` at `/` and `/explore`.
- Health, incident list, and reporter search all return the real 503 envelope. The UI shows "The database is unavailable…" with Retry, the footer says "The Oracle database is unavailable." Nothing is presented as zero or empty.
- An unsupported sort returns the real 400 envelope. The fixture's wording was aligned to it.

## Not yet verified (requires Oracle credentials and schema)

The acceptance checklist in blueprint Section 15 against real Oracle: generated IDs, SQL Developer cross-checks, persistence across reload, real constraint errors, and real-data search. Run `TRACE_E2E_BASE_URL=http://127.0.0.1:7000 npx playwright test` once Java is connected, then do the SQL checks in `backend/README.md`.

## Manual review still recommended

A screen reader pass (NVDA or Narrator) over the drawer, combobox, and announcements; a contrast check of disabled controls; and testing on a real touch device.
