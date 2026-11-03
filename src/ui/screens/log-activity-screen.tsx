import { useEffect, useState } from 'react';
import type { EventStore, LogEvent } from '../../data/event-store';
import { ACTIVITY_TYPES } from '../activity-types';
import type { ActivityType } from '../activity-types';
import { playTing } from '../play-ting';
import { STRINGS, xpLabel } from '../strings';

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

/**
 * Màn Làm: log one real-world activity (brief MVP feature 1, story 003).
 *
 * Taps from Hôm nay with an empty note: open (1) → pick type (2) → Lưu (3).
 * Saving appends `activity_logged` with payload `{ activityType, xp, note? }`.
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

  const selected = activityTypes.find((t) => t.id === selectedId) ?? null;

  useEffect(() => {
    if (state.kind !== 'saved') return undefined;
    const timer = window.setTimeout(onDone, SAVED_FEEDBACK_MS);
    return () => window.clearTimeout(timer);
  }, [state.kind, onDone]);

  async function save(): Promise<void> {
    if (selected === null || state.kind !== 'editing') return;
    setState({ kind: 'saving' });
    const trimmedNote = note.trim();
    try {
      const event = await eventStore.append({
        type: 'activity_logged',
        payload: {
          activityType: selected.id,
          xp: selected.xp,
          ...(trimmedNote === '' ? {} : { note: trimmedNote }),
        },
      });
      playTing();
      setState({ kind: 'saved', event, xp: selected.xp, error: null });
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
