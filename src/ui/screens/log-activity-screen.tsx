import { useCallback, useEffect, useState } from 'react';
import type { EventStore, LogEvent } from '../../data/event-store';
import { buildStageChangeEvent, derivePeople } from '../../domain/people';
import type { Person } from '../../domain/people';
import { ACTIVITY_TYPES } from '../activity-types';
import type { ActivityType } from '../activity-types';
import { PEOPLE_CONFIG } from '../people-config';
import { suggestStageChange } from '../people-helpers';
import { playTing } from '../play-ting';
import { STRINGS, stageChangedLabel, stageSuggestionLabel, xpLabel } from '../strings';
import { AddPersonForm } from './person-form';

/**
 * How long the "+XP" feedback (with its undo button) stays before returning
 * to Hôm nay. PLACEHOLDER pending a ux-designer timing; not in the brief.
 */
export const SAVED_FEEDBACK_MS = 2500;

/** Props for {@link LogActivityScreen}. */
export interface LogActivityScreenProps {
  /** Event log the activity is appended to (injected; no singleton). */
  readonly eventStore: EventStore;
  /** Called when the flow is finished (after the saved feedback); story 004 routes back to Hôm nay. */
  readonly onDone: () => void;
  /** Activity types to offer; defaults to the ones in game-config.json. */
  readonly activityTypes?: readonly ActivityType[];
  /** When provided, a back button is shown that calls it (leave without saving). */
  readonly onCancel?: () => void;
}

/**
 * Screen states:
 * - `editing`: pick a type, optional note; `error` set after a failed save or undo.
 * - `saving`: append in flight, inputs disabled.
 * - `saved`: XP feedback + undo; auto-calls `onDone` after {@link SAVED_FEEDBACK_MS}.
 * - `undoing`: compensating append in flight.
 */
type ScreenState =
  | { readonly kind: 'editing'; readonly error: string | null; readonly undone: boolean }
  | { readonly kind: 'saving' }
  | { readonly kind: 'saved'; readonly event: LogEvent; readonly xp: number; readonly error: string | null }
  | { readonly kind: 'undoing'; readonly event: LogEvent; readonly xp: number };

/** One-tap "move this person to the suggested stage?" prompt shown after a save. */
type StagePrompt =
  | { readonly kind: 'none' }
  | { readonly kind: 'ask'; readonly person: Person; readonly stageId: string; readonly stageName: string; readonly xp: number }
  | { readonly kind: 'busy' }
  | { readonly kind: 'result'; readonly label: string };

/**
 * Màn Làm: log one real-world activity (brief MVP feature 1, story 003).
 *
 * Step 0 (story 009): choose one person, or add a new one right there.
 * Taps from Hôm nay with an empty note: open (1) → pick person (2) → pick type (3) → Lưu (4).
 * Saving appends `activity_logged` with payload `{ activityType, xp, personId, note? }`.
 * When the type has `suggestsStage` and it is ahead of the person's stage, a
 * Yes/No prompt follows; a stage is never changed automatically.
 * Undo appends a compensating `activity_logged` with `{ compensates: id }`;
 * nothing is ever deleted.
 */
export function LogActivityScreen({
  eventStore,
  onDone,
  activityTypes = ACTIVITY_TYPES,
  onCancel,
}: LogActivityScreenProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [state, setState] = useState<ScreenState>({ kind: 'editing', error: null, undone: false });
  const [people, setPeople] = useState<readonly Person[] | null>(null);
  const [peopleError, setPeopleError] = useState(false);
  const [personId, setPersonId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<StagePrompt>({ kind: 'none' });

  const loadPeople = useCallback(async (): Promise<readonly Person[]> => {
    const events = await eventStore.list();
    const active = derivePeople(events, PEOPLE_CONFIG).filter((p) => !p.archived);
    setPeople(active);
    return active;
  }, [eventStore]);

  useEffect(() => {
    loadPeople().catch((error: unknown) => {
      console.error('[log-activity] could not load people', error);
      setPeopleError(true);
    });
  }, [loadPeople]);

  async function addPerson(name: string, note: string): Promise<void> {
    const newId = crypto.randomUUID();
    await eventStore.append({ type: 'person_added', payload: { personId: newId, name, ...(note === '' ? {} : { note }) } });
    await loadPeople();
    setPersonId(newId);
  }

  const selected = activityTypes.find((t) => t.id === selectedId) ?? null;
  const chosenPerson = people?.find((p) => p.personId === personId) ?? null;
  const promptOpen = prompt.kind === 'ask' || prompt.kind === 'busy';

  // The auto-return waits while the stage prompt is open.
  useEffect(() => {
    if (state.kind !== 'saved' || promptOpen) return undefined;
    const timer = window.setTimeout(onDone, SAVED_FEEDBACK_MS);
    return () => window.clearTimeout(timer);
  }, [state.kind, promptOpen, onDone]);

  async function save(): Promise<void> {
    if (selected === null || chosenPerson === null || state.kind !== 'editing') return;
    setState({ kind: 'saving' });
    const trimmedNote = note.trim();
    try {
      const event = await eventStore.append({
        type: 'activity_logged',
        payload: {
          activityType: selected.id,
          xp: selected.xp,
          personId: chosenPerson.personId,
          ...(trimmedNote === '' ? {} : { note: trimmedNote }),
        },
      });
      playTing();
      setPrompt({ kind: 'none' });
      setState({ kind: 'saved', event, xp: selected.xp, error: null });
      if (selected.suggestsStage !== undefined) {
        try {
          const fresh = (await loadPeople()).find((p) => p.personId === chosenPerson.personId);
          const suggestion = fresh === undefined ? null : suggestStageChange(fresh, selected.suggestsStage, PEOPLE_CONFIG);
          if (fresh !== undefined && suggestion !== null) {
            setPrompt({ kind: 'ask', person: fresh, stageId: suggestion.stage.id, stageName: suggestion.stage.name, xp: suggestion.xp });
          }
        } catch (error) {
          console.error('[log-activity] could not check the stage suggestion', error);
        }
      }
    } catch (error) {
      console.error('[log-activity] save failed', error);
      setState({ kind: 'editing', error: STRINGS.saveError, undone: false });
    }
  }

  async function undo(): Promise<void> {
    if (state.kind !== 'saved') return;
    const { event, xp } = state;
    setPrompt({ kind: 'none' });
    setState({ kind: 'undoing', event, xp });
    try {
      await eventStore.append({ type: 'activity_logged', payload: { compensates: event.id } });
      setState({ kind: 'editing', error: null, undone: true });
    } catch (error) {
      console.error('[log-activity] undo failed', error);
      setState({ kind: 'saved', event, xp, error: STRINGS.undoError });
    }
  }

  async function answerPrompt(accept: boolean): Promise<void> {
    if (prompt.kind !== 'ask') return;
    if (!accept) {
      setPrompt({ kind: 'none' });
      return;
    }
    const { person, stageId } = prompt;
    setPrompt({ kind: 'busy' });
    const built = buildStageChangeEvent(person, stageId, PEOPLE_CONFIG);
    if (!built.ok) {
      setPrompt({ kind: 'none' });
      return;
    }
    try {
      await eventStore.append(built.event);
      const stageName = PEOPLE_CONFIG.stages.find((s) => s.id === stageId)?.name ?? '';
      setPrompt({ kind: 'result', label: stageChangedLabel(stageName, built.xp) });
    } catch (error) {
      console.error('[log-activity] stage change failed', error);
      setPrompt({ kind: 'result', label: STRINGS.saveError });
    }
  }

  if (state.kind === 'saved' || state.kind === 'undoing') {
    const undoing = state.kind === 'undoing';
    return (
      <main className="screen screen--saved">
        <div className="saved-feedback" role="status" aria-live="polite">
          <div className="saved-feedback__gem" aria-hidden="true">
            ◆
          </div>
          <p className="saved-feedback__title">{STRINGS.savedTitle}</p>
          <p className="saved-feedback__xp">{xpLabel(state.xp)}</p>
          {state.kind === 'saved' && state.error !== null && (
            <p className="message message--error" role="alert">
              {state.error}
            </p>
          )}
          {state.kind === 'saved' && (prompt.kind === 'ask' || prompt.kind === 'busy') && (
            <div className="stage-prompt" role="group" aria-label={STRINGS.personChangeStage}>
              <p className="stage-prompt__text">
                {prompt.kind === 'ask' ? stageSuggestionLabel(prompt.person.name, prompt.stageName, prompt.xp) : STRINGS.saving}
              </p>
              <div className="button-row">
                <button type="button" className="button button--secondary" onClick={() => void answerPrompt(false)} disabled={prompt.kind === 'busy'}>
                  {STRINGS.stageSuggestNo}
                </button>
                <button type="button" className="button button--primary" onClick={() => void answerPrompt(true)} disabled={prompt.kind === 'busy'}>
                  {STRINGS.stageSuggestYes}
                </button>
              </div>
            </div>
          )}
          {state.kind === 'saved' && prompt.kind === 'result' && <p className="message">{prompt.label}</p>}
        </div>
        <div className="action-bar">
          <button type="button" className="button button--secondary" onClick={() => void undo()} disabled={undoing}>
            {undoing ? STRINGS.undoing : STRINGS.undo}
          </button>
          <button type="button" className="button button--primary" onClick={onDone} disabled={undoing}>
            {STRINGS.continue}
          </button>
        </div>
      </main>
    );
  }

  const busy = state.kind === 'saving';

  if (chosenPerson === null) {
    return (
      <main className="screen">
        <header className="screen__header">
          {onCancel !== undefined && (
            <button type="button" className="back-button" onClick={onCancel}>
              ‹ {STRINGS.back}
            </button>
          )}
          <h1 className="screen__title">{STRINGS.logActivityTitle}</h1>
          <p className="screen__prompt">{STRINGS.pickPersonPrompt}</p>
        </header>
        {peopleError && (
          <p className="message message--error" role="alert">
            {STRINGS.peopleLoadError}
          </p>
        )}
        {people === null && !peopleError && <p className="message">{STRINGS.loading}</p>}
        {people !== null && people.length === 0 && <p className="message">{STRINGS.pickPersonEmpty}</p>}
        {people !== null && people.length > 0 && (
          <div className="activity-list" role="radiogroup" aria-label={STRINGS.pickPersonPrompt}>
            {people.map((p) => (
              <button
                key={p.personId}
                type="button"
                role="radio"
                aria-checked={false}
                className="activity-option"
                onClick={() => setPersonId(p.personId)}
              >
                <span className="activity-option__name">{p.name}</span>
                <span className="activity-option__stage">
                  {PEOPLE_CONFIG.stages.find((st) => st.id === p.stageId)?.name ?? ''}
                </span>
              </button>
            ))}
          </div>
        )}
        {people !== null && (
          <section className="card person-section" aria-label={STRINGS.pickPersonAddHeading}>
            <h2 className="person-section__heading">{STRINGS.pickPersonAddHeading}</h2>
            <AddPersonForm people={people} onSubmit={addPerson} compact />
          </section>
        )}
      </main>
    );
  }

  return (
    <main className="screen">
      <header className="screen__header">
        {onCancel !== undefined && (
          <button type="button" className="back-button" onClick={onCancel} disabled={busy}>
            ‹ {STRINGS.back}
          </button>
        )}
        <h1 className="screen__title">{STRINGS.logActivityTitle}</h1>
        <p className="screen__prompt">{STRINGS.logActivityPrompt}</p>
        <p className="chosen-person">
          {STRINGS.withPerson}: <strong>{chosenPerson.name}</strong>{' '}
          <button type="button" className="link-button" onClick={() => setPersonId(null)} disabled={busy}>
            {STRINGS.changePerson}
          </button>
        </p>
      </header>

      {activityTypes.length === 0 ? (
        <p className="message">{STRINGS.noActivityTypes}</p>
      ) : (
        <div className="activity-list" role="radiogroup" aria-label={STRINGS.logActivityPrompt}>
          {activityTypes.map((type) => {
            const checked = type.id === selectedId;
            return (
              <button
                key={type.id}
                type="button"
                role="radio"
                aria-checked={checked}
                className={checked ? 'activity-option activity-option--selected' : 'activity-option'}
                onClick={() => setSelectedId(type.id)}
                disabled={busy}
              >
                <span className="activity-option__name">{type.name}</span>
                <span className="activity-option__xp">{xpLabel(type.xp)}</span>
              </button>
            );
          })}
        </div>
      )}

      <label className="note">
        <span className="note__label">{STRINGS.noteLabel}</span>
        <textarea
          className="note__input"
          rows={2}
          value={note}
          placeholder={STRINGS.notePlaceholder}
          onChange={(e) => setNote(e.target.value)}
          disabled={busy}
        />
      </label>

      {state.kind === 'editing' && state.error !== null && (
        <p className="message message--error" role="alert">
          {state.error}
        </p>
      )}
      {state.kind === 'editing' && state.undone && (
        <p className="message" role="status">
          {STRINGS.undone}
        </p>
      )}

      <div className="action-bar">
        <button
          type="button"
          className="button button--primary"
          onClick={() => void save()}
          disabled={selected === null || busy}
        >
          {busy ? STRINGS.saving : selected === null ? STRINGS.pickFirst : `${STRINGS.save} · ${xpLabel(selected.xp)}`}
        </button>
      </div>
    </main>
  );
}
