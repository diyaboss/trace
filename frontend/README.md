# Trace frontend

React 19 + TypeScript + Vite 8, CSS Modules, Motion, React Router 7, Radix Dialog/AlertDialog, lucide-react. Node 22.12+ (verified on Node 24). Exact versions are pinned in `package.json` and `package-lock.json`.

Current scope: the **Incident vertical slice** — Overview, the Incident explorer (search, filters, sort, pagination, column visibility), the record drawer (view, create, edit), and confirmed deletion. Other tables are deliberately not exposed until this slice is accepted against Oracle.

## Install

```bash
npm ci
```

## Run against the real Java API (default)

Start the Java server on `127.0.0.1:7000` (see `backend/README.md`), then:

```bash
npm run dev
```

Open http://localhost:5173. Vite proxies `/api/*` to Java. If Java or Oracle is down, the UI shows the error with Retry — it never substitutes fake data.

## Run with development fixtures (explicit opt-in)

```bash
npm run dev:fixtures
```

An in-memory API served by the Vite dev server (`dev/fixtureApi.ts`) that follows `docs/contract/api-v1.md`: same routes, envelopes, status codes, validation, and query rules. It reads the catalog from `docs/contract/examples/table-catalog.json` and mirrors `database/002_core_seed.sql`. A yellow banner says **Development fixtures** on every screen. The proxy to Java is disabled in this mode, and the plugin is never part of `npm run build`.

## Final demo (one server)

```bash
npm run build
```

Java serves `frontend/dist` at http://localhost:7000 along with `/api`.

## Tests

Playwright uses your installed Chrome (`TRACE_E2E_CHANNEL=msedge` for Edge), so no browser download is needed.

```bash
npx playwright test
```

By default this starts its own fixture-mode server on port 5174 and resets data before each test. To run the same suite against the real stack (build, start Java with Oracle, then):

```bash
TRACE_E2E_BASE_URL=http://127.0.0.1:7000 npx playwright test
```

Tests create uniquely named incidents and delete them; they rely only on seeded employees. `tests/visual.spec.ts` writes screenshots of key states to `test-results/screens/` for visual review.

## Layout

- `src/api/` — the only code that does HTTP. `client.ts` handles envelopes, 204, unreachable servers, and uncertain writes.
- `src/pages/` — `OverviewPage`, `ExplorerPage`.
- `src/components/` — shell, drawer, form, detail, table, filters; `ui/` holds the small primitives.
- `src/hooks/` — `useExplorerQuery` (abortable, keeps previous rows), `useUnsavedChanges`, `useDrawerNavigation`.
- `src/lib/` — formatting, the incident query model, and the workspace context (refresh counter + announcements).

Design decisions and deviations: `docs/frontend/design-spec.md`. Verification status: `docs/frontend/ui-checklist.md`. Contract gaps: `docs/frontend/contract-requests.md`.
