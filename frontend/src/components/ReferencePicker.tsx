import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { describeError, isAbort } from '../api/client';
import { getTableRows } from '../api/tables';
import type { ControlProps } from './ui/Field';
import { fieldStyles } from './ui/Field';
import styles from './ReferencePicker.module.css';

export interface ReferenceOption {
  id: number;
  label: string;
  meta?: string;
}

interface ReferencePickerProps<Row> {
  control: ControlProps;
  table: string;
  value: number | null;
  /** Label for the current value (from the record's joined label). */
  valueLabel: string | null;
  toOption: (row: Row) => ReferenceOption;
  onChange: (option: ReferenceOption | null) => void;
  placeholder: string;
  /** Adds a first option that clears the value, e.g. "Not attributed". */
  noneLabel?: string;
  disabled?: boolean;
}

const PAGE = 8;

/**
 * Combobox backed by GET /api/tables/{table}/rows?q=… — it never assumes every
 * row fits in one page. Multi-word input searches by the first word on the
 * server and narrows by the remaining words locally.
 */
export function ReferencePicker<Row>({
  control,
  table,
  value,
  valueLabel,
  toOption,
  onChange,
  placeholder,
  noneLabel,
  disabled,
}: ReferencePickerProps<Row>) {
  const listId = useId();
  const [text, setText] = useState(valueLabel ?? '');
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ReferenceOption[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the visible text in sync when the selected record changes from outside.
  useEffect(() => {
    if (!open) setText(valueLabel ?? '');
  }, [valueLabel, open]);

  const typed = open && text !== (valueLabel ?? '') ? text.trim() : '';

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const words = typed.toLowerCase().split(/\s+/).filter(Boolean);
    const timer = window.setTimeout(() => {
      setLoading(true);
      getTableRows<Row>(table, { q: words[0], page_size: words.length > 1 ? 50 : PAGE }, controller.signal)
        .then((result) => {
          let found = result.data.map(toOption);
          if (words.length > 1) {
            found = found.filter((o) => words.every((w) => `${o.label} ${o.meta ?? ''}`.toLowerCase().includes(w)));
          }
          setOptions(found.slice(0, PAGE));
          setTotal(words.length > 1 ? found.length : result.pagination.total);
          setError(null);
          setActive(0);
          setLoading(false);
        })
        .catch((reason: unknown) => {
          if (isAbort(reason)) return;
          setError(describeError(reason));
          setLoading(false);
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
    // toOption is a stable mapping supplied by the caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, typed, table]);

  const items: (ReferenceOption | null)[] = noneLabel ? [null, ...options] : options;

  const choose = (option: ReferenceOption | null) => {
    onChange(option);
    setText(option ? option.label : '');
    setOpen(false);
  };

  const close = () => {
    setOpen(false);
    setText(valueLabel ?? '');
  };

  return (
    <div className={styles.picker}>
      <input
        ref={inputRef}
        {...control}
        className={`${fieldStyles.control} ${styles.input}`}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && items.length ? `${listId}-${active}` : undefined}
        // Lets the drawer ignore Escape while this list is open.
        data-suppress-escape={open ? 'true' : undefined}
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        disabled={disabled}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={(event) => {
          if (!event.currentTarget.parentElement?.contains(event.relatedTarget)) close();
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (!open) setOpen(true);
            else setActive((i) => Math.min(i + 1, Math.max(items.length - 1, 0)));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (event.key === 'Enter' && open && !event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            if (items.length) choose(items[active]);
          } else if (event.key === 'Escape' && open) {
            event.preventDefault();
            close();
          } else if (event.key === 'Tab' && open) {
            close();
          }
        }}
      />
      <ChevronsUpDown className={styles.chevron} aria-hidden="true" />
      {open ? (
        <div className={styles.popover}>
          <ul id={listId} role="listbox" className={styles.list} aria-label={placeholder}>
            {items.map((option, index) => {
              const selected = option ? option.id === value : value === null;
              return (
                <li
                  key={option ? option.id : 'none'}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={selected}
                  data-active={index === active || undefined}
                  className={styles.option}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(option)}
                >
                  <span className={styles.optionText}>
                    <span className={option ? undefined : styles.none}>{option ? option.label : noneLabel}</span>
                    {option?.meta ? <span className={styles.meta}>{option.meta}</span> : null}
                  </span>
                  {selected ? <Check className={styles.check} aria-hidden="true" /> : null}
                </li>
              );
            })}
          </ul>
          <p className={styles.status} aria-live="polite">
            {error
              ? error
              : loading && !options.length
                ? 'Searching…'
                : !options.length
                  ? 'No matches.'
                  : total > options.length
                    ? `Showing ${options.length} of ${total}. Type to narrow the list.`
                    : null}
          </p>
        </div>
      ) : null}
    </div>
  );
}
