import { AnimatePresence, motion } from 'motion/react';
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { useWorkspace } from '../lib/workspace';
import { EASE } from './ui/Dialog';
import styles from './FeedbackRegion.module.css';

const ICONS = { success: CircleCheck, info: Info, error: CircleAlert };

/**
 * Visual notices plus live regions, so success and failure are announced to
 * screen readers. Errors use an assertive region; everything else is polite.
 */
export function FeedbackRegion() {
  const { notices, dismiss } = useWorkspace();
  const latestPolite = [...notices].reverse().find((n) => n.tone !== 'error');
  const latestError = [...notices].reverse().find((n) => n.tone === 'error');
  return (
    <>
      <div className="visually-hidden" role="status" aria-live="polite">
        {latestPolite?.message}
      </div>
      <div className="visually-hidden" role="alert" aria-live="assertive">
        {latestError?.message}
      </div>
      <div className={styles.stack} aria-hidden="true">
        <AnimatePresence initial={false}>
          {notices.map((notice) => {
            const Icon = ICONS[notice.tone];
            return (
              <motion.div
                key={notice.id}
                layout
                className={`${styles.notice} paper`}
                data-tone={notice.tone}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4, transition: { duration: 0.14 } }}
                transition={{ duration: 0.18, ease: EASE }}
              >
                <Icon className={styles.icon} />
                <p>{notice.message}</p>
                <button type="button" tabIndex={-1} className={styles.dismiss} onClick={() => dismiss(notice.id)}>
                  <X />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </>
  );
}
