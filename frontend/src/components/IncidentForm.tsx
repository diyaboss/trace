import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, CircleAlert } from 'lucide-react';
import { ApiError, describeError } from '../api/client';
import { addIncident, updateIncident } from '../api/incidents';
import {
  SEVERITIES,
  STATUSES,
  type Employee,
  type Incident,
  type IncidentInput,
  type IncidentStatus,
  type Severity,
  type ThreatActor,
} from '../api/types';
import { fromLocalInput, nowLocalInput, SEVERITY_LABEL, STATUS_LABEL, timezoneLabel, toLocalInput } from '../lib/format';
import { ReferencePicker } from './ReferencePicker';
import { Button } from './ui/Button';
import { Field, fieldStyles } from './ui/Field';
import { EASE } from './ui/Dialog';
import styles from './IncidentForm.module.css';

interface FormValues {
  title: string;
  description: string;
  severity: Severity | '';
  status: IncidentStatus;
  detected: string;
  resolved: string;
  employee_id: number | null;
  employee_label: string | null;
  threat_actor_id: number | null;
  threat_actor_label: string | null;
}

type FieldKey = keyof IncidentInput;
type Errors = Partial<Record<FieldKey, string>>;

const FIELD_ORDER: FieldKey[] = ['title', 'severity', 'status', 'employee_id', 'detected_at', 'description', 'threat_actor_id', 'resolved_at'];

function initialValues(incident: Incident | null): FormValues {
  if (!incident) {
    return {
      title: '',
      description: '',
      severity: '',
      status: 'OPEN',
      detected: nowLocalInput(),
      resolved: '',
      employee_id: null,
      employee_label: null,
      threat_actor_id: null,
      threat_actor_label: null,
    };
  }
  return {
    title: incident.title,
    description: incident.description ?? '',
    severity: incident.severity,
    status: incident.status,
    detected: toLocalInput(incident.detected_at),
    resolved: toLocalInput(incident.resolved_at),
    employee_id: incident.employee_id,
    employee_label: incident.reporter_name,
    threat_actor_id: incident.threat_actor_id,
    threat_actor_label: incident.threat_actor_name,
  };
}

const length = (text: string) => [...text].length;

/** Mirrors the contract's validation so most mistakes are caught before a request. */
function validate(values: FormValues): { errors: Errors; input: IncidentInput | null } {
  const errors: Errors = {};
  const title = values.title.trim();
  if (!title) errors.title = 'Enter a title.';
  else if (length(title) > 160) errors.title = 'Use at most 160 characters.';
  const description = values.description.trim();
  if (length(description) > 10000) errors.description = 'Use at most 10,000 characters.';
  if (!values.severity) errors.severity = 'Choose a severity.';
  if (values.employee_id === null) errors.employee_id = 'Choose the employee who reported this incident.';
  const detected = fromLocalInput(values.detected);
  if (!detected) errors.detected_at = 'Enter a complete detection date and time.';
  let resolved: string | null = null;
  if (values.status === 'RESOLVED') {
    resolved = fromLocalInput(values.resolved);
    if (!resolved) errors.resolved_at = 'Enter when the incident was resolved.';
    else if (detected && Date.parse(resolved) < Date.parse(detected)) {
      errors.resolved_at = 'Resolution time cannot be earlier than detection time.';
    }
  }
  if (Object.keys(errors).length) return { errors, input: null };
  return {
    errors,
    input: {
      title,
      description: description || null,
      severity: values.severity as Severity,
      status: values.status,
      detected_at: detected!,
      resolved_at: values.status === 'RESOLVED' ? resolved : null,
      employee_id: values.employee_id!,
      threat_actor_id: values.threat_actor_id,
    },
  };
}

interface IncidentFormProps {
  /** null = create */
  incident: Incident | null;
  onSaved: (saved: Incident) => void;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export function IncidentForm({ incident, onSaved, onCancel, onDirtyChange }: IncidentFormProps) {
  const initial = useMemo(() => initialValues(incident), [incident]);
  const [values, setValues] = useState<FormValues>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [moreOpen, setMoreOpen] = useState(Boolean(incident?.threat_actor_id || incident?.status === 'RESOLVED'));
  const formRef = useRef<HTMLFormElement>(null);
  const formErrorRef = useRef<HTMLDivElement>(null);
  const moreId = useId();
  const zone = useMemo(timezoneLabel, []);

  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(initial), [values, initial]);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  // A form that goes away (saved, cancelled, record swapped) leaves nothing to guard.
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
  };
  const clearError = (key: FieldKey) => setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));

  const focusFirstError = (found: Errors) => {
    const first = FIELD_ORDER.find((key) => found[key]);
    if (!first) return;
    if (first === 'threat_actor_id' || first === 'resolved_at') setMoreOpen(true);
    // Wait a frame so a just-expanded section is in the DOM.
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>(`[data-field="${first}"]`)?.focus());
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (submitting) return;
    const { errors: found, input } = validate(values);
    setErrors(found);
    if (!input) {
      setFormError('Please correct the highlighted fields.');
      focusFirstError(found);
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      const saved = incident ? await updateIncident(incident.incident_id, input) : await addIncident(input);
      onDirtyChange(false);
      onSaved(saved);
    } catch (error) {
      setSubmitting(false);
      if (error instanceof ApiError && error.kind === 'api' && error.status === 422) {
        const mapped: Errors = {};
        const other: string[] = [];
        for (const [key, message] of Object.entries(error.fieldErrors)) {
          if ((FIELD_ORDER as string[]).includes(key)) mapped[key as FieldKey] = message;
          else other.push(message);
        }
        setErrors(mapped);
        setFormError([error.message, ...other].join(' '));
        focusFirstError(mapped);
        return;
      }
      if (error instanceof ApiError && error.status === 404) {
        setFormError('This incident no longer exists. It may have been deleted. Your changes have not been saved.');
      } else {
        setFormError(describeError(error));
      }
      requestAnimationFrame(() => formErrorRef.current?.focus());
    }
  };

  const changeStatus = (status: IncidentStatus) => {
    setValues((v) => ({
      ...v,
      status,
      // Selecting RESOLVED reveals the resolution time, defaulted to now; reopening clears it.
      resolved: status === 'RESOLVED' ? v.resolved || nowLocalInput() : '',
    }));
    clearError('status');
    clearError('resolved_at');
    if (status === 'RESOLVED') setMoreOpen(true);
  };

  const titleLength = length(values.title.trim());

  return (
    <form
      ref={formRef}
      className={styles.form}
      noValidate
      onSubmit={submit}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          void submit();
        }
      }}
      aria-describedby={formError ? 'incident-form-error' : undefined}
    >
      <div className={styles.body}>
        {formError ? (
          <div ref={formErrorRef} id="incident-form-error" className={styles.formError} role="alert" tabIndex={-1}>
            <CircleAlert aria-hidden="true" />
            <p>{formError}</p>
          </div>
        ) : null}

        <Field
          label="Title"
          required
          error={errors.title}
          aside={titleLength > 120 ? `${titleLength} / 160` : undefined}
        >
          {(control) => (
            <input
              {...control}
              data-field="title"
              className={`${fieldStyles.control} ${styles.titleInput}`}
              value={values.title}
              maxLength={200}
              autoComplete="off"
              placeholder="What happened?"
              onChange={(e) => {
                set('title', e.target.value);
                clearError('title');
              }}
            />
          )}
        </Field>

        <fieldset className={styles.segmentGroup} aria-describedby={errors.severity ? 'severity-error' : undefined}>
          <legend className={styles.legend}>
            Severity <span className={styles.required}>(required)</span>
          </legend>
          <div className={styles.segments} data-invalid={errors.severity ? '' : undefined}>
            {SEVERITIES.map((severity, index) => (
              <label key={severity} className={styles.segment} data-tone={severity.toLowerCase()}>
                <input
                  type="radio"
                  name="severity"
                  value={severity}
                  data-field={index === 0 ? 'severity' : undefined}
                  checked={values.severity === severity}
                  onChange={() => {
                    set('severity', severity);
                    clearError('severity');
                  }}
                />
                <span>
                  <span className={styles.segmentDot} aria-hidden="true" />
                  {SEVERITY_LABEL[severity]}
                </span>
              </label>
            ))}
          </div>
          {errors.severity ? (
            <p id="severity-error" className={fieldStyles.error}>
              {errors.severity}
            </p>
          ) : null}
        </fieldset>

        <fieldset className={styles.segmentGroup} aria-describedby={errors.status ? 'status-error' : undefined}>
          <legend className={styles.legend}>Status</legend>
          <div className={styles.segments}>
            {STATUSES.map((status, index) => (
              <label key={status} className={styles.segment}>
                <input
                  type="radio"
                  name="status"
                  value={status}
                  data-field={index === 0 ? 'status' : undefined}
                  checked={values.status === status}
                  onChange={() => changeStatus(status)}
                />
                <span>{STATUS_LABEL[status]}</span>
              </label>
            ))}
          </div>
          {errors.status ? (
            <p id="status-error" className={fieldStyles.error}>
              {errors.status}
            </p>
          ) : null}
        </fieldset>

        <div className={styles.row}>
          <Field label="Reported by" required error={errors.employee_id} hint="Search by first name, last name, or email.">
            {(control) => (
              <ReferencePicker<Employee>
                control={{ ...control, 'data-field': 'employee_id' }}
                table="EMPLOYEE"
                value={values.employee_id}
                valueLabel={values.employee_label}
                placeholder="Search employees"
                toOption={(row) => ({
                  id: row.employee_id,
                  label: `${row.first_name} ${row.last_name}`,
                  meta: [row.designation, row.email].filter(Boolean).join(' · '),
                })}
                onChange={(option) => {
                  setValues((v) => ({ ...v, employee_id: option?.id ?? null, employee_label: option?.label ?? null }));
                  clearError('employee_id');
                }}
              />
            )}
          </Field>
          <Field label="Detected at" required error={errors.detected_at} hint={`Your local time · ${zone}`}>
            {(control) => (
              <input
                {...control}
                data-field="detected_at"
                type="datetime-local"
                className={fieldStyles.control}
                value={values.detected}
                onChange={(e) => {
                  set('detected', e.target.value);
                  clearError('detected_at');
                  clearError('resolved_at');
                }}
              />
            )}
          </Field>
        </div>

        <Field
          label="Description"
          error={errors.description}
          aside={length(values.description) > 9000 ? `${length(values.description)} / 10,000` : undefined}
        >
          {(control) => (
            <textarea
              {...control}
              data-field="description"
              className={fieldStyles.control}
              rows={5}
              value={values.description}
              placeholder="What was observed, where, and by whom?"
              onChange={(e) => {
                set('description', e.target.value);
                clearError('description');
              }}
            />
          )}
        </Field>

        <section className={styles.more}>
          <button
            type="button"
            className={styles.moreToggle}
            aria-expanded={moreOpen}
            aria-controls={moreId}
            onClick={() => setMoreOpen((o) => !o)}
          >
            <span>
              <span className={styles.moreTitle}>Attribution and resolution</span>
              <span className={styles.moreSummary}>
                {values.threat_actor_label ?? 'Not attributed'}
                {values.status === 'RESOLVED' ? ' · Resolved' : ''}
              </span>
            </span>
            <ChevronDown aria-hidden="true" className={styles.moreChevron} data-open={moreOpen || undefined} />
          </button>
          <AnimatePresence initial={false}>
            {moreOpen ? (
              <motion.div
                id={moreId}
                key="more"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18, ease: EASE }}
                style={{ overflow: 'hidden' }}
              >
                <div className={styles.moreBody}>
                  <Field label="Suspected threat actor" error={errors.threat_actor_id} hint="Leave as “Not attributed” if unknown.">
                    {(control) => (
                      <ReferencePicker<ThreatActor>
                        control={{ ...control, 'data-field': 'threat_actor_id' }}
                        table="THREAT_ACTOR"
                        value={values.threat_actor_id}
                        valueLabel={values.threat_actor_label}
                        placeholder="Not attributed"
                        noneLabel="Not attributed"
                        toOption={(row) => ({
                          id: row.threat_actor_id,
                          label: row.actor_name,
                          meta: [row.actor_type, row.suspected_origin].filter(Boolean).join(' · ') || undefined,
                        })}
                        onChange={(option) => {
                          setValues((v) => ({
                            ...v,
                            threat_actor_id: option?.id ?? null,
                            threat_actor_label: option?.label ?? null,
                          }));
                          clearError('threat_actor_id');
                        }}
                      />
                    )}
                  </Field>
                  {values.status === 'RESOLVED' ? (
                    <Field label="Resolved at" required error={errors.resolved_at} hint={`Your local time · ${zone}`}>
                      {(control) => (
                        <input
                          {...control}
                          data-field="resolved_at"
                          type="datetime-local"
                          className={fieldStyles.control}
                          value={values.resolved}
                          onChange={(e) => {
                            set('resolved', e.target.value);
                            clearError('resolved_at');
                          }}
                        />
                      )}
                    </Field>
                  ) : (
                    <p className={styles.resolveNote}>
                      A resolution time is recorded when the status is set to Resolved.
                      {errors.resolved_at ? <span className={styles.inlineError}> {errors.resolved_at}</span> : null}
                    </p>
                  )}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </section>
      </div>

      <footer className={styles.footer}>
        <span className={styles.shortcut} aria-hidden="true">
          <kbd>{isMac ? '⌘' : 'Ctrl'}</kbd> <kbd>Enter</kbd> to save
        </span>
        <div className={styles.footerActions}>
          <Button variant="ghost" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" busy={submitting}>
            {incident ? 'Save changes' : 'Create incident'}
          </Button>
        </div>
      </footer>
    </form>
  );
}
