import type { IncidentStatus, Severity } from '../../api/types';
import { SEVERITY_LABEL, STATUS_LABEL } from '../../lib/format';
import styles from './Badge.module.css';

/** Mono label with a colored square. Text always carries the meaning. */
export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`${styles.badge} ${styles.severity}`} data-level={severity.toLowerCase()}>
      <span className={styles.mark} aria-hidden="true" />
      {SEVERITY_LABEL[severity]}
    </span>
  );
}

/** Status reads as a parenthetical, e.g. "( Investigating )". */
export function StatusBadge({ status }: { status: IncidentStatus }) {
  return (
    <span className={`${styles.badge} ${styles.status}`} data-status={status.toLowerCase()}>
      <span aria-hidden="true">(&nbsp;</span>
      <span>{STATUS_LABEL[status]}</span>
      <span aria-hidden="true">&nbsp;)</span>
    </span>
  );
}
