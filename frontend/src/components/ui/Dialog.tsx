import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';
import { Button } from './Button';
import styles from './Dialog.module.css';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  busy?: boolean;
  /** Shown inside the dialog, e.g. when the server refused a deletion. */
  error?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Confirmation built on Radix AlertDialog: focus is trapped, Cancel receives
 * initial focus, Escape cancels, and focus returns to the opener on close.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'danger',
  busy,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={(next) => !next && !busy && onCancel()}>
      <AnimatePresence>
        {open ? (
          <AlertDialog.Portal forceMount>
            <AlertDialog.Overlay asChild forceMount>
              <motion.div
                className={styles.overlay}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
              />
            </AlertDialog.Overlay>
            <AlertDialog.Content asChild forceMount>
              <motion.div
                className={`${styles.content} paper`}
                initial={{ opacity: 0, scale: 0.98, x: '-50%', y: '-50%' }}
                animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
                exit={{ opacity: 0, scale: 0.98, x: '-50%', y: '-50%' }}
                transition={{ duration: 0.17, ease: EASE }}
              >
                <span className={`${styles.kicker} label`} aria-hidden="true">
                  ( Confirm )
                </span>
                <AlertDialog.Title className={styles.title}>{title}</AlertDialog.Title>
                <AlertDialog.Description asChild>
                  <div className={styles.description}>{description}</div>
                </AlertDialog.Description>
                {error ? (
                  <div className={styles.error} role="alert">
                    {error}
                  </div>
                ) : null}
                <div className={styles.actions}>
                  <AlertDialog.Cancel asChild>
                    <Button variant="secondary" disabled={busy}>
                      {cancelLabel}
                    </Button>
                  </AlertDialog.Cancel>
                  <Button
                    variant={tone}
                    busy={busy}
                    onClick={(event) => {
                      // Stay open until the caller has the server's answer.
                      event.preventDefault();
                      onConfirm();
                    }}
                  >
                    {confirmLabel}
                  </Button>
                </div>
              </motion.div>
            </AlertDialog.Content>
          </AlertDialog.Portal>
        ) : null}
      </AnimatePresence>
    </AlertDialog.Root>
  );
}
