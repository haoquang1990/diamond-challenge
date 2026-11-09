import { useState } from 'react';
import type { EventStore, LogEvent } from '../../data/event-store';
import {
  buildTaskCompletionEvent,
  findDuplicateNames,
  pendingTasks,
  validateAmwayCode,
  validatePersonName,
  validatePhone,
} from '../../domain/people';
import type { PeopleConfig, Person, PersonPhone } from '../../domain/people';
import { COUNTRY_CODES, PEOPLE_CONFIG, PERSON_TASKS } from '../people-config';
import { buildPersonHistory, duplicateCodeNames, findDuplicateCodes, findPeopleWithCode, formatPhone } from '../people-helpers';
import { STRINGS, duplicateCodeWarning, historyStageLabel, shortDateLabel, taskButtonLabel, xpLabel } from '../strings';

/** Maps a phone validation failure to its message. */
function phoneErrorText(reason: 'unknown_country' | 'not_digits' | 'bad_length'): string {
  if (reason === 'unknown_country') return STRINGS.phoneUnknownCountry;
  return reason === 'not_digits' ? STRINGS.phoneNotDigits : STRINGS.phoneBadLength;
}

/** Props for {@link PhoneInput}. */
interface PhoneInputProps {
  readonly country: string;
  readonly number: string;
  readonly onChange: (country: string, number: string) => void;
  readonly disabled: boolean;
  readonly error: string | null;
}

/** Country-code select (default first) plus a tel input. */
function PhoneInput({ country, number, onChange, disabled, error }: PhoneInputProps) {
  return (
    <div className="phone-field">
      <span className="note__label">{STRINGS.phoneNumberLabel}</span>
      <div className="phone-field__row">
        <select
          className="select phone-field__country"
          value={country}
          onChange={(e) => onChange(e.target.value, number)}
          disabled={disabled}
          aria-label={STRINGS.phoneCountryLabel}
        >
          {COUNTRY_CODES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} {c.name}
            </option>
          ))}
        </select>
        <input
          className="note__input phone-field__number"
          type="tel"
          inputMode="tel"
          value={number}
          placeholder={STRINGS.phonePlaceholder}
          onChange={(e) => onChange(country, e.target.value)}
          disabled={disabled}
          autoComplete="off"
          aria-label={STRINGS.phoneNumberLabel}
          aria-invalid={error !== null}
        />
      </div>
      {error !== null && (
        <p className="message message--error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Props for {@link AmwayCodeInput}. */
interface AmwayCodeInputProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly disabled: boolean;
  readonly error: string | null;
  /** Non-blocking warning (another person has this code); the form still saves. */
  readonly warning: string | null;
}

/** Optional Amway code field with a numeric keyboard, an error and a duplicate warning. */
function AmwayCodeInput({ value, onChange, disabled, error, warning }: AmwayCodeInputProps) {
  return (
    <div className="phone-field">
      <label className="note">
        <span className="note__label">{STRINGS.amwayCodeLabel}</span>
        <input
          className="note__input"
          type="text"
          inputMode="numeric"
          value={value}
          placeholder={STRINGS.amwayCodePlaceholder}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          autoComplete="off"
          aria-invalid={error !== null}
        />
      </label>
      {error !== null && (
        <p className="message message--error" role="alert">
          {error}
        </p>
      )}
      {warning !== null && (
        <p className="message message--warn" role="status">
          {warning}
        </p>
      )}
    </div>
  );
}

/** Warning text for a typed code that other people already have, or null. */
function typedCodeWarning(people: readonly Person[], input: string, excludePersonId?: string): string | null {
  const checked = validateAmwayCode(input, PEOPLE_CONFIG);
  if (!checked.ok) return null;
  const others = findPeopleWithCode(people, checked.code, excludePersonId);
  return others.length > 0 ? duplicateCodeWarning(duplicateCodeNames(others)) : null;
}

const DEFAULT_COUNTRY = COUNTRY_CODES[0]?.code ?? '+84';

/** Props for {@link AddPersonForm}. */
export interface AddPersonFormProps {
  /** People used for the non-blocking duplicate-name warning. */
  readonly people: readonly Person[];
  /** Writes the person; a rejected promise shows a save error and keeps the input. */
  readonly onSubmit: (name: string, note: string, phone: PersonPhone | null, amwayCode: string | null) => Promise<void>;
  /** Hide the note and phone fields (compact variant; currently unused). */
  readonly compact?: boolean;
}

/**
 * Name (required, trimmed) + optional note. An empty name is rejected with a
 * message and `onSubmit` is not called. A duplicate name only warns.
 */
export function AddPersonForm({ people, onSubmit, compact = false }: AddPersonFormProps) {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [number, setNumber] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const duplicate = name.trim() !== '' && findDuplicateNames(people, name).duplicate;

  async function submit(): Promise<void> {
    const checked = validatePersonName(name);
    if (!checked.ok) {
      setError(STRINGS.personNameRequired);
      return;
    }
    const phone = compact ? { ok: true as const, phone: null } : validatePhone(country, number, PEOPLE_CONFIG);
    if (!phone.ok) {
      setPhoneError(phoneErrorText(phone.reason));
      return;
    }
    const amway = compact ? { ok: true as const, code: null } : validateAmwayCode(code, PEOPLE_CONFIG);
    if (!amway.ok) {
      setCodeError(STRINGS.amwayCodeInvalid);
      return;
    }
    setBusy(true);
    setError(null);
    setPhoneError(null);
    setCodeError(null);
    try {
      await onSubmit(checked.name, note.trim(), phone.phone, amway.code);
      setName('');
      setCode('');
      setNote('');
      setNumber('');
      setCountry(DEFAULT_COUNTRY);
    } catch (e) {
      console.error('[people] add failed', e);
      setError(STRINGS.personSaveError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="person-form"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      noValidate
    >
      <label className="note">
        <span className="note__label">{STRINGS.personNameLabel}</span>
        <input
          className="note__input"
          type="text"
          value={name}
          placeholder={STRINGS.personNamePlaceholder}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          disabled={busy}
          autoComplete="off"
        />
      </label>
      {!compact && (
        <PhoneInput
          country={country}
          number={number}
          onChange={(c, n) => {
            setCountry(c);
            setNumber(n);
            setPhoneError(null);
          }}
          disabled={busy}
          error={phoneError}
        />
      )}
      {!compact && (
        <AmwayCodeInput
          value={code}
          onChange={(v) => {
            setCode(v);
            setCodeError(null);
          }}
          disabled={busy}
          error={codeError}
          warning={typedCodeWarning(people, code)}
        />
      )}
      {!compact && (
        <label className="note">
          <span className="note__label">{STRINGS.noteLabel}</span>
          <textarea className="note__input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} disabled={busy} />
        </label>
      )}
      {duplicate && (
        <p className="message message--warn" role="status">
          {STRINGS.personDuplicateWarning}
        </p>
      )}
      {error !== null && (
        <p className="message message--error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="button button--primary" disabled={busy}>
        {busy ? STRINGS.saving : STRINGS.addPersonButton}
      </button>
    </form>
  );
}

/** Props for {@link PersonDetail}. */
export interface PersonDetailProps {
  readonly eventStore: EventStore;
  readonly person: Person;
  /** All derived people (for rename duplicate warning). */
  readonly people: readonly Person[];
  /** The loaded event log (history is derived from it). */
  readonly events: readonly LogEvent[];
  /** Names for legacy activity types in the history. */
  readonly activityTypes: readonly { readonly id: string; readonly name: string }[];
  readonly config?: PeopleConfig;
  /** Who did a history row (story 023): a name, or null for me / when the book is not synced. */
  readonly authorLabel?: (userId: string) => string | null;
  /**
   * Account creation (story 024). Absent when the build has no Supabase config or the user is
   * signed out: the "Tạo tài khoản" button is then not shown.
   */
  readonly createAccount?: { readonly onOpen: () => void };
  /** Re-read the log after any write. */
  readonly onChanged: () => Promise<void>;
  readonly onBack: () => void;
}

/** Last completed task, kept for undo and the XP feedback. */
interface TaskUndo {
  readonly eventId: string;
  readonly taskName: string;
  readonly xp: number;
}

/**
 * Detail view of one person, top to bottom (story 015): header (name as the
 * title, KH/NPP badge, phone), to-do tasks ("Hoạt động", completed through
 * one activity_logged event, undo by compensating event), a collapsed
 * "Sửa thông tin" section with the name/phone/note form (closed by default,
 * closes again after a successful save), read-only history and archive (with
 * confirm). State of record is the event log; this only holds form state.
 */
export function PersonDetail({ eventStore, person, people, events, activityTypes, config = PEOPLE_CONFIG, authorLabel, createAccount, onChanged, onBack }: PersonDetailProps) {
  const [name, setName] = useState(person.name);
  const [note, setNote] = useState(person.note);
  const [country, setCountry] = useState(person.phone?.country ?? DEFAULT_COUNTRY);
  const [number, setNumber] = useState(person.phone?.number ?? '');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [code, setCode] = useState(person.amwayCode ?? '');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [taskUndo, setTaskUndo] = useState<TaskUndo | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const duplicate = name.trim() !== '' && findDuplicateNames(people, name, person.personId).duplicate;
  const sameCode = findDuplicateCodes(people).get(person.personId);
  const todo = pendingTasks(person, config);
  const history = buildPersonHistory(events, person.personId, config, [...PERSON_TASKS, ...activityTypes]);

  async function run(action: () => Promise<void>): Promise<void> {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await action();
    } catch (e) {
      console.error('[people] write failed', e);
      setError(STRINGS.personSaveError);
    } finally {
      setBusy(false);
    }
  }

  const saveEdits = () =>
    run(async () => {
      const checked = validatePersonName(name);
      if (!checked.ok) {
        setError(STRINGS.personNameRequired);
        return;
      }
      const phone = validatePhone(country, number, config);
      if (!phone.ok) {
        setPhoneError(phoneErrorText(phone.reason));
        return;
      }
      setPhoneError(null);
      const amway = validateAmwayCode(code, config);
      if (!amway.ok) {
        setCodeError(STRINGS.amwayCodeInvalid);
        return;
      }
      setCodeError(null);
      await eventStore.append({
        type: 'person_updated',
        payload: {
          personId: person.personId,
          name: checked.name,
          note: note.trim(),
          phone: phone.phone ?? { country, number: '' },
          amwayCode: amway.code ?? '',
        },
      });
      await onChanged();
      setEditOpen(false);
      setInfo(STRINGS.personSaved);
    });

  const completeTask = (taskId: string) =>
    run(async () => {
      const built = buildTaskCompletionEvent(person, taskId, config);
      if (!built.ok) return;
      const saved = await eventStore.append(built.event);
      setTaskUndo({ eventId: saved.id, taskName: config.tasks?.find((t) => t.id === taskId)?.name ?? '', xp: built.xp });
      await onChanged();
    });

  const undoTask = () =>
    run(async () => {
      if (taskUndo === null) return;
      await eventStore.append({ type: 'activity_logged', payload: { compensates: taskUndo.eventId } });
      setTaskUndo(null);
      await onChanged();
      setInfo(STRINGS.taskUndone);
    });

  const archive = () =>
    run(async () => {
      await eventStore.append({ type: 'person_archived', payload: { personId: person.personId } });
      await onChanged();
      onBack();
    });

  return (
    <main className="screen screen--tabbed">
      <header className="screen__header">
        <button type="button" className="back-button" onClick={onBack} disabled={busy}>
          ‹ {STRINGS.back}
        </button>
        <h1 className="screen__title person-detail__name">
          {person.name}
          {person.label != null && <LabelBadge label={person.label} />}
        </h1>
        {person.phone != null && (
          <p className="screen__prompt">
            {STRINGS.personDetailPhone}: <strong>{formatPhone(person.phone)}</strong>
          </p>
        )}
        {person.amwayCode != null && (
          <p className="screen__prompt">
            {STRINGS.personDetailAmwayCode}: <strong>{person.amwayCode}</strong>
          </p>
        )}
        {person.linkedUserId != null && (
          <p className="screen__prompt">
            <strong>{STRINGS.createAccountHasAccount}</strong>
          </p>
        )}
        {person.linkedUserId != null && (person.archived || person.label !== 'NPP') && (
          <p className="message message--warn" role="status">
            {person.archived ? STRINGS.createAccountWarnArchived : STRINGS.createAccountWarnNotNpp}
          </p>
        )}
        {sameCode !== undefined && (
          <p className="message message--warn" role="status">
            {duplicateCodeWarning(duplicateCodeNames(sameCode))}
          </p>
        )}
      </header>

      <section className="card person-section" aria-label={STRINGS.activitySectionTitle}>
        <h2 className="person-section__heading">{STRINGS.activitySectionTitle}</h2>
        {todo.length === 0 ? (
          <p className="message">{STRINGS.activityNoneLeft}</p>
        ) : (
          <ul className="people-list">
            {todo.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className="task-row"
                  onClick={() => void completeTask(t.id)}
                  disabled={busy}
                  aria-label={taskButtonLabel(t.name, t.xp)}
                >
                  <span className="task-row__name">{t.name}</span>
                  <span className="activity-option__xp">{xpLabel(t.xp)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {taskUndo !== null && (
          <div className="person-result" role="status" aria-live="polite">
            <p className="message">
              {taskUndo.taskName} · <strong>{xpLabel(taskUndo.xp)}</strong>
            </p>
            <button type="button" className="button button--secondary" onClick={() => void undoTask()} disabled={busy}>
              {STRINGS.undo}
            </button>
          </div>
        )}
        {error !== null && !editOpen && (
          <p className="message message--error" role="alert">
            {error}
          </p>
        )}
      </section>

      <section className="card person-section" aria-label={STRINGS.personEditToggle}>
        <button
          type="button"
          className="button button--secondary"
          aria-expanded={editOpen}
          aria-controls="person-edit-form"
          onClick={() => setEditOpen(!editOpen)}
          disabled={busy}
        >
          {editOpen ? STRINGS.personEditClose : STRINGS.personEditToggle}
        </button>
        {editOpen && (
          <div id="person-edit-form" className="person-form">
            <label className="note">
              <span className="note__label">{STRINGS.personNameLabel}</span>
              <input
                className="note__input"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                disabled={busy}
                autoComplete="off"
              />
            </label>
            <PhoneInput
              country={country}
              number={number}
              onChange={(c, n) => {
                setCountry(c);
                setNumber(n);
                setPhoneError(null);
              }}
              disabled={busy}
              error={phoneError}
            />
            <AmwayCodeInput
              value={code}
              onChange={(v) => {
                setCode(v);
                setCodeError(null);
              }}
              disabled={busy}
              error={codeError}
              warning={typedCodeWarning(people, code, person.personId)}
            />
            <label className="note">
              <span className="note__label">{STRINGS.noteLabel}</span>
              <textarea className="note__input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} disabled={busy} />
            </label>
            {duplicate && (
              <p className="message message--warn" role="status">
                {STRINGS.personDuplicateWarning}
              </p>
            )}
            <button type="button" className="button button--secondary" onClick={() => void saveEdits()} disabled={busy}>
              {STRINGS.personSaveChanges}
            </button>
            {error !== null && (
              <p className="message message--error" role="alert">
                {error}
              </p>
            )}
          </div>
        )}
      </section>

      {createAccount !== undefined && person.label === 'NPP' && !person.archived && person.linkedUserId == null && (
        <section className="card person-section" aria-label={STRINGS.createAccountTitle}>
          {(() => {
            const reason = person.amwayCode == null ? STRINGS.createAccountNeedsCode : navigator.onLine ? null : STRINGS.createAccountNeedsNetwork;
            return (
              <>
                <button type="button" className="button button--primary" onClick={createAccount.onOpen} disabled={busy || reason !== null} aria-describedby={reason === null ? undefined : 'create-account-reason'}>
                  {STRINGS.createAccountButton}
                </button>
                {reason !== null && (
                  <p id="create-account-reason" className="message">
                    {reason}
                  </p>
                )}
              </>
            );
          })()}
        </section>
      )}

      <section className="card person-section" aria-label={STRINGS.historyTitle}>
        <h2 className="person-section__heading">{STRINGS.historyTitle}</h2>
        {history.length === 0 ? (
          <p className="message">{STRINGS.historyEmpty}</p>
        ) : (
          <ul className="history-list">
            {history.map((h) => {
              const author = authorLabel?.(h.userId) ?? null;
              return (
              <li key={h.id} className="history-row">
                <span className="history-row__name">
                  {h.kind === 'stage' ? historyStageLabel(h.name) : h.name === '' ? STRINGS.legacyUnknownActivity : h.name}
                  {author !== null && <span className="history-row__author">{author}</span>}
                </span>
                <span className="person-row__stage">{shortDateLabel(h.timestamp)}</span>
              </li>
              );
            })}
          </ul>
        )}
      </section>

      {info !== null && (
        <p className="message" role="status">
          {info}
        </p>
      )}

      <section className="card person-section">
        {confirmArchive ? (
          <>
            <h2 className="person-section__heading">{STRINGS.personArchiveConfirmTitle}</h2>
            <p className="message">{STRINGS.personArchiveConfirmBody}</p>
            <div className="button-row">
              <button type="button" className="button button--secondary" onClick={() => setConfirmArchive(false)} disabled={busy}>
                {STRINGS.cancel}
              </button>
              <button type="button" className="button button--danger" onClick={() => void archive()} disabled={busy}>
                {STRINGS.personArchiveConfirm}
              </button>
            </div>
          </>
        ) : (
          <button type="button" className="button button--secondary" onClick={() => setConfirmArchive(true)} disabled={busy}>
            {STRINGS.personArchive}
          </button>
        )}
      </section>
    </main>
  );
}

/** KH / NPP badge. */
export function LabelBadge({ label }: { readonly label: 'KH' | 'NPP' }) {
  return <span className={label === 'KH' ? 'badge badge--kh' : 'badge badge--npp'}>{label === 'KH' ? STRINGS.labelKh : STRINGS.labelNpp}</span>;
}
