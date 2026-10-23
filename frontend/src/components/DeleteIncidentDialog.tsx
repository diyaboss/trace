import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ApiError, describeError } from '../api/client';
import { deleteIncident } from '../api/incidents';
import type { Dependency, Incident } from '../api/types';
import { ConfirmDialog } from './ui/Dialog';

interface DeleteIncidentDialogProps {
  incident: Incident | null;
  onCancel: () => void;
  /** Called only after the server confirms (204), or reports the record already gone (404). */
  onDeleted: (incident: Incident, alreadyGone: boolean) => void;
}

function dependencyList(details: Record<string, unknown>): Dependency[] {
  const list = details.dependencies;
  if (!Array.isArray(list)) return [];
  return list.filter(
    (d): d is Dependency => typeof d === 'object' && d !== null && typeof d.table === 'string' && typeof d.count === 'number',
  );
}

/** The one delete flow, used from the record drawer and from table row actions. */
export function DeleteIncidentDialog({ incident, onCancel, onDeleted }: DeleteIncidentDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ReactNode>(null);
  // Keep the title readable while the dialog animates out.
  const shown = useRef(incident);
  if (incident) shown.current = incident;

  useEffect(() => {
    setBusy(false);
    setError(null);
  }, [incident?.incident_id]);

  const confirm = async () => {
    if (!incident) return;
    setBusy(true);
    setError(null);
    try {
      await deleteIncident(incident.incident_id);
      onDeleted(incident, false);
    } catch (reason) {
      setBusy(false);
      if (reason instanceof ApiError && reason.kind === 'api' && reason.status === 404) {
        onDeleted(incident, true);
        return;
      }
      if (reason instanceof ApiError && reason.kind === 'api' && reason.status === 409) {
        const dependencies = dependencyList(reason.details);
        setError(
          <>
            <p>{reason.message}</p>
            {dependencies.length ? (
              <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                {dependencies.map((d) => (
                  <li key={d.table}>
                    {d.count} {d.table.toLowerCase().replace(/_/g, ' ')} {d.count === 1 ? 'record' : 'records'}
                  </li>
                ))}
              </ul>
            ) : null}
            <p style={{ marginTop: 8, color: 'var(--color-text-secondary)' }}>
              The incident was kept. Consider resolving it instead.
            </p>
          </>,
        );
        return;
      }
      setError(<p>{describeError(reason)}</p>);
    }
  };

  return (
    <ConfirmDialog
      open={incident !== null}
      title={shown.current ? `Delete “${shown.current.title}”?` : ''}
      description={
        <p>This permanently removes the incident. Incidents with related records cannot be deleted.</p>
      }
      confirmLabel="Delete incident"
      busy={busy}
      error={error}
      onConfirm={confirm}
      onCancel={onCancel}
    />
  );
}
