import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { CircleAlert, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { describeError } from '../api/client';
import { listIncidents } from '../api/incidents';
import type { Incident } from '../api/types';
import { DataTable, type ColumnDef } from '../components/DataTable';
import { DeleteIncidentDialog } from '../components/DeleteIncidentDialog';
import { ExplorerToolbar } from '../components/ExplorerToolbar';
import { FilterBar } from '../components/FilterBar';
import { Pagination } from '../components/Pagination';
import { useOpenIncidentId } from '../components/RecordDrawer';
import { SeverityBadge, StatusBadge } from '../components/ui/Badge';
import { Button, IconButton } from '../components/ui/Button';
import { DRAWER_PARAM, useDrawerNavigation, type DrawerState } from '../hooks/useDrawerNavigation';
import { useExplorerQuery } from '../hooks/useExplorerQuery';
import { formatShortDateTime, incidentCode, pluralize } from '../lib/format';
import { apiQueryFromParams, readFilters } from '../lib/incidentQuery';
import { useWorkspace } from '../lib/workspace';
import { RevealText } from '../components/ui/RevealText';
import styles from './ExplorerPage.module.css';

const COLUMN_STORAGE_KEY = 'trace.columns.INCIDENT';

function loadHidden(columns: ColumnDef<Incident>[]): Set<string> {
  try {
    const stored = window.localStorage.getItem(COLUMN_STORAGE_KEY);
    if (stored) return new Set(JSON.parse(stored) as string[]);
  } catch {
    // Storage unavailable: fall back to defaults.
  }
  return new Set(columns.filter((c) => c.defaultHidden).map((c) => c.key));
}

export function ExplorerPage() {
  const [params, setParams] = useSearchParams();
  const { dataVersion, refreshData, announce } = useWorkspace();
  const { openIncident, openCreate, linkTo, rememberOpener } = useDrawerNavigation();
  const openId = useOpenIncidentId();
  const [deleting, setDeleting] = useState<Incident | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const query = useMemo(() => apiQueryFromParams(params), [params]);
  const queryKey = `${JSON.stringify(query)}#${dataVersion}`;
  const state = useExplorerQuery(queryKey, (signal) => listIncidents(query, signal));
  const filters = useMemo(() => readFilters(params), [params]);
  const search = params.get('q') ?? '';
  const constrained = Boolean(search) || filters.length > 0;

  /** All explorer state lives in the URL; the drawer param is preserved. */
  const update = useCallback(
    (change: (next: URLSearchParams) => void, { resetPage = true } = {}) => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          change(next);
          if (resetPage) next.delete('page');
          return next;
        },
        { replace: true, state: window.history.state?.usr },
      );
    },
    [setParams],
  );

  // A page beyond the results (e.g. after deleting the last row) moves to the last valid page.
  useEffect(() => {
    const result = state.data;
    if (!result || state.refreshing || result.data.length > 0 || result.pagination.total === 0) return;
    if (result.pagination.page <= 1) return;
    const lastPage = Math.max(1, Math.ceil(result.pagination.total / result.pagination.page_size));
    update((next) => next.set('page', String(lastPage)), { resetPage: false });
  }, [state.data, state.refreshing, update]);

  useEffect(() => {
    if (!state.refreshing) setRemovingId(null);
  }, [state.refreshing]);

  const columns = useMemo<ColumnDef<Incident>[]>(
    () => [
      {
        key: 'incident_id',
        label: 'ID',
        sortable: true,
        firstOrder: 'desc',
        alwaysVisible: true,
        className: styles.idCol,
        render: (row) => <span className={`${styles.id} mono tabular`}>{row.incident_id}</span>,
      },
      {
        key: 'title',
        label: 'Title',
        sortable: true,
        alwaysVisible: true,
        sticky: true,
        className: styles.titleCol,
        render: (row) => (
          <Link
            to={linkTo(row.incident_id)}
            state={{ drawer: true, preview: row } satisfies DrawerState}
            className={styles.recordLink}
            onClick={rememberOpener}
          >
            {row.title}
          </Link>
        ),
      },
      { key: 'severity', label: 'Severity', sortable: true, firstOrder: 'desc', render: (row) => <SeverityBadge severity={row.severity} /> },
      { key: 'status', label: 'Status', sortable: true, render: (row) => <StatusBadge status={row.status} /> },
      { key: 'reporter_name', label: 'Reporter', render: (row) => <span className={styles.text}>{row.reporter_name}</span> },
      {
        key: 'department_name',
        label: 'Department',
        defaultHidden: true,
        render: (row) => <span className={styles.text}>{row.department_name}</span>,
      },
      {
        key: 'threat_actor_name',
        label: 'Threat actor',
        defaultHidden: true,
        render: (row) =>
          row.threat_actor_name ? <span className={styles.text}>{row.threat_actor_name}</span> : <span className={styles.muted}>Not attributed</span>,
      },
      {
        key: 'detected_at',
        label: 'Detected',
        sortable: true,
        firstOrder: 'desc',
        render: (row) => (
          <time className={`${styles.time} tabular`} dateTime={row.detected_at}>
            {formatShortDateTime(row.detected_at)}
          </time>
        ),
      },
      {
        key: 'resolved_at',
        label: 'Resolved',
        sortable: true,
        firstOrder: 'desc',
        defaultHidden: true,
        render: (row) =>
          row.resolved_at ? (
            <time className={`${styles.time} tabular`} dateTime={row.resolved_at}>
              {formatShortDateTime(row.resolved_at)}
            </time>
          ) : (
            <span className={styles.muted}>—</span>
          ),
      },
    ],
    [linkTo, rememberOpener],
  );

  const [hidden, setHidden] = useState<Set<string>>(() => loadHidden(columns));
  const toggleColumn = (key: string) => {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        window.localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        // Display preference only; ignore storage failures.
      }
      return next;
    });
  };
  const visibleColumns = columns.filter((c) => c.alwaysVisible || !hidden.has(c.key));

  const result = state.data;
  const busy = state.refreshing || state.initialLoading;
  const tableParam = params.get('table');

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <p className="label">( Data explorer — Oracle tables )</p>
        <div className={styles.titleRow}>
          <RevealText as="h1" lines={['Explore Data']} tabIndex={-1} className={styles.title} />
          {result && !state.error ? (
            <span className={`${styles.titleCount} mono tabular`} aria-hidden="true">
              ( {String(result.pagination.total).padStart(2, '0')} )
            </span>
          ) : null}
        </div>
      </header>

      {tableParam && tableParam !== 'INCIDENT' ? (
        <p className={styles.notice} role="note">
          <CircleAlert aria-hidden="true" />
          The {tableParam} table isn’t available yet. Showing Incidents.
        </p>
      ) : null}

      <div className={styles.controls}>
        <ExplorerToolbar
          tableLabel="Incidents"
          tableName="INCIDENT"
          columns={columns}
          hidden={hidden}
          onToggleColumn={toggleColumn}
          onRefresh={state.retry}
          refreshing={state.refreshing}
        />
        <FilterBar
          search={<SearchInput value={search} onChange={(value) => update((next) => (value ? next.set('q', value) : next.delete('q')))} />}
          filters={filters}
          hasSearch={Boolean(search)}
          onAdd={(param, value) => update((next) => next.set(param, value))}
          onRemove={(param) => update((next) => next.delete(param))}
          onClearFilters={() => update((next) => filters.forEach((f) => next.delete(f.param)))}
          onResetAll={() =>
            update((next) => {
              filters.forEach((f) => next.delete(f.param));
              next.delete('q');
            })
          }
        />
      </div>

      <div className={styles.status} aria-live="polite">
        {result && !state.error ? (
          <span className="tabular">
            {constrained ? pluralize(result.pagination.total, 'matching record') : pluralize(result.pagination.total, 'incident')}
          </span>
        ) : null}
        {state.refreshing ? <span className={styles.updating}>Updating…</span> : null}
        {state.refreshing ? <span className={styles.progress} aria-hidden="true" /> : null}
      </div>

      {state.error ? (
        <div className={styles.empty} role="alert">
          <CircleAlert aria-hidden="true" className={styles.errorIcon} />
          <h2>Couldn’t load incidents.</h2>
          <p>{describeError(state.error)}</p>
          <Button variant="secondary" onClick={state.retry}>
            Retry
          </Button>
        </div>
      ) : result && result.pagination.total === 0 ? (
        constrained ? (
          <div className={styles.empty}>
            <h2>No incidents match these filters.</h2>
            <p>Try removing a filter or changing the search.</p>
            <Button
              variant="secondary"
              onClick={() =>
                update((next) => {
                  filters.forEach((f) => next.delete(f.param));
                  next.delete('q');
                })
              }
            >
              Reset filters and search
            </Button>
          </div>
        ) : (
          <div className={styles.empty}>
            <h2>No incidents recorded yet.</h2>
            <p>Recorded incidents appear here, newest first.</p>
            <Button variant="primary" icon={<Plus aria-hidden="true" />} onClick={openCreate}>
              New incident
            </Button>
          </div>
        )
      ) : (
        <>
          <div className={styles.tableWrap} data-refreshing={state.refreshing || undefined}>
            <DataTable<Incident>
              caption="Incidents"
              columns={visibleColumns}
              rows={result?.data ?? []}
              loading={state.initialLoading}
              rowKey={(row) => row.incident_id}
              sort={query.sort}
              order={query.order as 'asc' | 'desc'}
              onSort={(key, order) =>
                update((next) => {
                  next.set('sort', key);
                  next.set('order', order);
                })
              }
              selectedKey={openId}
              removingKey={removingId}
              onRowClick={(row) => openIncident(row.incident_id, row)}
              actions={(row) => (
                <span className={styles.rowActions}>
                  <IconButton
                    label={`Edit ${incidentCode(row.incident_id)}`}
                    disabled={busy}
                    onClick={() => openIncident(row.incident_id, row, { edit: true })}
                  >
                    <Pencil aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    label={`Delete ${incidentCode(row.incident_id)}`}
                    variant="danger"
                    disabled={busy}
                    onClick={() => setDeleting(row)}
                  >
                    <Trash2 aria-hidden="true" />
                  </IconButton>
                </span>
              )}
            />
          </div>
          {result ? (
            <Pagination
              info={result.pagination}
              disabled={busy}
              onPage={(page) => update((next) => next.set('page', String(page)), { resetPage: false })}
              onPageSize={(size) => update((next) => next.set('page_size', String(size)))}
            />
          ) : null}
        </>
      )}

      <DeleteIncidentDialog
        incident={deleting}
        onCancel={() => setDeleting(null)}
        onDeleted={(removed, alreadyGone) => {
          setDeleting(null);
          setRemovingId(removed.incident_id);
          refreshData();
          announce(
            alreadyGone ? `${incidentCode(removed.incident_id)} had already been deleted.` : `Incident ${incidentCode(removed.incident_id)} deleted.`,
            alreadyGone ? 'info' : 'success',
          );
          // If this record was also open in the drawer, close it.
          if (params.get(DRAWER_PARAM) === String(removed.incident_id)) update((next) => next.delete(DRAWER_PARAM), { resetPage: false });
        }}
      />
    </div>
  );
}

/** Title search, debounced 250 ms. Escape clears it. */
function SearchInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [text, setText] = useState(value);
  const committed = useRef(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Follow external changes (Reset all, Back/Forward).
  useEffect(() => {
    if (value !== committed.current) {
      committed.current = value;
      setText(value);
    }
  }, [value]);

  useEffect(() => {
    const trimmed = text.trim().slice(0, 100);
    if (trimmed === committed.current) return;
    const timer = window.setTimeout(() => {
      committed.current = trimmed;
      onChangeRef.current(trimmed);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [text]);

  return (
    <div className={styles.search}>
      <Search aria-hidden="true" className={styles.searchIcon} />
      <label htmlFor="incident-search" className="visually-hidden">
        Search incident titles
      </label>
      <input
        id="incident-search"
        type="search"
        className={styles.searchInput}
        placeholder="Search incident titles…"
        autoComplete="off"
        maxLength={100}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && text) {
            e.preventDefault();
            setText('');
          }
        }}
      />
      {text ? (
        <button type="button" className={styles.searchClear} aria-label="Clear search" onClick={() => setText('')}>
          <X aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
