import { useEffect, useState } from 'react';
import gameConfig from '../../config/game-config.json';
import type { EventStore } from '../../data/event-store';
import { DAILY_COUNT_LIMITS, XP_GOAL_RANGE, buildXpGoalEvent, otherMemberIds, readXpGoal } from '../../domain/progress';
import type { DailyGoal } from '../../domain/progress';
import { STRINGS, goalChangeLabel } from '../strings';

/** Props for {@link GoalCard}. */
export interface GoalCardProps {
  readonly eventStore: EventStore;
  /** Household members' ids; their goal choices are not mine. */
  readonly memberIds: ReadonlySet<string>;
  readonly now?: () => Date;
  readonly timeZone?: string;
}

/** One stepper row of the card. */
interface RowDef {
  readonly key: keyof DailyGoal;
  readonly name: string;
  readonly hint: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

/**
 * Cài đặt "Mục tiêu hằng ngày" (stories 056, 062): XP, lessons and tasks a day needs, each with
 * − / +, saved together with "Lưu mục tiêu". A change counts from tomorrow; a changed row says
 * "Hôm nay 1 → từ mai 2". 0 lessons or 0 tasks drops that part of the goal.
 */
export function GoalCard({ eventStore, memberIds, now = () => new Date(), timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone }: GoalCardProps) {
  const [goal, setGoal] = useState<{ readonly today: DailyGoal; readonly next: { readonly goal: DailyGoal; readonly from: string } | null } | null>(null);
  const [draft, setDraft] = useState<DailyGoal>({ xp: gameConfig.dailyXpGoal, lessons: 1, tasks: 1 });
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    eventStore
      .list()
      .then((events) => {
        if (cancelled) return;
        const g = readXpGoal(events, now(), { dailyXpGoal: gameConfig.dailyXpGoal }, timeZone, otherMemberIds(events, memberIds));
        setGoal(g);
        setDraft(g.next?.goal ?? g.today);
      })
      .catch((error: unknown) => console.error('[goal] could not read the goal', error));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventStore, memberIds, reloadKey]);

  if (goal === null) return null;
  const rows: readonly RowDef[] = [
    { key: 'xp', name: STRINGS.goalCardLabel, hint: STRINGS.goalXpHint, min: XP_GOAL_RANGE.min, max: XP_GOAL_RANGE.max, step: XP_GOAL_RANGE.step },
    { key: 'lessons', name: STRINGS.goalLessonsName, hint: STRINGS.goalLessonsHint, min: 0, max: DAILY_COUNT_LIMITS.lessons, step: 1 },
    { key: 'tasks', name: STRINGS.goalTasksName, hint: STRINGS.goalTasksHint, min: 0, max: DAILY_COUNT_LIMITS.tasks, step: 1 },
  ];
  const current = goal.next?.goal ?? goal.today;
  const unchanged = draft.xp === current.xp && draft.lessons === current.lessons && draft.tasks === current.tasks;
  const set = (key: keyof DailyGoal, value: number, row: RowDef) => {
    setStatus('idle');
    setDraft({ ...draft, [key]: Math.min(row.max, Math.max(row.min, value)) });
  };
  const save = async () => {
    setStatus('saving');
    try {
      await eventStore.append(buildXpGoalEvent(draft, now(), timeZone));
      setStatus('saved');
      setReloadKey((k) => k + 1);
    } catch (error) {
      console.error('[goal] could not save the goal', error);
      setStatus('error');
    }
  };

  return (
    <section className="card form goal-card" aria-label={STRINGS.settingsGroupGoal}>
      <ul className="goal-card__rows">
        {rows.map((row) => {
          const value = draft[row.key];
          const today = goal.today[row.key];
          return (
            <li key={row.key} className="goal-card__row">
              <span className="goal-card__text">
                <span className="goal-card__name">{row.name}</span>
                <span className="goal-card__hint">{row.hint}</span>
                {value !== today && <span className="goal-card__soon">{goalChangeLabel(today, value)}</span>}
              </span>
              <span className="goal-card__stepper">
                <button type="button" className="goal-card__btn" aria-label={`${row.name} −${row.step}`} onClick={() => set(row.key, value - row.step, row)} disabled={value <= row.min}>
                  −
                </button>
                <span className={value === 0 ? 'goal-card__value goal-card__value--zero' : 'goal-card__value'} aria-live="polite">
                  {value}
                </span>
                <button type="button" className="goal-card__btn" aria-label={`${row.name} +${row.step}`} onClick={() => set(row.key, value + row.step, row)} disabled={value >= row.max}>
                  +
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="message">{STRINGS.goalRule}</p>
      <button type="button" className="button button--primary" onClick={() => void save()} disabled={status === 'saving' || unchanged}>
        {STRINGS.goalSave}
      </button>
      {status === 'saved' && (
        <p className="message" role="status">
          {STRINGS.goalSaved}
        </p>
      )}
      {status === 'error' && (
        <p className="message message--error" role="alert">
          {STRINGS.goalSaveError}
        </p>
      )}
    </section>
  );
}
