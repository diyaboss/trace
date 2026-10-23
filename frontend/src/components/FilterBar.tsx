import { AnimatePresence, motion } from 'motion/react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { ListFilter, X } from 'lucide-react';
import type { FilterOperator } from '../api/types';
import { localDayStart } from '../lib/format';
import {
  describeFilter,
  INCIDENT_FILTER_FIELDS,
  MAX_FILTERS,
  operatorLabel,
  type ActiveFilter,
  type FilterField,
} from '../lib/incidentQuery';
import { Button } from './ui/Button';
import { Field, fieldStyles } from './ui/Field';
import { EASE } from './ui/Dialog';
import { Popover } from './ui/Popover';
import styles from './FilterBar.module.css';

interface FilterBarProps {
  /** The search input, placed on the same row as Add filter. */
  search: ReactNode;
  filters: ActiveFilter[];
  hasSearch: boolean;
  onAdd: (param: string, value: string) => void;
  onRemove: (param: string) => void;
  onClearFilters: () => void;
  onResetAll: () => void;
}

export function FilterBar({ search, filters, hasSearch, onAdd, onRemove, onClearFilters, onResetAll }: FilterBarProps) {
  const full = filters.length >= MAX_FILTERS;
  return (
    <div className={styles.bar}>
      <div className={styles.row}>
        {search}
        <Popover
          label="Add filter"
          trigger={(props) => (
            <Button variant="secondary" icon={<ListFilter aria-hidden="true" />} disabled={full} {...props}>
              Add filter
            </Button>
          )}
        >
          {(close) => (
            <FilterBuilder
              onApply={(param, value) => {
                onAdd(param, value);
                close();
              }}
              onCancel={close}
            />
          )}
        </Popover>
      </div>

      {filters.length > 0 ? (
        <div className={styles.row}>
          <ul className={styles.chips} aria-label="Active filters">
            <AnimatePresence initial={false}>
              {filters.map((filter) => {
                const text = describeFilter(filter);
                return (
                  <motion.li
                    key={filter.param}
                    layout
                    className={styles.chip}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.16, ease: EASE }}
                  >
                    <span>{text}</span>
                    <button
                      type="button"
                      className={styles.chipRemove}
                      aria-label={`Remove filter: ${text}`}
                      onClick={() => onRemove(filter.param)}
                    >
                      <X aria-hidden="true" />
                    </button>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
          <div className={styles.clear}>
            <Button variant="ghost" onClick={onClearFilters}>
              Clear filters
            </Button>
            {hasSearch ? (
              <Button variant="ghost" onClick={onResetAll}>
                Reset all
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      {full ? <p className={styles.limit}>Up to {MAX_FILTERS} filters can be combined.</p> : null}
    </div>
  );
}

function defaultOperator(field: FilterField): FilterOperator {
  return field.operators[0];
}

/** Field → Operator → Value. Only valid choices are offered for each field. */
function FilterBuilder({ onApply, onCancel }: { onApply: (param: string, value: string) => void; onCancel: () => void }) {
  const [fieldKey, setFieldKey] = useState<string>(INCIDENT_FILTER_FIELDS[0].key);
  const field = INCIDENT_FILTER_FIELDS.find((f) => f.key === fieldKey)!;
  const [op, setOp] = useState<FilterOperator>(defaultOperator(field));
  const [value, setValue] = useState<string>(field.values?.[0] ?? '');
  const [error, setError] = useState<string | undefined>();

  const changeField = (key: string) => {
    const next = INCIDENT_FILTER_FIELDS.find((f) => f.key === key)!;
    setFieldKey(key);
    setOp(defaultOperator(next));
    setValue(next.values?.[0] ?? '');
    setError(undefined);
  };

  const apply = (event: FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    let sent = value;
    if (field.kind === 'id') {
      if (!/^[0-9]{1,10}$/.test(value) || Number(value) < 1) {
        setError('Enter a whole number of 1 or more.');
        return;
      }
      sent = String(Number(value));
    }
    if (field.kind === 'timestamp') {
      // "On or before D" means before the start of the following local day.
      const instant = localDayStart(value, op === 'lt' ? 1 : 0);
      if (!instant) {
        setError('Choose a date.');
        return;
      }
      sent = instant;
    }
    onApply(`filter.${field.key}.${op}`, sent);
  };

  return (
    <form className={styles.builder} onSubmit={apply} noValidate>
      <Field label="Field">
        {(control) => (
          <select {...control} className={fieldStyles.control} value={fieldKey} onChange={(e) => changeField(e.target.value)}>
            {INCIDENT_FILTER_FIELDS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        )}
      </Field>
      {field.operators.length > 1 ? (
        <Field label="Condition">
          {(control) => (
            <select {...control} className={fieldStyles.control} value={op} onChange={(e) => setOp(e.target.value as FilterOperator)}>
              {field.operators.map((o) => (
                <option key={o} value={o}>
                  {operatorLabel(field, o)}
                </option>
              ))}
            </select>
          )}
        </Field>
      ) : null}
      <Field
        label={field.operators.length > 1 ? 'Value' : `${field.label} ${operatorLabel(field, op)}`}
        error={error}
        hint={field.kind === 'timestamp' ? 'Dates use your local time zone.' : undefined}
      >
        {(control) =>
          field.kind === 'enum' ? (
            <select {...control} className={fieldStyles.control} value={value} onChange={(e) => setValue(e.target.value)}>
              {field.values!.map((v) => (
                <option key={v} value={v}>
                  {field.valueLabels?.[v] ?? v}
                </option>
              ))}
            </select>
          ) : field.kind === 'id' ? (
            <input
              {...control}
              className={`${fieldStyles.control} tabular`}
              inputMode="numeric"
              autoComplete="off"
              value={value}
              onChange={(e) => {
                setValue(e.target.value.trim());
                setError(undefined);
              }}
            />
          ) : (
            <input
              {...control}
              type="date"
              className={fieldStyles.control}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(undefined);
              }}
            />
          )
        }
      </Field>
      <div className={styles.builderActions}>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary">
          Apply filter
        </Button>
      </div>
    </form>
  );
}
