import { useCallback, useEffect, useState } from 'react';
import gameConfig from '../../config/game-config.json';
import type { EventStore } from '../../data/event-store';
import { computeProgress } from '../../domain/progress';
import type { Progress, ProgressConfig } from '../../domain/progress';
import {
  STRINGS,
  keepStreakLabel,
  streakLabel,
  xpProgressLabel,
  xpRemainingLabel,
} from '../strings';

/** Props for {@link TodayScreen}. */
export interface TodayScreenProps {
  /** Event log progress is derived from (injected; no singleton). */
  readonly eventStore: EventStore;
  /** Opens Học (story 005). */
  readonly onLearn: () => void;
  /** Opens Làm (story 003). */
  readonly onDo: () => void;
  /** Name of the current Con đường stage (story 006); a neutral placeholder is shown when absent. */
  readonly currentStageName?: string;
  /** Daily-goal config; defaults to game-config.json. */
  readonly config?: ProgressConfig;
  /** Clock; defaults to the real one. Injected for tests and screenshots. */
  readonly now?: () => Date;
  /** IANA time zone defining the local day; defaults to the device's. */
  readonly timeZone?: string;
}

/**
 * Screen states:
 * - `loading`: reading the event log.
 * - `error`: the read failed; retry offered.
 * - `ready`: progress computed. `isNewUser` (no events at all) adds a welcome card.
 *   Inside `ready`, `progress.dailyGoal.met` switches between the in-progress
 *   view (what is still missing) and the completed view (streak +1).
 */
type ScreenState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error' }
  | { readonly kind: 'ready'; readonly progress: Progress; readonly isNewUser: boolean };

const DEFAULT_CONFIG: ProgressConfig = { dailyXpGoal: gameConfig.dailyXpGoal };

function realNow(): Date {
  return new Date();
}

/**
 * Màn Hôm nay: the default screen (brief MVP feature 5, story 004).
 *
 * Shows the streak, today's XP bar, the current stage slot, what is still
 * missing for the daily goal, and the two big Học / Làm entries. All numbers
 * come from {@link computeProgress}; the log is re-read every time the screen
 * mounts (i.e. on every return from Học / Làm) and when the app becomes
 * visible again (catches a day rollover while backgrounded).
 */
export function TodayScreen({
  eventStore,
  onLearn,
  onDo,
  currentStageName,
  config = DEFAULT_CONFIG,
  now = realNow,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
}: TodayScreenProps) {
  const [state, setState] = useState<ScreenState>({ kind: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    eventStore
      .list()
      .then((events) => {
        if (cancelled) return;
        const progress = computeProgress(events, now(), config, timeZone);
        setState({ kind: 'ready', progress, isNewUser: events.length === 0 });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error('[today] failed to read the event log', error);
        setState({ kind: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [eventStore, config, now, timeZone, reloadKey]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') reload();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [reload]);

  const streak = state.kind === 'ready' ? state.progress.streak : 0;
  const goalMet = state.kind === 'ready' && state.progress.dailyGoal.met;

  return (
    <main className="screen">
      <header className="screen__header today-header">
        <h1 className="screen__title">{STRINGS.todayTitle}</h1>
        {state.kind === 'ready' && (
          <p className={streak > 0 ? 'streak-chip streak-chip--active' : 'streak-chip'} aria-label={streakLabel(streak)}>
            <FlameIcon />
            <span className="streak-chip__count">{streak}</span>
          </p>
        )}
      </header>

      {state.kind === 'loading' && (
        <p className="message" role="status">
          {STRINGS.loading}
        </p>
      )}

      {state.kind === 'error' && (
        <div className="card">
          <p className="message message--error" role="alert">
            {STRINGS.loadError}
          </p>
          <button type="button" className="button button--secondary" onClick={reload}>
            {STRINGS.retry}
          </button>
        </div>
      )}

      {state.kind === 'ready' && state.isNewUser && (
        <section className="card card--welcome">
          <h2 className="card__title">{STRINGS.welcomeTitle}</h2>
          <p className="card__body">{STRINGS.welcomeBody}</p>
        </section>
      )}

      {state.kind === 'ready' && (goalMet ? <GoalMetCard streak={streak} /> : <GoalProgressCard progress={state.progress} />)}

      <section className="card stage-slot" aria-label={STRINGS.currentStage}>
        <span className="stage-slot__label">{STRINGS.currentStage}</span>
        <span className={currentStageName === undefined ? 'stage-slot__name stage-slot__name--pending' : 'stage-slot__name'}>
          {currentStageName ?? STRINGS.stagePending}
        </span>
      </section>

      <div className="action-bar today-actions">
        <button type="button" className="button button--primary button--big" onClick={onLearn}>
          {STRINGS.learnButton}
        </button>
        <button type="button" className="button button--primary button--big" onClick={onDo}>
          {STRINGS.doButton}
        </button>
      </div>
    </main>
  );
}

/** In-progress view: XP bar plus a checklist of what is still missing today. */
function GoalProgressCard({ progress }: { readonly progress: Progress }) {
  const { xp, threshold, hasLesson, hasActivity } = progress.dailyGoal;
  const xpRemaining = Math.max(0, threshold - xp);
  const ratio = threshold > 0 ? Math.min(1, xp / threshold) : 1;
  return (
    <section className="card" aria-labelledby="goal-title">
      <h2 id="goal-title" className="card__title">
        {STRINGS.goalTitle}
      </h2>
      <div
        className="xp-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={threshold}
        aria-valuenow={Math.min(xp, threshold)}
        aria-valuetext={xpProgressLabel(xp, threshold)}
      >
        <div className="xp-bar__fill" style={{ width: `${ratio * 100}%` }} />
      </div>
      <p className="xp-bar__label">{xpProgressLabel(xp, threshold)}</p>

      <p className="checklist__heading">{STRINGS.stillNeeded}</p>
      <ul className="checklist">
        <ChecklistItem done={xpRemaining === 0} label={xpRemaining === 0 ? xpProgressLabel(xp, threshold) : xpRemainingLabel(xpRemaining)} />
        <ChecklistItem done={hasLesson} label={hasLesson ? STRINGS.lessonDone : STRINGS.lessonMissing} />
        <ChecklistItem done={hasActivity} label={hasActivity ? STRINGS.activityDone : STRINGS.activityMissing} />
      </ul>
      {progress.streak > 0 && <p className="message">{keepStreakLabel(progress.streak)}</p>}
    </section>
  );
}

/** One checklist row; done rows are ticked and muted. */
function ChecklistItem({ done, label }: { readonly done: boolean; readonly label: string }) {
  return (
    <li className={done ? 'checklist__item checklist__item--done' : 'checklist__item'}>
      <span className="checklist__mark" aria-hidden="true">
        {done ? '✓' : ''}
      </span>
      {label}
    </li>
  );
}

/** Completed view: today's goal met, the streak shown with its +1. */
function GoalMetCard({ streak }: { readonly streak: number }) {
  return (
    <section className="card card--met" role="status" aria-live="polite">
      <div className="goal-met__streak">
        <FlameIcon />
        <span className="goal-met__count">{streak}</span>
        <span className="goal-met__plus" aria-hidden="true">
          +1
        </span>
      </div>
      <h2 className="card__title">{STRINGS.goalMetTitle}</h2>
      <p className="card__body">{streakLabel(streak)}</p>
      <p className="message">{STRINGS.goalMetBody}</p>
    </section>
  );
}

/** Flat flame glyph for the streak (decorative; the count carries the meaning). */
function FlameIcon() {
  return (
    <svg className="flame-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-6 1-9.5z" />
    </svg>
  );
}
