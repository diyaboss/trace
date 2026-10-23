import { motion } from 'motion/react';
import { Outlet, useLocation } from 'react-router';
import { FIXTURE_MODE } from '../lib/workspace';
import { FeedbackRegion } from './FeedbackRegion';
import { RecordDrawer } from './RecordDrawer';
import { TopNavigation } from './TopNavigation';
import { EASE } from './ui/Dialog';
import styles from './AppShell.module.css';

export function AppShell() {
  const { pathname } = useLocation();
  return (
    <div className={styles.shell}>
      <a href="#main" className={styles.skip}>
        Skip to content
      </a>
      <TopNavigation />
      {/* Only the pathname keys the transition: opening a drawer or filtering does not. */}
      <motion.main
        id="main"
        key={pathname}
        className={styles.main}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        <Outlet />
      </motion.main>
      {FIXTURE_MODE ? (
        <p className={`${styles.fixtures} label`} role="note">
          ( Dev fixtures<span className={styles.fixturesMore}> — in-memory records</span>, not Oracle )
        </p>
      ) : null}
      <RecordDrawer />
      <FeedbackRegion />
    </div>
  );
}
