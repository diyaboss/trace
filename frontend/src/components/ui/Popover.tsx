import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { EASE } from './Dialog';
import styles from './Popover.module.css';

interface PopoverProps {
  label: string;
  align?: 'start' | 'end';
  trigger: (props: {
    'aria-expanded': boolean;
    'aria-controls': string;
    'aria-haspopup': 'dialog';
    onClick: () => void;
  }) => ReactNode;
  children: (close: () => void) => ReactNode;
}

/**
 * A small non-modal panel anchored to its trigger. Escape or an outside click
 * closes it; focus moves into the panel on open and back to the trigger on close.
 */
export function Popover({ label, align = 'start', trigger, children }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) {
      requestAnimationFrame(() => rootRef.current?.querySelector<HTMLElement>('[aria-haspopup]')?.focus());
    }
  };

  useEffect(() => {
    if (!open) return;
    const focusable = panelRef.current?.querySelector<HTMLElement>('select, input, button, [tabindex="0"]');
    focusable?.focus();
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={styles.root}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation();
          close();
        }
      }}
    >
      {trigger({
        'aria-expanded': open,
        'aria-controls': id,
        'aria-haspopup': 'dialog',
        onClick: () => (open ? close() : setOpen(true)),
      })}
      <AnimatePresence>
        {open ? (
          <motion.div
            ref={panelRef}
            id={id}
            role="dialog"
            aria-label={label}
            className={`${styles.panel} paper`}
            data-align={align}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
            transition={{ duration: 0.16, ease: EASE }}
          >
            {children(() => close())}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
