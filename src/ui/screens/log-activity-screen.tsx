import { useCallback, useEffect, useState } from 'react';
import type { EventStore, LogEvent } from '../../data/event-store';
import { buildTaskCompletionEvent, derivePeople, pendingTasks } from '../../domain/people';
import type { Person } from '../../domain/people';
import type { ActivityType } from '../activity-types';
import { PEOPLE_CONFIG } from '../people-config';
import { playTing } from '../play-ting';
import { STRINGS, taskButtonLabel, xpLabel } from '../strings';
import { AddPersonForm, LabelBadge } from './person-form';

/**
 * How long the "+XP" feedback (with its undo button) stays before returning
 * to Hôm nay. PLACEHOLDER pending a ux-designer timing; not in the brief.
 */
export const SAVED_FEEDBACK_MS = 2500;

/** Props for {@link LogActivityScreen}. */
export interface LogActivityScreenProps {
  /** Event log the activity is appended to (injected; no singleton). */
  readonly eventStore: EventStore;
  /** Called when the flow is finished (after the saved feedback); routes back to Hôm nay. */
  readonly onDone: () => void;
  /**
   * @deprecated No longer drives this screen (the choices are the person's
   * pending tasks); kept so existing callers still type-check.
   */
  readonly activityTypes?: readonly ActivityType[];
  /** When provided, a back button is shown that calls it (leave without saving). */
  readonly onCancel?: () => void;
}

/**
 * Screen states:
 * - `editing`: pick a person, then one of their pending tasks; `error` set after a failed save or undo.
 * - `saving`: append in flight, inputs disabled.
 * - `saved`: XP feedback + undo; auto-calls `onDone` after {@link SAVED_FEEDBACK_MS}.
 * - `undoing`: compensating append in flight.
 */
type ScreenState =
  | { readonly kind: 'editing'; readonly error: string | null; readonly undone: boolean }
  | { readonly kind: 'saving' }
  | { readonly kind: 'saved'; readonly event: LogEvent; readonly xp: number; readonly error: string | null }
  | { readonly kind: 'undoing'; readonly event: LogEvent; readonly xp: number };

/**
 * Màn Hoạt động: complete one pending task for one person (stories 012-014).
 *
 * Step 1: choose a person, or add a new one right there.
 * Step 2: tap one of that person's pending tasks (config order, XP shown).
 * The tap appends the same `activity_logged` event as the person detail page.
 * Undo appends a compensating `activity_logged` with `{ compensates: id }`;
 * nothing is ever deleted. The app never writes `person_stage_changed` here.
 */
export function LogActivityScreen({ eventStore, onDone, onCancel }: LogActivityScreenProps) {
  const [state, setState] = useState<ScreenState>({ kind: 'editing', error: null, undone: false });
  const [people, setPeople] = useState<readonly Person[] | null>(null);
  const [peopleError, setPeopleError] = useState(false);
  const [personId, setPersonId] = useState<string | null>(null);

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

  const chosenPerson = people?.find((p) => p.personId === personId) ?? null;

  useEffect(() => {
    if (state.kind !== 'saved') return undefined;
    const timer = window.setTimeout(onDone, SAVED_FEEDBACK_MS);
    return () => window.clearTimeout(timer);
  }, [state.kind, onDone]);

  async function complete(taskId: string): Promise<void> {
    if (chosenPerson === null || state.kind !== 'editing') return;
    const built = buildTaskCompletionEvent(chosenPerson, taskId, PEOPLE_CONFIG);
    if (!built.ok) return;
    setState({ kind: 'saving' });
    try {
      const event = await eventStore.append(built.event);
      playTing();
      setState({ kind: 'saved', event, xp: built.xp, error: null });
      loadPeople().catch((error: unknown) => console.error('[log-activity] reload after save failed', error));
    } catch (error) {
      console.error('[log-activity] save failed', error);
      setState({ kind: 'editing', error: STRINGS.saveError, undone: false });
    }
  }

  async function undo(): Promise<void> {
    if (state.kind !== 'saved') return;
    const { event, xp } = state;
    setState({ kind: 'undoing', event, xp });
    try {
      await eventStore.append({ type: 'activity_logged', payload: { compensates: event.id } });
      await loadPeople();
      setState({ kind: 'editing', error: null, undone: true });
    } catch (error) {
      console.error('[log-activity] undo failed', error);
      setState({ kind: 'saved', event, xp, error: STRINGS.undoError });
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
                {p.label != null && <LabelBadge label={p.label} />}
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

  const tasks = pendingTasks(chosenPerson, PEOPLE_CONFIG);

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
          {STRINGS.withPerson}: <strong>{chosenPerson.name}</strong>
          {chosenPerson.label != null && <> <LabelBadge label={chosenPerson.label} /></>}{' '}
          <button type="button" className="link-button" onClick={() => setPersonId(null)} disabled={busy}>
            {STRINGS.changePerson}
          </button>
        </p>
      </header>

      {tasks.length === 0 ? (
        <p className="message">{STRINGS.pickTaskNone}</p>
      ) : (
        <ul className="people-list" aria-label={STRINGS.pickTaskHeading}>
          {tasks.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                className="task-row"
                onClick={() => void complete(t.id)}
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
    </main>
  );
}
