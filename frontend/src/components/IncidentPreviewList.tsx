import { Link } from 'react-router';
import { ArrowUpRight } from 'lucide-react';
import type { Incident } from '../api/types';
import { useDrawerNavigation, type DrawerState } from '../hooks/useDrawerNavigation';
import { formatShortDateTime, incidentCode } from '../lib/format';
import { SeverityBadge, StatusBadge } from './ui/Badge';
import styles from './IncidentPreviewList.module.css';

interface IncidentPreviewListProps {
  incidents: Incident[];
  selectedId: number | null;
}

/**
 * An index, not a card grid: one rule per row, the title set large.
 * The first incident gets more space; nothing repeats.
 */
export function IncidentPreviewList({ incidents, selectedId }: IncidentPreviewListProps) {
  const { linkTo, rememberOpener } = useDrawerNavigation();
  return (
    <ol className={styles.list}>
      {incidents.map((incident, index) => (
        <li key={incident.incident_id} className={index === 0 ? styles.featuredItem : undefined}>
          <Link
            to={linkTo(incident.incident_id)}
            state={{ drawer: true, preview: incident } satisfies DrawerState}
            onClick={rememberOpener}
            data-selected={incident.incident_id === selectedId || undefined}
            className={index === 0 ? `${styles.row} ${styles.featured}` : styles.row}
          >
            <span className={styles.index}>
              <span className="label tabular">{String(index + 1).padStart(2, '0')}</span>
              <span className={`${styles.code} mono tabular`}>{incidentCode(incident.incident_id)}</span>
            </span>
            <span className={styles.main}>
              <span className={styles.badges}>
                <SeverityBadge severity={incident.severity} />
                <StatusBadge status={incident.status} />
              </span>
              <span className={styles.title}>{incident.title}</span>
              {index === 0 && incident.description ? <span className={styles.excerpt}>{incident.description}</span> : null}
            </span>
            <span className={styles.meta}>
              <span>{incident.reporter_name}</span>
              <span className={styles.metaMuted}>{incident.department_name}</span>
              <time className={`${styles.metaMuted} tabular`} dateTime={incident.detected_at}>
                {formatShortDateTime(incident.detected_at)}
              </time>
            </span>
            <ArrowUpRight className={styles.arrow} aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ol>
  );
}

export function IncidentPreviewSkeleton() {
  return (
    <div className={styles.list} aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={styles.row} style={{ pointerEvents: 'none' }}>
          <span className="skeleton" style={{ width: 64, height: 12 }} />
          <span className={styles.main}>
            <span className="skeleton" style={{ width: 120, height: 11 }} />
            <span className="skeleton" style={{ width: i === 0 ? '80%' : '55%', height: i === 0 ? 44 : 26 }} />
          </span>
        </div>
      ))}
    </div>
  );
}
