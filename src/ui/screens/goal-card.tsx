import { useEffect, useState } from 'react';
import gameConfig from '../../config/game-config.json';
import type { EventStore } from '../../data/event-store';
import { XP_GOAL_RANGE, buildXpGoalEvent, otherMemberIds, readXpGoal } from '../../domain/progress';
import { STRINGS, goalFromTomorrowLabel, goalTodayLabel } from '../strings';

/** Quick picks shown under the number. */
const QUICK_GOALS: readonly number[] = [20, 30, 50, 100];

/** Props for {@link GoalCard}. */
export interface GoalCardProps {
  readonly eventStore: EventStore;
  /** Household members' ids; their goal choices are not mine. */
  readonly memberIds: ReadonlySet<string>;
  readonly now?: () => Date;
  readonly timeZone?: string;
}

/**
 * Cài đặt "Mục tiêu hằng ngày" (story 056): pick the daily XP goal (range and step from
 * `xpGoalRange`) with − / + or a quick pick, then "Đặt mục tiêu". The new goal counts from
 * tomorrow; today's goal and a waiting change are shown. Each day still needs a lesson and a task.
 */
export function GoalCard({ eventStore, memberIds, now = () => new Date(), timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone }: GoalCardProps) {
  const [goal, setGoal] = useState<{ readonly today: number; readonly next: { readonly xp: number; readonly from: string } | null } | null>(null);
  const [draft, setDraft] = useState<number>(gameConfig.dailyXpGoal);
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
        setDraft(g.next?.xp ?? g.today);
      })
      .catch((error: unknown) => console.error('[goal] could not read the goal', error));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventStore, memberIds, reloadKey]);

  if (goal === null) return null;
  const { min, max, step } = XP_GOAL_RANGE;
  const current = goal.next?.xp ?? goal.today;
  const set = (xp: number) => {
    setStatus('idle');
    setDraft(Math.min(max, Math.max(min, xp)));
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
    <section className="card form goal-card" aria-label={STRINGS.goalCardLabel}>
      <p className="card__body">{goalTodayLabel(goal.today)}</p>
      {goal.next !== null && <p className="message goal-card__next">{goalFromTomorrowLabel(goal.next.xp)}</p>}
      <div className="goal-card__stepper">
        <button type="button" className="icon-button" aria-label={STRINGS.goalLess} onClick={() => set(draft - step)} disabled={draft <= min}>
          −
        </button>
        <label className="goal-card__value">
          <span className="visually-hidden">{STRINGS.goalCardLabel}</span>
          <input
            type="number"
            inputMode="numeric"
            className="note__input goal-card__input"
            min={min}
            max={max}
            step={step}
            value={draft}
            onChange={(e) => {
              setStatus('idle');
              setDraft(Number(e.target.value));
            }}
            onBlur={() => set(min + Math.round((draft - min) / step) * step)}
          />
          <span className="goal-card__unit">XP</span>
        </label>
        <button type="button" className="icon-button" aria-label={STRINGS.goalMore} onClick={() => set(draft + step)} disabled={draft >= max}>
          +
        </button>
      </div>
      <div className="goal-card__quick">
        {QUICK_GOALS.filter((x) => x >= min && x <= max).map((x) => (
          <button key={x} type="button" className={x === draft ? 'chip chip--selected' : 'chip'} aria-pressed={x === draft} onClick={() => set(x)}>
            {x}
          </button>
        ))}
      </div>
      <p className="message">{STRINGS.goalRule}</p>
      <button type="button" className="button button--primary" onClick={() => void save()} disabled={status === 'saving' || draft === current || draft < min || draft > max}>
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
