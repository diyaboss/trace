import type { ReactNode } from 'react';
import type { Incident } from '../api/types';
import { formatDateTime, formatDuration } from '../lib/format';
import styles from './IncidentDetail.module.css';

interface IncidentDetailProps {
  incident: Incident;
  /** Writable keys that changed in the last save; briefly highlighted. */
  changed?: ReadonlySet<string>;
}

function Property({ label, children, changed }: { label: string; children: ReactNode; changed?: boolean }) {
  return (
    <div className={styles.property} data-changed={changed || undefined}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function IncidentDetail({ incident, changed = new Set() }: IncidentDetailProps) {
  const detected = Date.parse(incident.detected_at);
  const resolved = incident.resolved_at ? Date.parse(incident.resolved_at) : null;
  return (
    <div className={styles.detail}>
      <section aria-labelledby="incident-description" className={styles.section}>
        <h3 id="incident-description" className={styles.sectionTitle}>
          Description
        </h3>
        <div className={styles.description} data-changed={changed.has('description') || undefined}>
          {incident.description ? (
            <p>{incident.description}</p>
          ) : (
            <p className={styles.empty}>No description recorded.</p>
          )}
        </div>
      </section>

      <section aria-labelledby="incident-timeline" className={styles.section}>
        <h3 id="incident-timeline" className={styles.sectionTitle}>
          Timeline
        </h3>
        <dl className={styles.grid}>
          <Property label="Detected" changed={changed.has('detected_at')}>
            <time className="tabular" dateTime={incident.detected_at}>
              {formatDateTime(incident.detected_at)}
            </time>
          </Property>
          <Property label="Resolved" changed={changed.has('resolved_at')}>
            {incident.resolved_at ? (
              <time className="tabular" dateTime={incident.resolved_at}>
                {formatDateTime(incident.resolved_at)}
              </time>
            ) : (
              <span className={styles.empty}>Not resolved</span>
            )}
          </Property>
          <Property label={resolved === null ? 'Open for' : 'Time to resolve'} changed={changed.has('resolved_at') || changed.has('detected_at')}>
            <span className="tabular">{formatDuration((resolved ?? Date.now()) - detected)}</span>
          </Property>
        </dl>
      </section>

      <section aria-labelledby="incident-people" className={styles.section}>
        <h3 id="incident-people" className={styles.sectionTitle}>
          Reporting and attribution
        </h3>
        <dl className={styles.grid}>
          <Property label="Reported by" changed={changed.has('employee_id')}>
            {incident.reporter_name}
            <span className={styles.id}>Employee {incident.employee_id}</span>
          </Property>
          <Property label="Department" changed={changed.has('employee_id')}>
            {incident.department_name}
            <span className={styles.id}>Department {incident.department_id}</span>
          </Property>
          <Property label="Suspected threat actor" changed={changed.has('threat_actor_id')}>
            {incident.threat_actor_name ? (
              <>
                {incident.threat_actor_name}
                <span className={styles.id}>Actor {incident.threat_actor_id}</span>
              </>
            ) : (
              <span className={styles.empty}>Not attributed</span>
            )}
          </Property>
        </dl>
      </section>
    </div>
  );
}

export function IncidentDetailSkeleton() {
  return (
    <div className={styles.detail} aria-hidden="true">
      <div className={styles.section}>
        <span className="skeleton" style={{ width: 110, height: 14 }} />
        <span className="skeleton" style={{ width: '92%', height: 16, marginTop: 14 }} />
        <span className="skeleton" style={{ width: '70%', height: 16, marginTop: 10 }} />
      </div>
      <div className={styles.section}>
        <span className="skeleton" style={{ width: 90, height: 14 }} />
        <span className="skeleton" style={{ width: '60%', height: 16, marginTop: 14 }} />
      </div>
    </div>
  );
}
