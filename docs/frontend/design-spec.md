# Frontend design spec — Incident slice

Follows the blueprint (Sections 3–11, 18). This file records how it was applied and where implementation choices were needed.

## Visual direction (revised 8 Oct 2026, after noth.in)

At the user's request, the charcoal/blue-gray look was replaced with an editorial monochrome system modelled on noth.in. Behavior, accessibility, routes, and the API contract are unchanged.

- **Two surfaces.** `:root` is "ink" (#000); the `.paper` class is white. Hero, drawer, dialogs, popovers, and toasts are paper; everything else is ink. Components read only tokens, so placing something on paper re-themes it.
- **Type.** Inter Tight (variable) for text and display; IBM Plex Mono for micro-labels. Both are OFL-licensed and bundled through `@fontsource`, with no network fonts. noth.in's PP Neue Montreal is commercial and not used.
- **Micro-labels** use mono uppercase in parentheses: `( Awaiting resolution )`, `( 08 )`, `( Confirm )`. Status badges read `( Investigating )`; severity is a colored square plus a mono word.
- **Corner chrome.** The `T’` monogram sits top-left and stacked caps nav top-right, both `mix-blend-mode: difference` so they read on ink and paper. A round "New incident" action sits bottom-right (their "ASK" button). The fixture notice is a corner label, top centre on desktop and bottom-left on phones.
- **Overview.** A white hero with a two-line statement, an "Explore data" pill, and a full-width `TRACE’` wordmark that reveals letter by letter. Below it, a black section with a large statement and an index list of unresolved incidents. Hovering a row dims the others.
- **Explorer.** A giant title with a mono count, a ruled search line, pill controls, and a table with mono column heads and hairline rows (hovering dims the other rows).
- **Forms.** Underline inputs, pill radios for severity and status, and an inverse sticky footer.
- **Motion.** Same easing as the site (`cubic-bezier(.22,1,.36,1)`): line-mask text reveals, 300–500 ms hovers, arrow nudges. Reduced motion is honored. No smooth-scroll library and no blocking intro loader (both deliberately skipped: the blueprint rules out scroll hijacking, and a loader delays a working tool).
- **Cursor fluid** (`src/components/FluidCursor.tsx`): a GPU "stable fluids" simulation in WebGL2 (curl, vorticity confinement, 20 Jacobi pressure iterations, advection), written for this project with no library. Electric-blue-to-violet ink trails the pointer behind the hero text. It is decorative only (`aria-hidden`, `pointer-events: none`), pauses off-screen or in a hidden tab, and doesn't start under reduced motion or without WebGL2 float targets. Each mount creates a fresh canvas so React StrictMode's double mount doesn't reuse a released context.
- Contrast was checked for the muted text tokens on both surfaces (≥ 4.5:1).

## Structure

- Two routes: `/` (Overview) and `/explore`. Everything else is URL state.
- The drawer is driven by `?incident=<id>` or `?incident=new`. Opening from a list pushes a history entry (Back closes it); a directly opened URL closes by removing the param in place.
- Explorer state uses the API's own parameter names in the URL (`q`, `page`, `page_size`, `sort`, `order`, `filter.<field>.<op>`), so the URL is the query. Explorer updates replace the history entry, so Back is reserved for closing the drawer and leaving the page.
- Shared state is limited to a data-version counter (lists refetch after any confirmed mutation) and the announcement queue (`src/lib/workspace.tsx`).

## Deviations and decisions

| Topic | Decision | Reason |
|---|---|---|
| Router mode | `createBrowserRouter` + `RouterProvider` instead of `<BrowserRouter>` | `useBlocker` (unsaved-changes guard for Back, Escape, Close, and nav links) only works with a data router. No loaders or actions are used. |
| Package lines | React Router 7.18, Motion 12.43, TypeScript 5.9 | Newer majors exist (Router 8, Motion 14 released 6 days ago, TS 7). Kept to the blueprint's lines and proven releases. |
| Drawer heading focus | Focus moves to the heading without a visible ring | A heading with `tabindex=-1` is an orientation point, not a control. All interactive controls keep the 2 px accent ring. |
| Sticky drawer header | Only the action bar (ID, Edit, Delete, Close) is sticky; the title scrolls | With long titles on phones, a fully sticky header covered about a third of the edit form. Actions stay available, as the blueprint requires. |
| Timestamp labels | "Detected at" / "Resolved at" | "Resolved" alone was ambiguous with the status option, for screen readers as well as for tests. Matches the catalog labels. |
| Date filters | "on or after D" → `gte` start of local day D; "on or before D" → `lt` start of D+1 | Implements the blueprint's end-date rule; converted to UTC. |
| Reporter search | First word goes to the server; remaining words narrow locally (up to 50 rows) | The contract searches each column separately, so "Aditi Rao" would match nothing. See contract-requests.md #1. |
| Table selector | Shows "Incidents · INCIDENT" as the current table, not a menu | Only Incident is implemented in this slice; the blueprint says not to list tables as though they work. |
| Row delete | Same `DeleteIncidentDialog` as the drawer; row fades only after 204 | One delete implementation; no optimistic removal. |
| Column visibility | `localStorage` key `trace.columns.INCIDENT`; ID and Title always visible | Display preference only. |

## Interaction rules implemented

- Saves wait for the server. The returned record replaces form state. Changed values are highlighted for about 2 s, and an announcement is made through a live region.
- An edit that moves the record out of the current filters announces "Saved. This incident no longer matches the current filters." Filters are never changed silently. A new record always opens in the drawer.
- Validation mirrors the contract on the client. Server 422 `field_errors` are mapped onto fields, and unknown keys (`reference`, `record`) appear in the form-level alert. Focus moves to the first invalid field.
- If a write fails with no server answer (network error, proxy error, non-JSON), the form keeps its input and says the outcome is unknown: "Refresh and check the record before trying again." Writes are never retried automatically.
- 404 on delete is treated as already deleted. 409 keeps the incident, explains why, and lists `details.dependencies` when the server provides them.
- Obsolete GETs are aborted (`AbortController`), so a slow response cannot overwrite newer results. Refetches keep the old rows dimmed with "Updating…", and row actions are disabled.
- Motion: drawer 220 ms in / 160 ms out (fade plus 22 px), dialogs 170 ms (fade plus scale 0.98), view/edit crossfade 140 ms, chips 160 ms, screen change 170 ms (6 px). `MotionConfig reducedMotion="user"` drops transforms; CSS disables the shimmer, spinners, and progress animation under reduced motion.

## Not in this slice

The DEPARTMENT, EMPLOYEE, and THREAT_ACTOR explorer views and `GenericRecordDetail`; relationship sections in the drawer; dependency links in the 409 message (the related tables are not exposed yet).
