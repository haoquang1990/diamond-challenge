import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import gameConfig from '../../config/game-config.json';
import type { EventStore } from '../../data/event-store';
import { computeProgress, otherMemberIds } from '../../domain/progress';
import type { Progress, ProgressConfig } from '../../domain/progress';
import type { StageDef } from '../../domain/stages';
import { nextReminderAt, parseReminderConfig, readReminderSettings, reminderMissing, shouldShowReminder } from '../../domain/reminders';
import type { ReminderConfig, ReminderSettings } from '../../domain/reminders';
import { browserNotificationPlatform } from '../../notifications/reminders';
import type { ReminderPermission } from '../../notifications/reminders';
import { DEFAULT_STAGES, buildStageView } from './diamond-path-screen';
import type { Lesson } from '../../domain/lesson';
import { nextLessonSuggestion } from '../../domain/lesson-stages';
import type { LessonStage, NextLessonSuggestion } from '../../domain/lesson-stages';
import { LOADED_LESSONS, LOADED_STAGES } from '../lesson-content';
import { LESSON_STRINGS, nextLessonAllDone, pathLessonFacts, pathStageHeading } from '../lesson-strings';
import {
  STRINGS,
  keepStreakLabel,
  reminderMessage,
  streakLabel,
  xpProgressLabel,
  xpRemainingLabel,
} from '../strings';

/** Props for {@link TodayScreen}. */
export interface TodayScreenProps {
  /** Account ids of household members persisted on the device (story 023); their events are not mine. */
  readonly memberIds?: ReadonlySet<string>;
  /** Event log progress is derived from (injected; no singleton). */
  readonly eventStore: EventStore;
  /** Opens Học (story 005). */
  readonly onLearn: () => void;
  /** Name of the current Con đường stage (story 006); a neutral placeholder is shown when absent. */
  readonly currentStageName?: string;
  /** Stages used to derive the current stage when `currentStageName` is absent; defaults to game-config.json. */
  readonly stages?: readonly StageDef[];
  /** Daily-goal config; defaults to game-config.json. */
  readonly config?: ProgressConfig;
  /** Clock; defaults to the real one. Injected for tests and screenshots. */
  readonly now?: () => Date;
  /** IANA time zone defining the local day; defaults to the device's. */
  readonly timeZone?: string;
  /** Opens Cài đặt (account, household, sync, reminders, backup); the header button is hidden when absent. */
  readonly onOpenSettings?: () => void;
  /** An unseen cheer from the sponsor household (story 028); the card is shown only when set. */
  readonly cheer?: { readonly message: string } | null;
  /** Closes the cheer card for good. */
  readonly onDismissCheer?: () => void;
  /** Reminder defaults; defaults to game-config.json. */
  readonly reminderConfig?: ReminderConfig;
  /** Current notification permission; defaults to the browser's. Injected for tests and screenshots. */
  readonly notificationPermission?: () => ReminderPermission;
  /** Starts a lesson in Học (story 039); the "Bài nên học tiếp" card is hidden when absent. */
  readonly onStartLesson?: (lessonId: string) => void;
  /** Hôm nay "Cổ vũ nhóm" card (story 041); hidden when absent (signed out or no server). */
  readonly cheerGroup?: ReactNode;
  /** Lessons and stages for the suggestion; default to content/lessons.json. */
  readonly lessons?: readonly Lesson[];
  readonly lessonStages?: readonly LessonStage[];
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
  | { readonly kind: 'ready'; readonly progress: Progress; readonly isNewUser: boolean; readonly stageName: string | null; readonly reminder: ReminderSettings; readonly reminderDue: boolean; readonly next: NextLessonSuggestion };

const NO_MEMBERS: ReadonlySet<string> = new Set();
const DEFAULT_CONFIG: ProgressConfig = { dailyXpGoal: gameConfig.dailyXpGoal };
const DEFAULT_REMINDER_CONFIG = parseReminderConfig(gameConfig.reminder);
const DEFAULT_PERMISSION = browserNotificationPlatform().permission;

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
 *
 * Story 007 (additive): a "Nhắc nhở" header button opens the settings; a
 * reminder banner shows once the reminder time has passed and today's goal
 * is still open (the screen reloads itself at that moment if it is open);
 * a separate notice shows when reminders are on but notifications are
 * denied or unsupported.
 */
export function TodayScreen({
  eventStore,
  onLearn,
  currentStageName,
  stages = DEFAULT_STAGES,
  config = DEFAULT_CONFIG,
  now = realNow,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  onOpenSettings,
  reminderConfig = DEFAULT_REMINDER_CONFIG,
  notificationPermission = DEFAULT_PERMISSION,
  memberIds = NO_MEMBERS,
  cheer = null,
  onDismissCheer,
  onStartLesson,
  cheerGroup,
  lessons = LOADED_LESSONS.lessons,
  lessonStages = LOADED_STAGES,
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
        const others = otherMemberIds(events, memberIds);
        const progress = computeProgress(events, now(), config, timeZone, others);
        const view = buildStageView(events, stages, now(), timeZone, others);
        const reminder = readReminderSettings(events, reminderConfig);
        setState({
          kind: 'ready',
          progress,
          isNewUser: events.length === 0,
          stageName: view.progress.current?.name ?? null,
          reminder,
          reminderDue: shouldShowReminder(reminder, now(), timeZone, progress.dailyGoal.met),
          next: nextLessonSuggestion(lessons, lessonStages, events),
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error('[today] failed to read the event log', error);
        setState({ kind: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [eventStore, config, stages, now, timeZone, reminderConfig, reloadKey, memberIds]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') reload();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [reload]);

  // While open, re-read the log when today's reminder time arrives so the banner appears.
  const waitForReminder =
    state.kind === 'ready' && state.reminder.enabled && !state.reminderDue && !state.progress.dailyGoal.met
      ? state.reminder
      : null;
  useEffect(() => {
    if (waitForReminder === null) return;
    const current = now();
    const at = nextReminderAt(waitForReminder, current, timeZone);
    if (at === null) return;
    const id = window.setTimeout(reload, Math.max(0, at.getTime() - current.getTime()));
    return () => window.clearTimeout(id);
  }, [waitForReminder, now, timeZone, reload]);

  const streak = state.kind === 'ready' ? state.progress.streak : 0;
  const stageName = currentStageName ?? (state.kind === 'ready' ? state.stageName ?? undefined : undefined);
  const goalMet = state.kind === 'ready' && state.progress.dailyGoal.met;
  const permission = notificationPermission();
  const notificationsOff =
    state.kind === 'ready' && state.reminder.enabled && (permission === 'denied' || permission === 'unsupported');

  return (
    <main className="screen">
      <header className="screen__header today-header">
        <h1 className="screen__title">{STRINGS.todayTitle}</h1>
        <div className="today-header__actions">
          {onOpenSettings !== undefined && (
            <button type="button" className="reminder-button reminder-button--icon" onClick={onOpenSettings} aria-label={STRINGS.reminderButtonLabel} title={STRINGS.reminderButton}>
              <GearIcon />
            </button>
          )}
          {state.kind === 'ready' && (
            <p className={streak > 0 ? 'streak-chip streak-chip--active' : 'streak-chip'} aria-label={streakLabel(streak)}>
              <FlameIcon />
              <span className="streak-chip__count">{streak}</span>
            </p>
          )}
        </div>
      </header>

      {state.kind === 'ready' && state.reminderDue && (
        <section className="reminder-banner" role="status" aria-live="polite">
          <BellIcon />
          <p className="reminder-banner__text">
            <strong>{STRINGS.reminderDueTitle}</strong> {reminderMessage(streak, reminderMissing(state.progress.dailyGoal))}
          </p>
        </section>
      )}

      {cheer !== null && (
        <section className="card cheer-card" role="status" aria-labelledby="cheer-title">
          <h2 id="cheer-title" className="card__title">
            {STRINGS.cheerCardTitle}
          </h2>
          <p className="card__body">{cheer.message}</p>
          {onDismissCheer !== undefined && (
            <button type="button" className="button button--secondary" onClick={onDismissCheer}>
              {STRINGS.cheerCardDismiss}
            </button>
          )}
        </section>
      )}

      {notificationsOff && <p className="reminder-notice">{STRINGS.reminderNoticeOff}</p>}

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

      {cheerGroup}

      {state.kind === 'ready' && onStartLesson !== undefined && state.next.total > 0 && (
        <NextLessonCard next={state.next} onStart={onStartLesson} onLearn={onLearn} />
      )}


    </main>
  );
}

/** "Bài nên học tiếp" (story 039): the first lesson not learned yet, in path order. */
function NextLessonCard({
  next,
  onStart,
  onLearn,
}: {
  readonly next: NextLessonSuggestion;
  readonly onStart: (lessonId: string) => void;
  readonly onLearn: () => void;
}) {
  const { lesson } = next;
  return (
    <section className="card next-lesson" aria-labelledby="next-lesson-title">
      <h2 id="next-lesson-title" className="card__title">
        {LESSON_STRINGS.nextLessonTitle}
      </h2>
      {lesson === null ? (
        <>
          <p className="card__body">{nextLessonAllDone(next.total)}</p>
          <button type="button" className="button button--secondary" onClick={onLearn}>
            {LESSON_STRINGS.nextLessonReview}
          </button>
        </>
      ) : (
        <>
          {next.stagePosition !== null && next.stageTitle !== null && (
            <p className="next-lesson__stage">{pathStageHeading(next.stagePosition, next.stageTitle)}</p>
          )}
          <p className="next-lesson__name">{lesson.title}</p>
          <p className="next-lesson__facts">{pathLessonFacts(lesson.xp, lesson.questions.length)}</p>
          <button type="button" className="button button--primary" onClick={() => onStart(lesson.id)}>
            {LESSON_STRINGS.nextLessonStart}
          </button>
        </>
      )}
    </section>
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

/** Flat gear glyph for the Cài đặt entry (decorative). */
function GearIcon() {
  return (
    <svg className="bell-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3.3h-4l-.4 2.6a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.4 7.4 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" fillRule="evenodd" transform="translate(-1 0)" />
    </svg>
  );
}

/** Flat bell glyph for the reminder banner (decorative). */
function BellIcon() {
  return (
    <svg className="bell-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 2a6 6 0 0 0-6 6v4l-2 4h16l-2-4V8a6 6 0 0 0-6-6zm-2.5 16a2.5 2.5 0 0 0 5 0z" />
    </svg>
  );
}
