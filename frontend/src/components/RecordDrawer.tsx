import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import { Pencil, Trash2, X } from 'lucide-react';
import { ApiError, describeError, isAbort } from '../api/client';
import { getIncident } from '../api/incidents';
import type { Incident } from '../api/types';
import { DRAWER_PARAM, takeOpener, useDrawerNavigation, type DrawerState } from '../hooks/useDrawerNavigation';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { incidentCode } from '../lib/format';
import { hasQueryConstraints, matchesQuery } from '../lib/incidentQuery';
import { useWorkspace } from '../lib/workspace';
import { DeleteIncidentDialog } from './DeleteIncidentDialog';
import { IncidentDetail, IncidentDetailSkeleton } from './IncidentDetail';
import { IncidentForm } from './IncidentForm';
import { SeverityBadge, StatusBadge } from './ui/Badge';
import { Button, IconButton } from './ui/Button';
import { ConfirmDialog, EASE } from './ui/Dialog';
import styles from './RecordDrawer.module.css';

const WRITABLE: (keyof Incident)[] = ['title', 'description', 'severity', 'status', 'detected_at', 'resolved_at', 'employee_id', 'threat_actor_id'];

/**
 * The single record overlay. Its open state lives in the URL (?incident=101 or
 * ?incident=new), so Back closes it, links are shareable, and the screen behind
 * keeps its filters, page, and scroll position.
 */
export function RecordDrawer() {
  const [params] = useSearchParams();
  const param = params.get(DRAWER_PARAM);
  const open = param !== null;
  const { closeDrawer } = useDrawerNavigation();
  const [dirty, setDirty] = useState(false);
  const { blocker, release } = useUnsavedChanges(dirty);
  const contentRef = useRef<HTMLDivElement>(null);

  const onDirtyChange = useCallback(
    (next: boolean) => {
      if (!next) release();
      setDirty(next);
    },
    [release],
  );

  // A drawer that closes, or switches to another record, has nothing left to guard.
  useEffect(() => {
    setDirty(false);
  }, [param]);

  return (
    <>
      <Dialog.Root open={open} onOpenChange={(next) => !next && closeDrawer()}>
        <AnimatePresence>
          {open ? (
            <Dialog.Portal forceMount>
              <Dialog.Overlay asChild forceMount>
                <motion.div
                  className={styles.overlay}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.16 } }}
                  transition={{ duration: 0.22 }}
                />
              </Dialog.Overlay>
              <Dialog.Content
                asChild
                forceMount
                aria-describedby={undefined}
                onOpenAutoFocus={(event) => {
                  event.preventDefault();
                  contentRef.current?.querySelector<HTMLElement>('[data-drawer-heading]')?.focus();
                }}
                onCloseAutoFocus={(event) => {
                  event.preventDefault();
                  const opener = takeOpener();
                  if (opener?.isConnected) opener.focus();
                  else document.querySelector<HTMLElement>('main h1')?.focus();
                }}
                onEscapeKeyDown={(event) => {
                  // An open picker list consumes Escape first.
                  if ((event.target as Element | null)?.closest?.('[data-suppress-escape="true"]')) event.preventDefault();
                }}
              >
                <motion.div
                  ref={contentRef}
                  className={`${styles.drawer} paper`}
                  initial={{ opacity: 0, x: 22 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 22, transition: { duration: 0.16, ease: EASE } }}
                  transition={{ duration: 0.22, ease: EASE }}
                >
                  <IncidentRecord key={param} param={param} onDirtyChange={onDirtyChange} dirty={dirty} />
                </motion.div>
              </Dialog.Content>
            </Dialog.Portal>
          ) : null}
        </AnimatePresence>
      </Dialog.Root>

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title="Discard unsaved changes?"
        description={<p>Your edits to this incident haven’t been saved.</p>}
        cancelLabel="Keep editing"
        confirmLabel="Discard changes"
        onCancel={() => blocker.reset?.()}
        onConfirm={() => {
          release();
          setDirty(false);
          blocker.proceed?.();
        }}
      />
    </>
  );
}

type Mode = 'view' | 'edit' | 'create';

function IncidentRecord({
  param,
  dirty,
  onDirtyChange,
}: {
  param: string;
  dirty: boolean;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const location = useLocation();
  const { closeDrawer, replaceIncident } = useDrawerNavigation();
  const { announce, refreshData } = useWorkspace();
  const isCreate = param === 'new';
  const id = /^[0-9]{1,10}$/.test(param) && Number(param) >= 1 ? Number(param) : null;
  const drawerState = (location.state as DrawerState | null) ?? {};
  const preview = drawerState.preview;

  const [incident, setIncident] = useState<Incident | null>(preview && preview.incident_id === id ? preview : null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const [mode, setMode] = useState<Mode>(isCreate ? 'create' : drawerState.edit ? 'edit' : 'view');
  const [changed, setChanged] = useState<ReadonlySet<string>>(new Set());
  const [deleting, setDeleting] = useState<Incident | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (isCreate || id === null) return;
    const controller = new AbortController();
    setLoadError(null);
    getIncident(id, controller.signal)
      .then(setIncident)
      .catch((reason: unknown) => {
        if (!isAbort(reason)) setLoadError(reason);
      });
    return () => controller.abort();
  }, [id, isCreate, attempt]);

  useEffect(() => {
    if (changed.size === 0) return;
    const timer = window.setTimeout(() => setChanged(new Set()), 2200);
    return () => window.clearTimeout(timer);
  }, [changed]);

  const focusHeading = () => requestAnimationFrame(() => headingRef.current?.focus());

  /** Explains where a saved record went instead of silently changing filters. */
  const placementNote = (saved: Incident) => {
    const params = new URLSearchParams(location.search);
    if (location.pathname === '/explore' && hasQueryConstraints(params) && !matchesQuery(saved, params)) {
      return ' This incident no longer matches the current filters.';
    }
    if (location.pathname === '/' && saved.status === 'RESOLVED') return ' It no longer appears among unresolved incidents.';
    return '';
  };

  const onSaved = (saved: Incident) => {
    refreshData();
    if (mode === 'create') {
      announce(`Incident ${incidentCode(saved.incident_id)} created.${placementNote(saved).replace('no longer matches', 'doesn’t match')}`);
      replaceIncident(saved.incident_id, saved);
      return;
    }
    const before = incident;
    setChanged(new Set(WRITABLE.filter((key) => before && before[key] !== saved[key])));
    setIncident(saved);
    setMode('view');
    const note = placementNote(saved);
    announce(note ? `Saved.${note}` : 'Incident updated.');
    focusHeading();
  };

  const cancelEdit = () => {
    if (mode === 'create') {
      closeDrawer(); // guarded by the unsaved-changes blocker
      return;
    }
    if (dirty) {
      setConfirmCancel(true);
      return;
    }
    setMode('view');
    focusHeading();
  };

  const notFound = id === null && !isCreate ? true : loadError instanceof ApiError && loadError.status === 404;
  const code = isCreate ? 'New record' : id !== null ? incidentCode(id) : 'Incident';
  const title = isCreate ? 'New incident' : incident ? incident.title : notFound ? 'Incident not found' : loadError ? 'Couldn’t load incident' : 'Loading incident…';

  return (
    <div className={styles.record}>
      {/* Only the action bar is sticky, so a long title never crowds the form on small screens. */}
      <div className={styles.bar}>
          <span className={`${styles.code} mono tabular`}>
            {code}
            {mode === 'edit' ? <span className={styles.modeTag}>Editing</span> : null}
          </span>
          <div className={styles.actions}>
            {mode === 'view' && incident ? (
              <>
                <Button variant="secondary" icon={<Pencil aria-hidden="true" />} onClick={() => setMode('edit')}>
                  Edit
                </Button>
                <IconButton label="Delete incident" variant="danger" onClick={() => setDeleting(incident)}>
                  <Trash2 aria-hidden="true" />
                </IconButton>
              </>
            ) : null}
            <Dialog.Close asChild>
              <IconButton label="Close">
                <X aria-hidden="true" />
              </IconButton>
            </Dialog.Close>
          </div>
      </div>
      <header className={styles.header}>
        <Dialog.Title asChild>
          <h2
            ref={headingRef}
            className={styles.title}
            tabIndex={-1}
            data-drawer-heading=""
            data-changed={changed.has('title') || undefined}
          >
            {title}
          </h2>
        </Dialog.Title>
        {incident && mode !== 'create' ? (
          <div className={styles.badges}>
            <span data-changed={changed.has('severity') || undefined}>
              <SeverityBadge severity={incident.severity} />
            </span>
            <span data-changed={changed.has('status') || undefined}>
              <StatusBadge status={incident.status} />
            </span>
          </div>
        ) : null}
      </header>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={mode === 'view' ? 'view' : 'form'}
          className={styles.body}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
        >
          {mode === 'create' ? (
            <IncidentForm incident={null} onSaved={onSaved} onCancel={cancelEdit} onDirtyChange={onDirtyChange} />
          ) : mode === 'edit' && incident ? (
            <IncidentForm incident={incident} onSaved={onSaved} onCancel={cancelEdit} onDirtyChange={onDirtyChange} />
          ) : notFound ? (
            <div className={styles.message}>
              <p>This incident doesn’t exist. It may have been deleted.</p>
              <Dialog.Close asChild>
                <Button variant="secondary">Close</Button>
              </Dialog.Close>
            </div>
          ) : loadError ? (
            <div className={styles.message} role="alert">
              <p>{describeError(loadError)}</p>
              <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
                Retry
              </Button>
            </div>
          ) : incident ? (
            <IncidentDetail incident={incident} changed={changed} />
          ) : (
            <IncidentDetailSkeleton />
          )}
        </motion.div>
      </AnimatePresence>

      <DeleteIncidentDialog
        incident={deleting}
        onCancel={() => setDeleting(null)}
        onDeleted={(removed, alreadyGone) => {
          setDeleting(null);
          refreshData();
          announce(
            alreadyGone ? `${incidentCode(removed.incident_id)} had already been deleted.` : `Incident ${incidentCode(removed.incident_id)} deleted.`,
            alreadyGone ? 'info' : 'success',
          );
          closeDrawer();
        }}
      />
      <ConfirmDialog
        open={confirmCancel}
        title="Discard unsaved changes?"
        description={<p>Your edits to this incident haven’t been saved.</p>}
        cancelLabel="Keep editing"
        confirmLabel="Discard changes"
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() => {
          setConfirmCancel(false);
          onDirtyChange(false);
          setMode('view');
          focusHeading();
        }}
      />
    </div>
  );
}

export function useOpenIncidentId(): number | null {
  const [params] = useSearchParams();
  return useMemo(() => {
    const value = params.get(DRAWER_PARAM);
    return value && /^[0-9]+$/.test(value) ? Number(value) : null;
  }, [params]);
}
