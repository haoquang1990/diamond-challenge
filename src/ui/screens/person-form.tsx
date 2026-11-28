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
  formatE164,
  phoneKey,
  tidyNationalNumber,
  validatePhone,
} from '../../domain/people';
import type { PeopleConfig, Person, PersonPhone, PersonTaskDef } from '../../domain/people';
import { CONTACT_STALE_DAYS, COUNTRY_CODES, NOTE_AUTOSAVE_MS, PEOPLE_CONFIG, PERSON_TASKS } from '../people-config';
import { ADD_NAME_ID, activityInstant, buildNoteChangeEvent, buildOwnerChange, buildPersonHistory, personAddedAt, calendarDaysSince, countDoneTasks, createNoteAutosave, duplicateCodeNames, findDuplicateCodes, findPeopleWithCode, accountPhoneDiffers, formatPhone, phoneProblemText, splitE164, summarizeHistory, summaryCounts, toLocalInputValue } from '../people-helpers';
import type { HistoryEntry, NoteAutosave, NoteSaveState, OwnerChoice } from '../people-helpers';
import {
  STRINGS,
  activityTimeTooOldLabel,
  linkedAccountLine,
  linkedPhoneDiffersLabel,
  compactDateLabel,
  dateTimeLabel,
  daysCountLabel,
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
  /** "sheet": slides up from the bottom of the screen (story 052 sort choices). */
  readonly variant?: 'sheet';
}

/**
 * Modal popup (reuses `.popup-backdrop` / `.popup`): role="dialog", aria-modal, labelled by its
 * title. On open focus moves to the first field inside; Tab stays inside; Esc and a click on the
 * backdrop call `onClose`; the page behind does not scroll (body class) and the focus returns to
 * the opener on close. The content scrolls inside (max-height ~90vh).
 */
/** Dialogs open right now (they can stack). */
let openDialogs = 0;

export function Dialog({ title, onClose, children, variant }: DialogProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Story 065: dialogs can stack (Lịch sử › Sửa ghi chú); the page stays locked until the last one closes.
    openDialogs += 1;
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
      openDialogs -= 1;
      if (openDialogs === 0) document.body.classList.remove('dialog-open');
      // After the commit, so an opener that was disabled while saving can take focus again.
      setTimeout(() => opener?.focus(), 0);
    };
  }, []);

  return (
    <div
      className={variant === 'sheet' ? 'popup-backdrop popup-backdrop--sheet' : 'popup-backdrop'}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={panelRef} className={variant === 'sheet' ? 'popup popup--dialog popup--sheet' : 'popup popup--dialog'} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <h2 id={titleId} className="popup__title">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

/** Pencil icon of the edit buttons. */
function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M13.5 6.5l4 4" />
    </svg>
  );
}

/** Props for {@link NoteEditDialog}. */
interface NoteEditDialogProps {
  readonly entry: HistoryEntry;
  readonly maxLength: number;
  /** Resolves true once saved (the dialog is then closed by the caller). */
  readonly onSave: (note: string) => Promise<boolean>;
  readonly onCancel: () => void;
}

/**
 * "Sửa ghi chú" sheet (story 065): the activity and its time, the note to change (empty
 * removes it), Huỷ / Lưu. Only the note changes; type, time and XP stay.
 */
function NoteEditDialog({ entry, maxLength, onSave, onCancel }: NoteEditDialogProps) {
  const [text, setText] = useState(entry.note ?? '');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const unchanged = text.trim() === (entry.note ?? '');
  const save = async () => {
    setSaving(true);
    setFailed(false);
    const ok = await onSave(text);
    setSaving(false);
    if (!ok) setFailed(true);
  };
  return (
    <Dialog title={entry.note === undefined ? STRINGS.noteAddTitle : STRINGS.noteEditTitle} onClose={onCancel} variant="sheet">
      <p className="person-row__stage note-edit__what">
        {entry.name === '' ? STRINGS.legacyUnknownActivity : entry.name} · {dateTimeLabel(entry.timestamp)}
      </p>
      <label className="popup__field">
        <span className="visually-hidden">{STRINGS.noteEditTitle}</span>
        <textarea className="note__input" rows={4} maxLength={maxLength} value={text} onChange={(e) => setText(e.target.value)} disabled={saving} />
        <span className="popup__counter">{noteCounterLabel(text.length, maxLength)}</span>
      </label>
      {entry.note !== undefined && <p className="message note-edit__hint">{STRINGS.noteEditHint}</p>}
      {failed && (
        <p className="message message--error" role="alert">
          {STRINGS.noteEditError}
        </p>
      )}
      <div className="button-row popup__actions">
        <button type="button" className="button button--secondary" onClick={onCancel} disabled={saving}>
          {STRINGS.noteEditCancel}
        </button>
        <button type="button" className="button button--primary" onClick={() => void save()} disabled={saving || unchanged}>
          {STRINGS.noteEditSave}
        </button>
      </div>
    </Dialog>
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
function phoneErrorText(reason: 'unknown_country' | 'not_digits' | 'bad_length' | 'bad_vn'): string {
  return phoneProblemText(reason);
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
function NoteTextarea({
  value,
  onChange,
  disabled,
  placeholder,
  onBlur,
  ariaLabel,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly disabled: boolean;
  readonly placeholder?: string;
  readonly onBlur?: () => void;
  readonly ariaLabel?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      className="note__input note__input--grow"
      rows={2}
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      disabled={disabled}
    />
  );
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
          onBlur={() => {
            const tidy = tidyNationalNumber(country, number);
            if (tidy !== number) onChange(country, tidy);
          }}
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
  /** Extra section shown under Thông tin (story 042: "Hộ F1" for an NPP contact). */
  readonly extra?: ReactNode;
  /** The linked F1 account (story 059): the name it set and its login phone; null when unknown. */
  readonly linkedAccount?: { readonly displayName: string | null; readonly phone: string | null } | null;
  /** Story 066 "Phụ trách": my id, my co-member's id and name, and who looks after it now. */
  readonly owner?: { readonly meId: string; readonly spouseId: string; readonly spouseName: string; readonly current: OwnerChoice };
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
 * Detail view of one person, top to bottom (story 051): header (name, KH/NPP badge, edit icon,
 * phone to call and Amway code), "Tóm tắt" (days since the last activity, orange past
 * CONTACT_STALE_DAYS; per-task counts without "Thêm tên"; first contact; the FORMHD note,
 * edited in place and saved by itself), "Hoạt động" and "Lịch sử" buttons (task popup with
 * confirm and undo; history popup of story 034), then `extra` (F1 box). Name, phone and code
 * change in the "Sửa thông tin" popup. State of record is the event log; this only holds form
 * state.
 */
export function PersonDetail({ eventStore, person, people, events, activityTypes, config = PEOPLE_CONFIG, authorLabel, createAccount, extra, linkedAccount = null, owner, onChanged, onBack }: PersonDetailProps) {
  const [ownerSel, setOwnerSel] = useState<OwnerChoice>(owner?.current ?? 'me');
  const [name, setName] = useState(person.name);
  const [note, setNote] = useState(person.note);
  const [noteState, setNoteState] = useState<NoteSaveState | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [country, setCountry] = useState(person.phone?.country ?? DEFAULT_COUNTRY);
  const [number, setNumber] = useState(person.phone?.number ?? '');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [code, setCode] = useState(person.amwayCode ?? '');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [taskUndo, setTaskUndo] = useState<TaskUndo | null>(null);
  const [activeTask, setActiveTask] = useState<PersonTaskDef | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [noteEdit, setNoteEdit] = useState<HistoryEntry | null>(null);
  const [taskListOpen, setTaskListOpen] = useState(false);
  const [cancelSponsorOpen, setCancelSponsorOpen] = useState(false);
  const backdateDays = config.activityBackdateDays ?? PEOPLE_CONFIG.activityBackdateDays;
  const noteMaxLength = config.activityNoteMaxLength ?? PEOPLE_CONFIG.activityNoteMaxLength;

  const savedCountry = person.phone?.country ?? DEFAULT_COUNTRY;
  // Story 054: "0912 345 678" and a stored "912345678" are the same number, not a change.
  const typedKey = number.trim() === '' ? '' : phoneKey({ country, number: number.replace(/\s+/g, '') });
  const savedKey = (person.phone?.number ?? '') === '' ? '' : phoneKey({ country: savedCountry, number: person.phone?.number ?? '' });
  const ownerChanged = owner !== undefined && ownerSel !== owner.current;
  const dirty = ownerChanged || name !== person.name || typedKey !== savedKey || (typedKey === '' && country !== savedCountry) || code !== (person.amwayCode ?? '');
  const duplicate = name.trim() !== '' && findDuplicateNames(people, name, person.personId).duplicate;
  const sameCode = findDuplicateCodes(people).get(person.personId);
  const tasks = pendingTasks(person, config);
  const history = buildPersonHistory(events, person.personId, config, [...PERSON_TASKS, ...activityTypes]);
  const doneCounts = countDoneTasks(history);
  const summary = summarizeHistory(history, new Date());
  const addedAt = personAddedAt(events, person.personId);
  // Same "last activity" as the Làm list row (story 052): "Thêm tên" alone is not an activity.
  const lastDays = calendarDaysSince(person.lastContactAt ?? null, new Date());
  const chips = summaryCounts(summary.counts);

  // Story 051: the note saves itself (after NOTE_AUTOSAVE_MS of quiet, on blur, when leaving).
  const autosave = useRef<NoteAutosave | null>(null);
  const writeNote = useRef<(text: string) => Promise<void>>(async () => undefined);
  writeNote.current = async (text: string) => {
    await eventStore.append({ type: 'person_updated', payload: { personId: person.personId, note: text } });
    await onChanged();
  };
  useEffect(() => {
    const a = createNoteAutosave({ saved: person.note, delayMs: NOTE_AUTOSAVE_MS, save: (text) => writeNote.current(text), onState: setNoteState });
    autosave.current = a;
    return () => {
      void a.flush();
      a.dispose();
    };
    // Recreated only for another contact; the stored note is tracked inside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person.personId]);
  const changeNote = (text: string) => {
    setNote(text);
    autosave.current?.change(text);
  };
  const leave = () => {
    void autosave.current?.flush();
    onBack();
  };
  const openEdit = () => {
    setName(person.name);
    setCountry(person.phone?.country ?? DEFAULT_COUNTRY);
    setNumber(tidyNationalNumber(person.phone?.country ?? DEFAULT_COUNTRY, person.phone?.number ?? ''));
    setCode(person.amwayCode ?? '');
    setOwnerSel(owner?.current ?? 'me');
    setError(null);
    setPhoneError(null);
    setCodeError(null);
    setEditOpen(true);
  };

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
          phone: phone.phone ?? { country, number: '' },
          amwayCode: amway.code ?? '',
          ...(owner !== undefined && ownerChanged ? buildOwnerChange(person.personId, ownerSel, owner.meId, owner.spouseId).payload : {}),
        },
      });
      await onChanged();
      // Show what was stored (trimmed name, digits only) so the form is clean again.
      setName(checked.name);
      setNumber(phone.phone?.number ?? '');
      setCode(amway.code ?? '');
      setEditOpen(false);
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

  // Story 059: copy the linked account's login phone into this contact.
  const applyAccountPhone = () =>
    run(async () => {
      const phone = linkedAccount?.phone == null ? null : splitE164(linkedAccount.phone, COUNTRY_CODES);
      if (phone === null) return;
      await eventStore.append({ type: 'person_updated', payload: { personId: person.personId, phone } });
      await onChanged();
      setInfo(STRINGS.linkedPhoneUpdated);
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

  return (
    <main className="screen screen--tabbed">
      <header className="screen__header">
        <button type="button" className="back-button" onClick={leave} disabled={busy}>
          ‹ {STRINGS.back}
        </button>
        <div className="person-detail__head">
          <h1 className="screen__title person-detail__name">
            {person.name}
            {person.label != null && <LabelBadge label={person.label} />}
          </h1>
          <button type="button" className="icon-button person-detail__edit" aria-label={STRINGS.personEditTitle} onClick={openEdit} disabled={busy}>
            <PencilIcon />
          </button>
        </div>
        <p className="person-detail__contact">
          {person.phone != null && person.phone.number !== '' ? (
            <a href={`tel:${person.phone.country}${person.phone.number}`} aria-label={`${STRINGS.personDetailPhone} ${formatPhone(person.phone)}`}>
              {formatPhone(person.phone)}
            </a>
          ) : null}
          {person.phone != null && person.phone.number !== '' ? ' · ' : ''}
          {person.amwayCode != null ? (
            <>
              {STRINGS.personDetailAmwayCode} <strong>{person.amwayCode}</strong>
            </>
          ) : (
            STRINGS.personCodeNone
          )}
        </p>
        {(person.phones ?? []).length > 0 && (
          <p className="screen__prompt">
            {STRINGS.dupOtherPhones}: <strong>{(person.phones ?? []).map((p) => formatPhone(p)).join(', ')}</strong>
          </p>
        )}
        {person.linkedUserId != null && (
          <p className="linked-account" aria-label={STRINGS.linkedAccountLabel}>
            <span aria-hidden="true">👤</span>
            <span>
              {linkedAccount === null
                ? STRINGS.createAccountHasAccount
                : linkedAccountLine(linkedAccount.displayName, linkedAccount.phone === null ? null : formatE164(linkedAccount.phone))}
            </span>
          </p>
        )}
        {person.linkedUserId != null && linkedAccount !== null && accountPhoneDiffers(person.phone, linkedAccount.phone, COUNTRY_CODES) && (
          <div className="message message--warn linked-account__warn" role="status">
            <span>{linkedPhoneDiffersLabel(formatE164(linkedAccount.phone ?? ''))}</span>
            <button type="button" className="button button--secondary linked-account__fix" onClick={() => void applyAccountPhone()} disabled={busy}>
              {STRINGS.linkedPhoneUpdate}
            </button>
          </div>
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

      <section className="card person-section person-summary" aria-labelledby="person-summary-title">
        <h2 id="person-summary-title" className="person-section__heading">
          {STRINGS.summaryTitle}
        </h2>
        <div className="person-summary__row">
          <span className="person-summary__key">{STRINGS.summaryLastLabel}</span>
          <span className={lastDays !== null && lastDays >= CONTACT_STALE_DAYS ? 'person-summary__value person-summary__value--stale' : 'person-summary__value'}>
            {lastDays === null ? STRINGS.summaryNoActivity : daysSinceLabel(lastDays)}
            {lastDays !== null && lastDays >= CONTACT_STALE_DAYS ? ' ⚠' : ''}
          </span>
        </div>
        {chips.length > 0 && (
          <ul className="person-summary__chips">
            {chips.map((c) => (
              <li key={c.id} className="person-summary__chip">
                {c.name === '' ? STRINGS.legacyUnknownActivity : c.name} <strong>{c.count}</strong>
              </li>
            ))}
          </ul>
        )}
        <label className="note person-summary__note">
          <span className="note__label">{STRINGS.noteLabel}</span>
          <NoteTextarea value={note} onChange={changeNote} onBlur={() => void autosave.current?.flush()} disabled={false} placeholder={STRINGS.notePlaceholder} />
        </label>
        <p className={noteState === 'error' ? 'person-summary__saved person-summary__saved--error' : 'person-summary__saved'} role="status" aria-live="polite">
          {noteState === 'saving' ? STRINGS.noteSaving : noteState === 'saved' ? STRINGS.noteSavedMark : noteState === 'error' ? STRINGS.noteSaveError : ''}
        </p>
        {info !== null && (
          <p className="message" role="status">
            {info}
          </p>
        )}
        {error !== null && !editOpen && activeTask === null && (
          <p className="message message--error" role="alert">
            {error}
          </p>
        )}
      </section>

      <section className="person-section person-actions-block" aria-label={STRINGS.activitySectionTitle}>
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

      {extra}

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

      {editOpen && (
        <Dialog title={STRINGS.personEditTitle} onClose={() => setEditOpen(false)}>
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
            {duplicate && (
              <p className="message message--warn" role="status">
                {STRINGS.personDuplicateWarning}
              </p>
            )}
            {owner !== undefined && (
              <div className="popup__field owner-field" role="radiogroup" aria-labelledby="owner-field-label">
                <span id="owner-field-label" className="owner-field__label">
                  {STRINGS.ownerField}
                </span>
                <div className="owner-field__options">
                  {(['me', 'spouse', 'both'] as const).map((c) => (
                    <button key={c} type="button" role="radio" aria-checked={ownerSel === c} className={ownerSel === c ? 'owner-option owner-option--on' : 'owner-option'} onClick={() => setOwnerSel(c)} disabled={busy}>
                      {c === 'me' ? STRINGS.ownerMe : c === 'spouse' ? owner.spouseName : STRINGS.ownerBoth}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {error !== null && activeTask === null && (
              <p className="message message--error" role="alert">
                {error}
              </p>
            )}
            <div className="button-row popup__actions">
              <button type="button" className="button button--secondary" onClick={() => setEditOpen(false)} disabled={busy}>
                {STRINGS.personEditCancel}
              </button>
              <button type="button" className="button button--primary" onClick={() => void saveEdits()} disabled={busy || !dirty}>
                {STRINGS.personEditSave}
              </button>
            </div>
          </div>
        </Dialog>
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
                  {summary.counts
                    .filter((c) => c.id !== ADD_NAME_ID)
                    .map((c) => (
                      <li key={c.id}>
                        {c.name === '' ? STRINGS.legacyUnknownActivity : c.name}: <strong>{c.count}</strong>
                      </li>
                    ))}
                </ul>
                <dl className="history-summary__facts history-summary__facts--inline">
                  {(addedAt ?? summary.firstAt) !== null && (
                    <>
                      <dt>{STRINGS.historyAddedLabel}</dt>
                      <dd>{compactDateLabel((addedAt ?? summary.firstAt)!)}</dd>
                    </>
                  )}
                  {summary.lastAt !== null && (
                    <>
                      <dt>{STRINGS.historyLatestLabel}</dt>
                      <dd>{compactDateLabel(summary.lastAt)}</dd>
                    </>
                  )}
                  {summary.daysSinceLast !== null && (
                    <>
                      <dt>{STRINGS.historyDaysSinceLabel}</dt>
                      <dd>{daysCountLabel(summary.daysSinceLast)}</dd>
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
                      {(() => {
                        // Story 065: activities (not "Thêm tên", stage rows or Huỷ bảo trợ) get ✏️ / "+ Thêm ghi chú".
                        const editable = h.kind === 'activity' && h.taskId !== ADD_NAME_ID;
                        if (h.note === undefined)
                          return editable ? (
                            <button type="button" className="history-row__add-note" onClick={() => setNoteEdit(h)} disabled={busy}>
                              {STRINGS.noteAddButton}
                            </button>
                          ) : null;
                        return (
                          <span className="history-row__note-line">
                            <span className="history-row__note">
                              {h.note}
                              {h.noteEdited === true && <small className="history-row__edited">{STRINGS.noteEdited}</small>}
                            </span>
                            {editable && (
                              <button type="button" className="history-row__edit" aria-label={STRINGS.noteEditButton} onClick={() => setNoteEdit(h)} disabled={busy}>
                                <PencilIcon />
                              </button>
                            )}
                          </span>
                        );
                      })()}
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

      {noteEdit !== null && (
        <NoteEditDialog
          entry={noteEdit}
          maxLength={noteMaxLength}
          onCancel={() => setNoteEdit(null)}
          onSave={async (text) => {
            const built = buildNoteChangeEvent(person.personId, noteEdit.id, text, noteMaxLength);
            if (!built.ok) return false;
            try {
              await eventStore.append(built.event);
              await onChanged();
              setNoteEdit(null);
              return true;
            } catch (e) {
              console.error('[person] could not save the note change', e);
              return false;
            }
          }}
        />
      )}

    </main>
  );
}

/** KH / NPP badge. */
export function LabelBadge({ label }: { readonly label: 'KH' | 'NPP' }) {
  return <span className={label === 'KH' ? 'badge badge--kh' : 'badge badge--npp'}>{label === 'KH' ? STRINGS.labelKh : STRINGS.labelNpp}</span>;
}
