import { useState } from 'react';
import type { EventStore } from '../../data/event-store';
import { buildStageChangeEvent, findDuplicateNames, planStageChange, validatePersonName } from '../../domain/people';
import type { PeopleConfig, Person } from '../../domain/people';
import { STRINGS, stageChangedLabel, stageXpPreview } from '../strings';

/** Props for {@link AddPersonForm}. */
export interface AddPersonFormProps {
  /** People used for the non-blocking duplicate-name warning. */
  readonly people: readonly Person[];
  /** Writes the person; a rejected promise shows a save error and keeps the input. */
  readonly onSubmit: (name: string, note: string) => Promise<void>;
  /** Hide the note field (compact use inside the Làm flow). */
  readonly compact?: boolean;
}

/**
 * Name (required, trimmed) + optional note. An empty name is rejected with a
 * message and `onSubmit` is not called. A duplicate name only warns.
 */
export function AddPersonForm({ people, onSubmit, compact = false }: AddPersonFormProps) {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const duplicate = name.trim() !== '' && findDuplicateNames(people, name).duplicate;

  async function submit(): Promise<void> {
    const checked = validatePersonName(name);
    if (!checked.ok) {
      setError(STRINGS.personNameRequired);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(checked.name, note.trim());
      setName('');
      setNote('');
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
  readonly config: PeopleConfig;
  /** Re-read the log after any write. */
  readonly onChanged: () => Promise<void>;
  readonly onBack: () => void;
}

interface StageUndo {
  readonly eventId: string;
  readonly stageName: string;
  readonly xp: number;
}

/**
 * Detail view of one person: edit name/note, change stage (with XP preview and
 * undo by compensating event) and archive (with confirm). State of record is
 * the event log; this only holds form state.
 */
export function PersonDetail({ eventStore, person, people, config, onChanged, onBack }: PersonDetailProps) {
  const [name, setName] = useState(person.name);
  const [note, setNote] = useState(person.note);
  const [targetStage, setTargetStage] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [stageUndo, setStageUndo] = useState<StageUndo | null>(null);

  const currentStage = config.stages.find((s) => s.id === person.stageId);
  const duplicate = name.trim() !== '' && findDuplicateNames(people, name, person.personId).duplicate;
  const targetPlan = targetStage === null ? null : planStageChange(person, targetStage, config);
  const targetDef = config.stages.find((s) => s.id === targetStage);

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
      await eventStore.append({
        type: 'person_updated',
        payload: { personId: person.personId, name: checked.name, note: note.trim() },
      });
      await onChanged();
      setInfo(STRINGS.personSaved);
    });

  const changeStage = () =>
    run(async () => {
      if (targetStage === null) return;
      const built = buildStageChangeEvent(person, targetStage, config);
      if (!built.ok) return;
      const saved = await eventStore.append(built.event);
      setStageUndo({ eventId: saved.id, stageName: targetDef?.name ?? '', xp: built.xp });
      setTargetStage(null);
      await onChanged();
    });

  const undoStage = () =>
    run(async () => {
      if (stageUndo === null) return;
      await eventStore.append({ type: 'person_stage_changed', payload: { compensates: stageUndo.eventId } });
      setStageUndo(null);
      await onChanged();
      setInfo(STRINGS.personStageUndone);
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
        <h1 className="screen__title">{STRINGS.personDetailTitle}</h1>
      </header>

      <section className="card person-section" aria-label={STRINGS.personDetailTitle}>
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
      </section>

      <section className="card person-section" aria-label={STRINGS.personChangeStage}>
        <h2 className="person-section__heading">{STRINGS.personChangeStage}</h2>
        <p className="message">
          {STRINGS.personCurrentStage}: <strong>{currentStage?.name ?? person.stageId}</strong>
        </p>
        <div className="activity-list" role="radiogroup" aria-label={STRINGS.personStagePickFirst}>
          {config.stages
            .filter((s) => s.id !== person.stageId)
            .map((s) => {
              const plan = planStageChange(person, s.id, config);
              const checked = s.id === targetStage;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  className={checked ? 'activity-option activity-option--selected' : 'activity-option'}
                  onClick={() => setTargetStage(s.id)}
                  disabled={busy}
                >
                  <span className="activity-option__name">{s.name}</span>
                  <span className="activity-option__xp">{stageXpPreview(plan.ok ? plan.xp : 0)}</span>
                </button>
              );
            })}
        </div>
        <button
          type="button"
          className="button button--primary"
          onClick={() => void changeStage()}
          disabled={busy || targetPlan === null || !targetPlan.ok}
        >
          {targetPlan === null || !targetPlan.ok
            ? STRINGS.personStagePickFirst
            : `${STRINGS.personChangeStageConfirm} · ${stageXpPreview(targetPlan.xp)}`}
        </button>
        {stageUndo !== null && (
          <div className="person-result" role="status" aria-live="polite">
            <p className="message">{stageChangedLabel(stageUndo.stageName, stageUndo.xp)}</p>
            <button type="button" className="button button--secondary" onClick={() => void undoStage()} disabled={busy}>
              {STRINGS.undo}
            </button>
          </div>
        )}
      </section>

      {error !== null && (
        <p className="message message--error" role="alert">
          {error}
        </p>
      )}
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

