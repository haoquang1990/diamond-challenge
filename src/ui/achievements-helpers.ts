/**
 * Pure helpers for the achievements overlay (story 017): the observed event
 * store, the toast name mapper, the sound setting reader and the seeding plan.
 */
import type { EventStore, LogEvent, NewEvent } from '../data/event-store';
import { evaluateAchievements, readAcknowledged } from '../domain/achievements';
import type { AchievedItem, AchievementDeps, AchievementItem, AchievementsConfig } from '../domain/achievements';
import { computePeopleStats, derivePeople } from '../domain/people';
import { computeProgress } from '../domain/progress';
import { computeStageProgress } from '../domain/stages';
import {
  STRINGS,
  achievementsDailyGoalLabel,
  achievementsStreakLabel,
  achievementsXpLeftLabel,
  boardCountLabel,
  milestoneCountLabel,
  stageReachedTitle,
} from './strings';

/** Listener told about every event the app saved. */
export type SavedListener = (event: LogEvent) => void;

/** An {@link EventStore} that reports successful appends. */
export interface ObservedStore {
  /** Store to hand to every screen. */
  readonly store: EventStore;
  /** Registers a listener; returns the unsubscribe function. */
  subscribe(listener: SavedListener): () => void;
}

/**
 * Wraps `inner`: every method delegates, and after a successful `append`
 * (not `importEvents`) the saved event is passed to the listeners. A throwing
 * listener never breaks the save.
 */
export function createObservedStore(inner: EventStore): ObservedStore {
  const listeners = new Set<SavedListener>();
  const store: EventStore = {
    getUserId: () => inner.getUserId(),
    list: (range) => inner.list(range),
    importEvents: (events) => inner.importEvents(events),
    async append(event: NewEvent) {
      const saved = await inner.append(event);
      for (const listener of [...listeners]) {
        try {
          listener(saved);
        } catch (error) {
          console.error('[achievements] listener failed', error);
        }
      }
      return saved;
    },
  };
  return {
    store,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Id and name pair used to label a toast. */
export interface NamedDef {
  readonly id: string;
  readonly name: string;
}

/**
 * Toast label of a saved event: person task name, legacy activity type name,
 * "Bài Học" for lessons, otherwise "Hoạt động".
 */
export function toastNameFor(event: LogEvent, tasks: readonly NamedDef[], activityTypes: readonly NamedDef[]): string {
  if (event.type === 'lesson_completed') return STRINGS.toastLesson;
  if (event.type === 'activity_logged') {
    const taskId = event.payload.taskId;
    if (typeof taskId === 'string') {
      const task = tasks.find((t) => t.id === taskId);
      if (task !== undefined) return task.name;
    }
    const type = event.payload.activityType;
    if (typeof type === 'string') {
      const found = activityTypes.find((t) => t.id === type);
      if (found !== undefined) return found.name;
    }
  }
  return STRINGS.toastActivity;
}

/**
 * Latest non-compensated `settings_changed { sound: { enabled } }`, or
 * `fallback` when none exists.
 */
export function readSoundEnabled(events: readonly LogEvent[], fallback: boolean): boolean {
  const compensated = new Set<string>();
  for (const e of events) {
    const target = e.payload.compensates;
    if (typeof target === 'string') compensated.add(target);
  }
  let result = fallback;
  for (const e of events) {
    if (e.type !== 'settings_changed' || compensated.has(e.id)) continue;
    const sound = e.payload.sound;
    if (typeof sound === 'object' && sound !== null && typeof (sound as { enabled?: unknown }).enabled === 'boolean') {
      result = (sound as { enabled: boolean }).enabled;
    }
  }
  return result;
}

/**
 * Items to acknowledge silently on first run: everything achieved except the
 * stage item whose celebration is still pending (it keeps popping up once).
 */
export function itemsToSeed(achieved: readonly AchievedItem[], pendingStageItemId: string | null): AchievedItem[] {
  return achieved.filter((a) => a.id !== pendingStageItemId);
}

/** Config item id of the stage item for `stageId`, or null. */
export function stageItemId(items: readonly AchievementItem[], stageId: string): string | null {
  const found = items.find((i) => i.kind === 'stage' && i.stageId === stageId);
  return found === undefined ? null : found.id;
}

/** Payload that acknowledges `item` when its popup starts (stage items use the existing mechanism). */
export function acknowledgePayload(item: AchievedItem, items: readonly AchievementItem[]): Record<string, string> | null {
  if (item.kind === 'stage') {
    const def = items.find((i) => i.id === item.itemId);
    if (def === undefined || def.kind !== 'stage') return null;
    return { stageAcknowledged: def.stageId };
  }
  return { achievementAcknowledged: item.id };
}

/** Popup title: stages read "Bạn đã lên chặng Silver!", others use the milestone name. */
export function popupTitle(item: AchievedItem): string {
  return item.kind === 'stage' ? stageReachedTitle(item.name) : item.name;
}

/** One row of the Thành tích screen. */
export interface AchievementRow {
  /** Config item id. */
  readonly id: string;
  readonly name: string;
  readonly earned: boolean;
  /**
   * ISO timestamp of the earliest acknowledgement covering the item,
   * `'before'` when that acknowledgement was silent (no honest date), or null
   * (not earned, no acknowledgement yet, or a daily goal row).
   */
  readonly earnedAt: string | null | 'before';
  /** How to earn it plus progress when not earned; the daily goal line (always); otherwise null. */
  readonly progressText: string | null;
}

/** Earliest non-compensated acknowledgement events, as `{ covers, timestamp, silent }`. */
function acknowledgementEvents(events: readonly LogEvent[], stageIds: readonly string[]) {
  const compensated = new Set<string>();
  for (const e of events) {
    const target = e.payload.compensates;
    if (typeof target === 'string') compensated.add(target);
  }
  const out: { covers: ReadonlySet<string>; timestamp: string; silent: boolean }[] = [];
  for (const e of events) {
    if (e.type !== 'settings_changed' || compensated.has(e.id) || typeof e.payload.compensates === 'string') continue;
    const covers = new Set<string>();
    if (typeof e.payload.achievementAcknowledged === 'string') covers.add(e.payload.achievementAcknowledged);
    if (typeof e.payload.stageAcknowledged === 'string') {
      const index = stageIds.indexOf(e.payload.stageAcknowledged);
      for (let i = 0; i <= index; i++) covers.add(`stage:${stageIds[i] ?? ''}`);
    }
    if (covers.size > 0) out.push({ covers, timestamp: e.timestamp, silent: e.payload.silent === true });
  }
  return out;
}

/**
 * Rows for the Thành tích screen, one per config item in config order. Earned =
 * acknowledged (stage acknowledgements cover lower stages) or currently
 * achieved; an earned item stays earned when the live number drops. Daily goal
 * is a single row counting distinct `<id>:YYYY-MM-DD` ids. Read only.
 *
 * @param events Event log.
 * @param config Validated achievements config.
 * @param now Injected instant.
 * @param timeZone IANA zone defining the local day.
 * @param deps Stage defs, people config and progress config.
 */
export function buildAchievementRows(
  events: readonly LogEvent[],
  config: AchievementsConfig,
  now: Date,
  timeZone: string,
  deps: AchievementDeps,
): AchievementRow[] {
  const stageIds = deps.stages.map((s) => s.id);
  const achieved = evaluateAchievements(events, config, now, timeZone, deps);
  const achievedIds = new Set(achieved.map((a) => a.id));
  const ack = readAcknowledged(events, deps.stages);
  const ackEvents = acknowledgementEvents(events, stageIds);
  const progress = computeProgress(events, now, deps.progress, timeZone);
  const stageProgress = computeStageProgress(events, progress.totalXp, deps.stages);
  const stats = computePeopleStats(derivePeople(events, deps.people), deps.people);
  const targets = deps.people.targets;

  return config.items.map((item): AchievementRow => {
    const base = { id: item.id, name: item.name };
    if (item.kind === 'daily_goal') {
      const prefix = `${item.id}:`;
      const days = new Set<string>();
      for (const id of ack.ids) if (id.startsWith(prefix)) days.add(id);
      for (const id of achievedIds) if (id.startsWith(prefix)) days.add(id);
      return { ...base, earned: days.size > 0, earnedAt: null, progressText: achievementsDailyGoalLabel(days.size) };
    }
    const covering = ackEvents.filter((a) => a.covers.has(item.id));
    let earliest: (typeof ackEvents)[number] | undefined;
    for (const a of covering) if (earliest === undefined || a.timestamp < earliest.timestamp) earliest = a;
    const earned = earliest !== undefined || achievedIds.has(item.id);
    if (earned) {
      return { ...base, earned, earnedAt: earliest === undefined ? null : earliest.silent ? 'before' : earliest.timestamp, progressText: null };
    }
    return { ...base, earned, earnedAt: null, progressText: progressTextFor(item, progress.streak, stageProgress, stats, targets, deps.stages.map((s) => s.id)) };
  });
}

function progressTextFor(
  item: AchievementItem,
  streak: number,
  stageProgress: ReturnType<typeof computeStageProgress>,
  stats: ReturnType<typeof computePeopleStats>,
  targets: AchievementDeps['people']['targets'],
  stageIds: readonly string[],
): string | null {
  switch (item.kind) {
    case 'stage': {
      const status = stageProgress.stages[stageIds.indexOf(item.stageId)];
      if (status === undefined) return null;
      const parts: string[] = [];
      if (status.xpMissing > 0) parts.push(achievementsXpLeftLabel(status.xpMissing));
      for (const m of status.milestones) if (!m.met) parts.push(milestoneCountLabel(m.label, m.current, m.count));
      return parts.length > 0 ? parts.join(' · ') : null;
    }
    case 'streak':
      return achievementsStreakLabel(streak, item.days);
    case 'daily_goal':
      return null;
    case 'people': {
      if (item.metric === 'achieved30x30') {
        return [
          boardCountLabel(STRINGS.boardCustomers, stats.customers, targets.customersTarget),
          boardCountLabel(STRINGS.boardF1, stats.f1, targets.f1Target),
        ].join(' · ');
      }
      const label = item.metric === 'customers' ? STRINGS.boardCustomers : item.metric === 'f1' ? STRINGS.boardF1 : STRINGS.boardContacts;
      const value = item.metric === 'customers' ? stats.customers : item.metric === 'f1' ? stats.f1 : stats.contacts;
      const target = item.metric === 'customers' ? targets.customersTarget : item.metric === 'f1' ? targets.f1Target : targets.contactsTarget;
      const threshold = item.threshold === 'target' || item.threshold === null ? target : item.threshold;
      return boardCountLabel(label, value, threshold);
    }
  }
}

/** Local date `dd/mm/yyyy` of an ISO instant in `timeZone`; '' when invalid. */
export function formatEarnedDate(iso: string, timeZone: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { timeZone, day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}
