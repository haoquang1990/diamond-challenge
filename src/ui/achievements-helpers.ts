/**
 * Pure helpers for the achievements overlay (story 017): the observed event
 * store, the toast name mapper, the sound setting reader and the seeding plan.
 */
import type { EventStore, LogEvent, NewEvent } from '../data/event-store';
import type { AchievedItem, AchievementItem } from '../domain/achievements';
import { STRINGS, stageReachedTitle } from './strings';

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
