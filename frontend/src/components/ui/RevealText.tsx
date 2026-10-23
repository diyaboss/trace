import { motion } from 'motion/react';
import type { ElementType, ReactNode } from 'react';
import { EASE } from './Dialog';

interface RevealTextProps {
  as?: ElementType;
  lines: ReactNode[];
  className?: string;
  delay?: number;
  /** Seconds between lines. */
  stagger?: number;
  id?: string;
  tabIndex?: number;
}

/**
 * Each line slides up from behind a mask, once, on mount. Lines are joined by
 * spaces in the accessible text. Under reduced motion, Motion skips the
 * transform and the text simply appears.
 */
export function RevealText({ as: Tag = 'p', lines, className, delay = 0, stagger = 0.08, id, tabIndex }: RevealTextProps) {
  return (
    <Tag className={className} id={id} tabIndex={tabIndex}>
      {lines.map((line, index) => (
        <span key={index} style={{ display: 'block', overflow: 'hidden', paddingBottom: '0.06em', marginBottom: '-0.06em' }}>
          <motion.span
            style={{ display: 'block' }}
            initial={{ y: '105%' }}
            animate={{ y: '0%' }}
            transition={{ duration: 0.9, ease: EASE, delay: delay + index * stagger }}
          >
            {line}
            {index < lines.length - 1 ? ' ' : null}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}
