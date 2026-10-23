import { useId, type ReactNode } from 'react';
import styles from './Field.module.css';

export interface ControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
  /** Lets a form find and focus the first invalid control. */
  'data-field'?: string;
}

interface FieldProps {
  label: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  /** Right-aligned note on the label row, e.g. a character count. */
  aside?: ReactNode;
  children: (control: ControlProps) => ReactNode;
}

/** Real label above the control; hint and inline error are connected to it. */
export function Field({ label, required, hint, error, aside, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label htmlFor={id} className={styles.label}>
          {label}
          {required ? <span className={styles.required}> (required)</span> : null}
        </label>
        {aside ? <span className={styles.aside}>{aside}</span> : null}
      </div>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {error ? (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export { styles as fieldStyles };
