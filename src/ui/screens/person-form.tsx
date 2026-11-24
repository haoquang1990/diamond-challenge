import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { EventStore, LogEvent } from '../../data/event-store';
import { buildSplitEvents } from '../../domain/duplicates';
import {
  buildSponsorshipCancelEvent,
  buildTaskCompletionEvent,
  findDuplicateNames,
  pendingTasks,
  validateActivityTime,
  validateAmwayCode,
  validatePersonName,
  validatePhone,
} from '../../domain/people';
import type { PeopleConfig, Person, PersonPhone, PersonTaskDef } from '../../domain/people';
import { COUNTRY_CODES, PEOPLE_CONFIG, PERSON_TASKS } from '../people-config';
import { activityInstant, buildPersonHistory, countDoneTasks, duplicateCodeNames, findDuplicateCodes, findPeopleWithCode, formatPhone, summarizeHistory, toLocalInputValue } from '../people-helpers';
import {
  STRINGS,
  activityTimeTooOldLabel,
  dateTimeLabel,
  daysSinceLabel,
  duplicateCodeWarning,
  historyStageLabel,
  sponsorCancelHint,
  noteCounterLabel,
  splitLabel,
  taskButtonLabel,
  taskDoneOnceLabel,
  taskDoneTimesLabel,
  xpLabel,
} from '../strings';

const FOCUSABLE = 'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/** Props for {@link Dialog}. */
export interface DialogProps {
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
}

/**
 * Modal popup (reuses `.popup-backdrop` / `.popup`): role="dialog", aria-modal, labelled by its
 * title. On open focus moves to the first field inside; Tab stays inside; Esc and a click on the
 * backdrop call `onClose`; the page behind does not scroll (body class) and the focus returns to
 * the opener on close. The content scrolls inside (max-height ~90vh).
 */
export function Dialog({ title, onClose, children }: DialogProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.classList.add('dialog-open');
    const panel = panelRef.current;
    (panel?.querySelector<HTMLElement>(FOCUSABLE) ?? panel)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
      } else if (e.key === 'Tab' && panel !== null) {
        const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (items.length === 0) {
          e.preventDefault();
          return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('dialog-open');
      // After the commit, so an opener that was disabled while saving can take focus again.
      setTimeout(() => opener?.focus(), 0);
    };
  }, []);

  return (
    <div
      className="popup-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={panelRef} className="popup popup--dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <h2 id={titleId} className="popup__title">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

/** Props for {@link ActivityDialog}. */
interface ActivityDialogProps {
  readonly task: PersonTaskDef;
  readonly noteMaxLength: number;
  readonly backdateDays: number;
  readonly busy: boolean;
  readonly error: string | null;
  readonly onConfirm: (note: string, when: Date) => void;
  readonly onCancel: () => void;
}

/** Popup to log one task: optional note, date and time (default now), Confirm / Cancel. */
function ActivityDialog({ task, noteMaxLength, backdateDays, busy, error, onConfirm, onCancel }: ActivityDialogProps) {
  const [note, setNote] = useState('');
  const [initialWhen] = useState(() => toLocalInputValue(new Date()));
  const [when, setWhen] = useState(initialWhen);
  const chosen = new Date(when);
  const check = validateActivityTime(chosen, new Date(), backdateDays);
  const problem =
    check === 'future' ? STRINGS.activityTimeFuture : check === 'too_old' ? activityTimeTooOldLabel(backdateDays) : check === 'invalid' ? STRINGS.activityTimeInvalid : null;
  return (
    <Dialog title={task.name} onClose={onCancel}>
      <p className="popup__body">
        <strong>{xpLabel(task.xp)}</strong>
      </p>
      <label className="note popup__field">
        <span className="note__label">{STRINGS.activityNoteLabel}</span>
        <textarea className="note__input" rows={3} maxLength={noteMaxLength} value={note} onChange={(e) => setNote(e.target.value)} disabled={busy} />
        <span className="popup__counter">{noteCounterLabel(note.length, noteMaxLength)}</span>
      </label>
      <label className="note popup__field">
        <span className="note__label">{STRINGS.activityDateTimeLabel}</span>
        <input className="note__input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} disabled={busy} aria-invalid={problem !== null} />
      </label>
      {problem !== null && (
        <p className="message message--error" role="alert">
          {problem}
        </p>
      )}
      {error !== null && (
        <p className="message message--error" role="alert">
          {error}
        </p>
      )}
      <div className="button-row popup__actions">
        <button type="button" className="button button--secondary" onClick={onCancel} disabled={busy}>
          {STRINGS.activityCancel}
        </button>
        <button type="button" className="button button--primary" onClick={() => onConfirm(note, activityInstant(when, initialWhen, new Date()))} disabled={busy || problem !== null}>
          {STRINGS.activityConfirm}
        </button>
      </div>
    </Dialog>
  );
}

/** Props for {@link CancelSponsorDialog}. */
interface CancelSponsorDialogProps {
  readonly noteMaxLength: number;
  readonly backdateDays: number;
  readonly busy: boolean;
  readonly error: string | null;
  readonly onConfirm: (note: string, when: Date) => void;
  readonly onCancel: () => void;
}

/** "Huỷ bảo trợ" popup (story 040): optional reason, date and time (default now), Confirm / Cancel. */
function CancelSponsorDialog({ noteMaxLength, backdateDays, busy, error, onConfirm, onCancel }: CancelSponsorDialogProps) {
  const [note, setNote] = useState('');
  const [initialWhen] = useState(() => toLocalInputValue(new Date()));
  const [when, setWhen] = useState(initialWhen);
  const check = validateActivityTime(new Date(when), new Date(), backdateDays);
  const problem =
    check === 'future' ? STRINGS.activityTimeFuture : check === 'too_old' ? activityTimeTooOldLabel(backdateDays) : check === 'invalid' ? STRINGS.activityTimeInvalid : null;
  return (
    <Dialog title={STRINGS.sponsorCancelTitle} onClose={onCancel}>
      <p className="popup__body">{STRINGS.sponsorCancelBody}</p>
      <label className="note popup__field">
        <span className="note__label">{STRINGS.sponsorCancelNoteLabel}</span>
        <textarea className="note__input" rows={3} maxLength={noteMaxLength} value={note} onChange={(e) => setNote(e.target.value)} disabled={busy} />
        <span className="popup__counter">{noteCounterLabel(note.length, noteMaxLength)}</span>
      </label>
      <label className="note popup__field">
        <span className="note__label">{STRINGS.activityDateTimeLabel}</span>
        <input className="note__input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} disabled={busy} aria-invalid={problem !== null} />
      </label>
      {problem !== null && (
        <p className="message message--error" role="alert">
          {problem}
        </p>
      )}
      {error !== null && (
        <p className="message message--error" role="alert">
          {error}
        </p>
      )}
      <div className="button-row popup__actions">
        <button type="button" className="button button--secondary" onClick={onCancel} disabled={busy}>
          {STRINGS.sponsorCancelKeep}
        </button>
        <button type="button" className="button button--danger" onClick={() => onConfirm(note, activityInstant(when, initialWhen, new Date()))} disabled={busy || problem !== null}>
          {STRINGS.sponsorCancelConfirm}
        </button>
      </div>
    </Dialog>
  );
}

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

/** Note field that grows with its text so the whole note is visible (no inner scrolling). */
function NoteTextarea({ value, onChange, disabled }: { readonly value: string; readonly onChange: (value: string) => void; readonly disabled: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
  }, [value]);
  return <textarea ref={ref} className="note__input note__input--grow" rows={2} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} />;
}

/** Country-code select (default first) plus a tel input. */
function PhoneInput({ country, number, onChange, disabled, error }: PhoneInputProps) {
  return (
    <div className="phone-field">
      <span className="note__label">{STRINGS.phoneNumberLabel}</span>
      <div className="phone-field__row">
        {/* Closed: only the code. Open: the native list shows code and country name. */}
        <span className="select-code phone-field__country">
          <span className="select-code__value" aria-hidden="true">
            {country}
          </span>
          <select value={country} onChange={(e) => onChange(e.target.value, number)} disabled={disabled} aria-label={STRINGS.phoneCountryLabel}>
            {COUNTRY_CODES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} {c.name}
              </option>
            ))}
          </select>
        </span>
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
          <NoteTextarea value={note} onChange={setNote} disabled={busy} />
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

/** Earliest history time of `taskId` (history rows exclude undone completions), or null. */
function firstDoneAt(history: readonly { readonly taskId?: string; readonly timestamp: string }[], taskId: string): string | null {
  let first: string | null = null;
  for (const h of history) if (h.taskId === taskId && (first === null || h.timestamp < first)) first = h.timestamp;
  return first;
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
 * one activity_logged event after a confirm popup with note and date/time, undo
 * by compensating event), an always-open info form (name/phone/code/note; Save
 * enabled only when a field differs from the saved person), a "Lịch sử" button
 * opening a summary + list popup (story 034) and archive (with confirm). State
 * of record is the event log; this only holds form state.
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
  const [activeTask, setActiveTask] = useState<PersonTaskDef | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [taskListOpen, setTaskListOpen] = useState(false);
  const [cancelSponsorOpen, setCancelSponsorOpen] = useState(false);
  const backdateDays = config.activityBackdateDays ?? PEOPLE_CONFIG.activityBackdateDays;
  const noteMaxLength = config.activityNoteMaxLength ?? PEOPLE_CONFIG.activityNoteMaxLength;

  const savedCountry = person.phone?.country ?? DEFAULT_COUNTRY;
  const dirty =
    name !== person.name || note !== person.note || country !== savedCountry || number !== (person.phone?.number ?? '') || code !== (person.amwayCode ?? '');
  const duplicate = name.trim() !== '' && findDuplicateNames(people, name, person.personId).duplicate;
  const sameCode = findDuplicateCodes(people).get(person.personId);
  const tasks = pendingTasks(person, config);
  const history = buildPersonHistory(events, person.personId, config, [...PERSON_TASKS, ...activityTypes]);
  const doneCounts = countDoneTasks(history);
  const summary = summarizeHistory(history, new Date());

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
      // Show what was stored (trimmed name, digits only) so the form is clean again.
      setName(checked.name);
      setNote(note.trim());
      setNumber(phone.phone?.number ?? '');
      setCode(amway.code ?? '');
      setInfo(STRINGS.personSaved);
    });

  const completeTask = (taskId: string, activityNote: string, when: Date) =>
    run(async () => {
      if (validateActivityTime(when, new Date(), backdateDays) !== 'ok') return;
      const built = buildTaskCompletionEvent(person, taskId, config, when.toISOString(), activityNote);
      if (!built.ok) {
        setActiveTask(null);
        return;
      }
      const saved = await eventStore.append(built.event);
      setActiveTask(null);
      setTaskUndo({ eventId: saved.id, taskName: config.tasks?.find((t) => t.id === taskId)?.name ?? '', xp: built.xp });
      await onChanged();
      // Chốt NPP also opens "Tạo tài khoản" (user decision 2026-11-09) when it can run now:
      // signed in (createAccount given), online, and the person has no account yet.
      const isNpp = config.tasks?.find((t) => t.id === taskId)?.label === 'NPP';
      if (isNpp && createAccount !== undefined && person.linkedUserId == null && navigator.onLine) createAccount.onOpen();
    });

  const cancelSponsorship = (reason: string, when: Date) =>
    run(async () => {
      if (validateActivityTime(when, new Date(), backdateDays) !== 'ok') return;
      const built = buildSponsorshipCancelEvent(person, when.toISOString(), reason);
      setCancelSponsorOpen(false);
      if (!built.ok) return;
      await eventStore.append(built.event);
      setTaskUndo(null);
      await onChanged();
      setInfo(STRINGS.sponsorCancelDone);
    });

  const undoTask = () =>
    run(async () => {
      if (taskUndo === null) return;
      await eventStore.append({ type: 'activity_logged', payload: { compensates: taskUndo.eventId } });
      setTaskUndo(null);
      await onChanged();
      setInfo(STRINGS.taskUndone);
    });

  const split = (mergeEventId: string, otherId: string) =>
    run(async () => {
      for (const event of buildSplitEvents(mergeEventId, person.personId, otherId)) await eventStore.append(event);
      await onChanged();
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
        {(person.phones ?? []).length > 0 && (
          <p className="screen__prompt">
            {STRINGS.dupOtherPhones}: <strong>{(person.phones ?? []).map((p) => formatPhone(p)).join(', ')}</strong>
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

      <section className="card person-section" aria-label={STRINGS.personInfoSectionTitle}>
        <h2 className="person-section__heading">{STRINGS.personInfoSectionTitle}</h2>
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
              <NoteTextarea value={note} onChange={setNote} disabled={busy} />
            </label>
            {duplicate && (
              <p className="message message--warn" role="status">
                {STRINGS.personDuplicateWarning}
              </p>
            )}
            <button type="button" className="button button--secondary" onClick={() => void saveEdits()} disabled={busy || !dirty}>
              {STRINGS.personSaveChanges}
            </button>
            {error !== null && activeTask === null && (
              <p className="message message--error" role="alert">
                {error}
              </p>
            )}
        </div>
        {info !== null && (
          <p className="message" role="status">
            {info}
          </p>
        )}
      </section>

      <section className="card person-section" aria-label={STRINGS.activitySectionTitle}>
        <div className="person-actions">
          <button
            type="button"
            className="button button--primary"
            onClick={() => {
              setError(null);
              setTaskListOpen(true);
            }}
            disabled={busy || tasks.length === 0}
          >
            {STRINGS.activitySectionTitle}
          </button>
          <button type="button" className="button button--secondary" onClick={() => setHistoryOpen(true)} disabled={busy}>
            {STRINGS.historyTitle}
          </button>
        </div>
        {person.archived && <p className="message">{STRINGS.activityArchivedNote}</p>}
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
      </section>

      {createAccount !== undefined && person.label === 'NPP' && !person.archived && person.linkedUserId == null && (
        <section className="card person-section" aria-label={STRINGS.createAccountTitle}>
          {(() => {
            const reason = navigator.onLine ? null : STRINGS.createAccountNeedsNetwork;
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

      {(person.absorbed ?? []).length > 0 && (
        <section className="card person-section" aria-label={STRINGS.dupMergedSection}>
          <h2 className="person-section__heading">{STRINGS.dupMergedSection}</h2>
          <ul className="people-list">
            {(person.absorbed ?? []).map((a) => (
              <li key={a.mergeEventId} className="person-row person-row--static">
                <span className="person-row__main">
                  <span className="person-row__name">{a.name}</span>
                </span>
                <button
                  type="button"
                  className="button button--secondary person-row__action"
                  aria-label={splitLabel(a.name)}
                  onClick={() => void split(a.mergeEventId, a.personId)}
                  disabled={busy}
                >
                  {STRINGS.dupSplit}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}


      {taskListOpen && (
        <Dialog title={STRINGS.activitySectionTitle} onClose={() => setTaskListOpen(false)}>
          <ul className="people-list">
            {tasks.map((t) => {
              const times = doneCounts.get(t.id) ?? 0;
              // One-time task already done: greyed out with its date, not selectable. Bảo trợ for a
              // person still NPP opens "Huỷ bảo trợ" instead (story 040).
              const doneOnce = !t.repeatable && (person.doneTaskIds ?? []).includes(t.id);
              const cancellable = doneOnce && t.label === 'NPP' && person.label === 'NPP';
              const doneAt = doneOnce ? (t.label === 'NPP' ? person.nppAt ?? null : firstDoneAt(history, t.id)) : null;
              const note = cancellable ? sponsorCancelHint(t.name, doneAt) : doneOnce ? taskDoneOnceLabel(t.name, doneAt) : times > 0 ? taskDoneTimesLabel(times) : null;
              const locked = doneOnce && !cancellable;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    className={locked ? 'task-row task-row--done' : cancellable ? 'task-row task-row--cancellable' : 'task-row'}
                    onClick={() => {
                      if (locked) return;
                      setError(null);
                      setTaskListOpen(false);
                      if (cancellable) setCancelSponsorOpen(true);
                      else setActiveTask(t);
                    }}
                    disabled={busy || locked}
                    aria-disabled={locked || undefined}
                    aria-label={doneOnce ? `${t.name}, ${note ?? ''}` : taskButtonLabel(t.name, t.xp, times)}
                  >
                    <span className="task-row__main">
                      <span className="task-row__name">{t.name}</span>
                      {note !== null && <span className="task-row__times">{note}</span>}
                    </span>
                    <span className="activity-option__xp">{xpLabel(t.xp)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <button type="button" className="button button--secondary" onClick={() => setTaskListOpen(false)}>
            {STRINGS.historyClose}
          </button>
        </Dialog>
      )}

      {activeTask !== null && (
        <ActivityDialog
          key={activeTask.id}
          task={activeTask}
          noteMaxLength={noteMaxLength}
          backdateDays={backdateDays}
          busy={busy}
          error={error}
          onConfirm={(activityNote, when) => void completeTask(activeTask.id, activityNote, when)}
          onCancel={() => setActiveTask(null)}
        />
      )}

      {cancelSponsorOpen && (
        <CancelSponsorDialog
          noteMaxLength={noteMaxLength}
          backdateDays={backdateDays}
          busy={busy}
          error={error}
          onConfirm={(reason, when) => void cancelSponsorship(reason, when)}
          onCancel={() => setCancelSponsorOpen(false)}
        />
      )}

      {historyOpen && (
        <Dialog title={STRINGS.historyTitle} onClose={() => setHistoryOpen(false)}>
          {history.length === 0 ? (
            <p className="message">{STRINGS.historyEmpty}</p>
          ) : (
            <>
              <section className="history-summary" aria-label={STRINGS.historySummaryTitle}>
                <h3 className="history-summary__heading">{STRINGS.historySummaryTitle}</h3>
                <ul className="history-summary__counts">
                  {summary.counts.map((c) => (
                    <li key={c.id}>
                      {c.name === '' ? STRINGS.legacyUnknownActivity : c.name}: <strong>{c.count}</strong>
                    </li>
                  ))}
                </ul>
                <dl className="history-summary__facts">
                  <dt>{STRINGS.historyTotalXpLabel}</dt>
                  <dd>{xpLabel(summary.totalXp)}</dd>
                  {summary.firstAt !== null && (
                    <>
                      <dt>{STRINGS.historyFirstLabel}</dt>
                      <dd>{dateTimeLabel(summary.firstAt)}</dd>
                    </>
                  )}
                  {summary.lastAt !== null && (
                    <>
                      <dt>{STRINGS.historyLastLabel}</dt>
                      <dd>{dateTimeLabel(summary.lastAt)}</dd>
                    </>
                  )}
                  {summary.daysSinceLast !== null && (
                    <>
                      <dt>{STRINGS.historyDaysSinceLabel}</dt>
                      <dd>{daysSinceLabel(summary.daysSinceLast)}</dd>
                    </>
                  )}
                </dl>
              </section>
              <h3 className="history-summary__heading">{STRINGS.historyListTitle}</h3>
              <ul className="history-list">
                {history.map((h) => {
                  const author = authorLabel?.(h.userId) ?? null;
                  return (
                    <li key={h.id} className="history-row history-row--stacked">
                      <span className="history-row__name">
                        {h.kind === 'stage' ? historyStageLabel(h.name) : h.kind === 'cancel' ? STRINGS.sponsorCancelHistory : h.name === '' ? STRINGS.legacyUnknownActivity : h.name}
                        {author !== null && <span className="history-row__author">{author}</span>}
                      </span>
                      <span className="person-row__stage">{dateTimeLabel(h.timestamp)}</span>
                      {h.note !== undefined && <span className="history-row__note">{h.note}</span>}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          <button type="button" className="button button--primary" onClick={() => setHistoryOpen(false)}>
            {STRINGS.historyClose}
          </button>
        </Dialog>
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
