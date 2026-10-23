import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { ApiError, describeError, isAbort } from '../api/client';
import { checkHealth, listIncidents } from '../api/incidents';
import { FluidCursor } from '../components/FluidCursor';
import { IncidentPreviewList, IncidentPreviewSkeleton } from '../components/IncidentPreviewList';
import { useOpenIncidentId } from '../components/RecordDrawer';
import { Button, buttonClassName } from '../components/ui/Button';
import { EASE } from '../components/ui/Dialog';
import { RevealText } from '../components/ui/RevealText';
import { useExplorerQuery } from '../hooks/useExplorerQuery';
import { FIXTURE_MODE, useWorkspace } from '../lib/workspace';
import styles from './OverviewPage.module.css';

// The contract's home query: unresolved, semantic severity order, at most five.
const HOME_QUERY = { 'filter.status.ne': 'RESOLVED', sort: 'severity', order: 'desc', page: 1, page_size: 5 };
const ALL_UNRESOLVED = '/explore?filter.status.ne=RESOLVED&sort=severity&order=desc';
const RESOLVED = '/explore?filter.status.eq=RESOLVED&sort=resolved_at&order=desc';
const WORDMARK = ['T', 'R', 'A', 'C', 'E'];

type Health = 'checking' | 'connected' | 'unavailable' | 'unreachable';

const pad = (n: number) => String(n).padStart(2, '0');

export function OverviewPage() {
  const { dataVersion } = useWorkspace();
  const openId = useOpenIncidentId();
  const state = useExplorerQuery(`home#${dataVersion}`, (signal) => listIncidents(HOME_QUERY, signal));
  const [health, setHealth] = useState<Health>('checking');

  useEffect(() => {
    const controller = new AbortController();
    checkHealth(controller.signal)
      .then(() => setHealth('connected'))
      .catch((error: unknown) => {
        if (isAbort(error)) return;
        setHealth(error instanceof ApiError && error.kind === 'api' ? 'unavailable' : 'unreachable');
      });
    return () => controller.abort();
  }, [dataVersion]);

  const total = state.data?.pagination.total ?? null;

  return (
    <div className={styles.page}>
      {/* White hero: statement top-left, giant wordmark along the bottom. */}
      <section className={`${styles.hero} paper`} aria-labelledby="overview-title">
        <FluidCursor />
        <div className={styles.heroTop}>
          <RevealText
            className={styles.statement}
            lines={['Not a guess, a record.', 'Because every incident leaves a trace.']}
            delay={0.15}
          />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <Link to="/explore" className={buttonClassName('primary')}>
              Explore data
              <ArrowRight aria-hidden="true" />
            </Link>
          </motion.div>
        </div>

        <p className={`${styles.heroMeta} label`}>( Incident &amp; Evidence Workspace — DBMS mini-project )</p>

        <h1 id="overview-title" className={styles.wordmark} tabIndex={-1}>
          <span className="visually-hidden">Trace — keep every incident in context.</span>
          <span className={styles.letters} aria-hidden="true">
            {WORDMARK.map((letter, index) => (
              <span key={index} className={styles.letterMask}>
                <motion.span
                  className={styles.letter}
                  initial={{ y: '100%' }}
                  animate={{ y: '0%' }}
                  transition={{ duration: 1.1, ease: EASE, delay: 0.05 + index * 0.06 }}
                >
                  {letter}
                </motion.span>
              </span>
            ))}
            <span className={styles.letterMask}>
              <motion.span
                className={`${styles.letter} ${styles.mark}`}
                initial={{ y: '100%', rotate: -20 }}
                animate={{ y: '0%', rotate: 0 }}
                transition={{ duration: 1.1, ease: EASE, delay: 0.4 }}
              >
                ’
              </motion.span>
            </span>
          </span>
        </h1>
      </section>

      {/* Black section: the unresolved index. */}
      <section className={styles.section} aria-labelledby="awaiting-heading">
        <div className={styles.sectionGrid}>
          <h2 id="awaiting-heading" className="label">
            ( Awaiting resolution )
          </h2>
          <p className={styles.summary} aria-live="polite">
            {state.error ? (
              'Unresolved incidents couldn’t be loaded.'
            ) : total === null ? (
              ' '
            ) : total === 0 ? (
              'Every recorded incident is resolved.'
            ) : (
              <>
                <span className={styles.summaryLine}>
                  {total} unresolved {total === 1 ? 'incident' : 'incidents'}.
                </span>{' '}
                <span className={styles.summaryLine}>Highest severity first.</span>
              </>
            )}
          </p>
        </div>

        {state.error ? (
          <div className={styles.error} role="alert">
            <span className="label">( Error )</span>
            <p className={styles.errorTitle}>Couldn’t load incidents.</p>
            <p className={styles.errorBody}>{describeError(state.error)}</p>
            <Button variant="secondary" onClick={state.retry}>
              Retry
            </Button>
          </div>
        ) : state.initialLoading ? (
          <IncidentPreviewSkeleton />
        ) : state.data && state.data.data.length > 0 ? (
          <IncidentPreviewList incidents={state.data.data} selectedId={openId} />
        ) : (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>No unresolved incidents.</p>
            <p className={styles.emptyBody}>
              Explore{' '}
              <Link to={RESOLVED} className={styles.inlineLink}>
                resolved incidents
              </Link>{' '}
              or record a new incident.
            </p>
          </div>
        )}

        {total !== null && total > 0 && !state.error ? (
          <Link to={ALL_UNRESOLVED} className={styles.viewAll}>
            <span>View all unresolved</span>
            <span className={`${styles.count} mono`} aria-hidden="true">
              ( {pad(total)} )
            </span>
            <ArrowRight aria-hidden="true" />
          </Link>
        ) : null}
      </section>

      <footer className={styles.footer}>
        <p className={`${styles.source} label`} data-state={FIXTURE_MODE ? 'fixtures' : health}>
          <span className={styles.dot} aria-hidden="true" />
          {FIXTURE_MODE
            ? 'Development fixtures: records are held in memory, not in Oracle.'
            : health === 'connected'
              ? 'Records are stored in the connected Oracle database.'
              : health === 'unavailable'
                ? 'The Oracle database is unavailable.'
                : health === 'unreachable'
                  ? 'The Trace API is not reachable.'
                  : 'Checking the database connection…'}
        </p>
        <p className="label">© 26 — Trace</p>
      </footer>
    </div>
  );
}
