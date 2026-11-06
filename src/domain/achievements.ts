/**
 * Achievements model: config validation, evaluation of reached milestones,
 * acknowledgement, silent seeding, popup plan, toast queue and encouragement
 * pick (design/quick-specs/achievements-system-2026-11-05.md; story-016).
 *
 * Pure and deterministic: no clock (`now` and `timeZone` are arguments), no
 * randomness (`random` is injected), no I/O. Adds no event type: every
 * acknowledgement is a `settings_changed` payload, which is never compensated,
 * so undoing below a milestone and regaining it never makes it "new" again.
 */
import type { LogEvent, NewEvent } from '../data/event-store';
import { computePeopleStats, derivePeople } from './people';
import type { PeopleConfig, PeopleTargets } from './people';
import { computeProgress } from './progress';
import type { ProgressConfig } from './progress';
import { computeStageProgress } from './stages';
import type { StageDef } from './stages';

/** Kind of an achievement item. */
export type AchievementKind = 'stage' | 'daily_goal' | 'streak' | 'people';

/** Popup/sort order of the kinds. */
export const KIND_ORDER: readonly AchievementKind[] = ['stage', 'daily_goal', 'streak', 'people'];

/** People metric an item reads. */
export type PeopleMetric = 'customers' | 'f1' | 'contacts' | 'achieved30x30';

const PEOPLE_METRICS: readonly PeopleMetric[] = ['customers', 'f1', 'contacts', 'achieved30x30'];

/** Safe fallbacks used when a top-level config field is invalid. */
export const DEFAULT_TOAST_MS = 2000;
/** Safe fallback for `maxPopupsPerAction`. */
export const DEFAULT_MAX_POPUPS = 3;
/** Safe fallback for `soundDefault`. */
export const DEFAULT_SOUND = true;
/** Fallback sentence when the encouragement list is empty. */
export const DEFAULT_ENCOURAGEMENT = 'Tuyệt vời, cứ tiếp tục nhé!';

const TOAST_MS_RANGE = { min: 1000, max: 5000 } as const;
const MAX_POPUPS_RANGE = { min: 1, max: 5 } as const;

interface ItemBase {
  /** Unique config id (the achieved id of a daily goal adds `:YYYY-MM-DD`). */
  readonly id: string;
  readonly name: string;
}

/** A validated achievement definition. */
export type AchievementItem =
  | (ItemBase & { readonly kind: 'stage'; readonly stageId: string })
  | (ItemBase & { readonly kind: 'daily_goal' })
  | (ItemBase & { readonly kind: 'streak'; readonly days: number })
  | (ItemBase & { readonly kind: 'people'; readonly metric: PeopleMetric; readonly threshold: number | 'target' | null });

/** Result of {@link parseAchievementsConfig}. */
export interface AchievementsConfig {
  /** Toast display time, clamped to 1000-5000 ms. */
  readonly toastMs: number;
  /** Max popups per action, clamped to 1-5. */
  readonly maxPopupsPerAction: number;
  readonly soundDefault: boolean;
  readonly encouragements: readonly string[];
  /** Valid items in config order. */
  readonly items: readonly AchievementItem[];
  /** Human-readable problems (also for skipped items). */
  readonly problems: readonly string[];
}

/** A currently-achieved milestone. */
export interface AchievedItem {
  /** Acknowledgement id, e.g. `stage:gold`, `streak:7`, `daily_goal:2026-03-10`. */
  readonly id: string;
  readonly kind: AchievementKind;
  readonly name: string;
  /** Id of the config item this came from. */
  readonly itemId: string;
}

/** Injected dependencies of {@link evaluateAchievements}. */
export interface AchievementDeps {
  readonly stages: readonly StageDef[];
  readonly people: PeopleConfig;
  readonly progress: ProgressConfig;
}

/** Result of {@link readAcknowledged}. */
export interface AcknowledgedState {
  /** Acknowledged achievement ids (stage ids expanded to all stages up to the acknowledged one). */
  readonly ids: ReadonlySet<string>;
  /** True when a non-compensated `achievementsSeeded: true` event exists. */
  readonly seeded: boolean;
}

/** One popup of a plan. */
export type PopupPlanEntry =
  | { readonly kind: 'single'; readonly item: AchievedItem }
  | { readonly kind: 'rest'; readonly count: number };

/** Result of {@link planPopups}. */
export interface PopupPlan {
  readonly popups: readonly PopupPlanEntry[];
}

/** XP and label of one toast. */
export interface Toast {
  readonly xp: number;
  readonly label: string;
}

/** A queued toast; `count` is 1 for a single activity, N when merged ("+X XP · N hoạt động"). */
export interface QueuedToast extends Toast {
  readonly count: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function clampNumber(value: number, range: { min: number; max: number }): number {
  return Math.min(range.max, Math.max(range.min, value));
}

function readClamped(source: Record<string, unknown>, key: string, fallback: number, range: { min: number; max: number }, problems: string[]): number {
  const value = source[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    problems.push(`achievements.${key}: expected a number, using ${fallback}`);
    return fallback;
  }
  return clampNumber(Math.round(value), range);
}

function parseItem(item: unknown, where: string, targets: PeopleTargets, stageIds: ReadonlySet<string>, problems: string[]): AchievementItem | null {
  if (!isRecord(item)) {
    problems.push(`${where}: not an object`);
    return null;
  }
  const { id, name, kind } = item;
  if (!isNonEmptyString(id)) {
    problems.push(`${where}: missing id`);
    return null;
  }
  if (!isNonEmptyString(name)) {
    problems.push(`${where} (${id}): missing name`);
    return null;
  }
  if (kind === 'stage') {
    if (!isNonEmptyString(item.stageId) || !stageIds.has(item.stageId)) {
      problems.push(`${where} (${id}): unknown stageId`);
      return null;
    }
    return { id, name, kind, stageId: item.stageId };
  }
  if (kind === 'daily_goal') return { id, name, kind };
  if (kind === 'streak') {
    const days = item.days;
    if (typeof days !== 'number' || !Number.isInteger(days) || days < 1) {
      problems.push(`${where} (${id}): days must be a positive integer`);
      return null;
    }
    return { id, name, kind, days };
  }
  if (kind === 'people') {
    const metric = item.metric;
    if (typeof metric !== 'string' || !PEOPLE_METRICS.includes(metric as PeopleMetric)) {
      problems.push(`${where} (${id}): unknown metric`);
      return null;
    }
    if (metric === 'achieved30x30') return { id, name, kind, metric, threshold: null };
    const threshold = item.threshold;
    if (threshold === 'target') {
      const target = metric === 'customers' ? targets.customersTarget : metric === 'f1' ? targets.f1Target : targets.contactsTarget;
      if (!Number.isFinite(target) || target < 1) {
        problems.push(`${where} (${id}): target for ${metric} is not usable`);
        return null;
      }
      return { id, name, kind, metric: metric as PeopleMetric, threshold: 'target' };
    }
    if (typeof threshold !== 'number' || !Number.isInteger(threshold) || threshold < 1) {
      problems.push(`${where} (${id}): threshold must be a positive integer or "target"`);
      return null;
    }
    return { id, name, kind, metric: metric as PeopleMetric, threshold };
  }
  problems.push(`${where} (${id}): unknown kind`);
  return null;
}

/**
 * Validates the raw `achievements` config at the data boundary. Never throws.
 * Invalid or duplicate-id items are skipped and reported in `problems`; an
 * invalid top-level field falls back to a safe default (toastMs 2000,
 * maxPopupsPerAction 3, soundDefault true, no encouragements, no items);
 * numbers are clamped (toastMs 1000-5000, maxPopupsPerAction 1-5).
 *
 * @param raw `gameConfig.achievements`.
 * @param targets 30x30 targets (validates `"target"` thresholds).
 * @param stageIds Valid stage ids (validates `stageId`).
 * @example
 * const cfg = parseAchievementsConfig(gameConfig.achievements, PEOPLE_CONFIG.targets, stages.map((s) => s.id));
 */
export function parseAchievementsConfig(raw: unknown, targets: PeopleTargets, stageIds: readonly string[]): AchievementsConfig {
  const problems: string[] = [];
  if (!isRecord(raw)) {
    return {
      toastMs: DEFAULT_TOAST_MS,
      maxPopupsPerAction: DEFAULT_MAX_POPUPS,
      soundDefault: DEFAULT_SOUND,
      encouragements: [],
      items: [],
      problems: ['achievements: expected an object'],
    };
  }
  const toastMs = readClamped(raw, 'toastMs', DEFAULT_TOAST_MS, TOAST_MS_RANGE, problems);
  const maxPopupsPerAction = readClamped(raw, 'maxPopupsPerAction', DEFAULT_MAX_POPUPS, MAX_POPUPS_RANGE, problems);
  let soundDefault = DEFAULT_SOUND;
  if (typeof raw.soundDefault === 'boolean') soundDefault = raw.soundDefault;
  else problems.push('achievements.soundDefault: expected a boolean');

  let encouragements: string[] = [];
  if (Array.isArray(raw.encouragements)) {
    (raw.encouragements as unknown[]).forEach((s, i) => {
      if (isNonEmptyString(s)) encouragements.push(s);
      else problems.push(`achievements.encouragements[${i}]: expected a non-empty string`);
    });
  } else {
    problems.push('achievements.encouragements: expected an array');
    encouragements = [];
  }

  const items: AchievementItem[] = [];
  if (Array.isArray(raw.items)) {
    const known = new Set(stageIds);
    const seen = new Set<string>();
    (raw.items as unknown[]).forEach((rawItem, i) => {
      const item = parseItem(rawItem, `achievements.items[${i}]`, targets, known, problems);
      if (item === null) return;
      if (seen.has(item.id)) {
        problems.push(`achievements.items[${i}] (${item.id}): duplicate id`);
        return;
      }
      seen.add(item.id);
      items.push(item);
    });
  } else {
    problems.push('achievements.items: expected an array');
  }
  return { toastMs, maxPopupsPerAction, soundDefault, encouragements, items, problems };
}

/** Local calendar date `YYYY-MM-DD` of `instant` in `timeZone`. */
function localDate(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/**
 * Milestones currently achieved, in config order. Reuses `computeProgress`,
 * `computeStageProgress`, `derivePeople` and `computePeopleStats`; the rules
 * are not reimplemented here.
 *
 * - stage: current stage index >= the item's stage index
 * - daily_goal: today's goal met; id `<itemId>:YYYY-MM-DD` (local date in `timeZone`)
 * - streak: current streak >= `days`
 * - people: metric count >= threshold (`"target"` reads the 30x30 targets);
 *   `achieved30x30` uses `stats.achieved`
 *
 * @param events Event log.
 * @param config Validated config from {@link parseAchievementsConfig}.
 * @param now Injected current instant.
 * @param timeZone IANA time zone defining the local day.
 * @param deps Stage defs, people config and progress config.
 * @example
 * const achieved = evaluateAchievements(events, cfg, new Date(), tz, { stages, people: PEOPLE_CONFIG, progress: { dailyXpGoal: 30 } });
 */
export function evaluateAchievements(
  events: readonly LogEvent[],
  config: AchievementsConfig,
  now: Date,
  timeZone: string,
  deps: AchievementDeps,
): AchievedItem[] {
  const progress = computeProgress(events, now, deps.progress, timeZone);
  const stageProgress = computeStageProgress(events, progress.totalXp, deps.stages);
  const stats = computePeopleStats(derivePeople(events, deps.people), deps.people);
  const today = localDate(now, timeZone);
  const out: AchievedItem[] = [];
  for (const item of config.items) {
    const make = (id: string): AchievedItem => ({ id, kind: item.kind, name: item.name, itemId: item.id });
    switch (item.kind) {
      case 'stage': {
        const index = deps.stages.findIndex((s) => s.id === item.stageId);
        if (index >= 0 && stageProgress.currentIndex >= index) out.push(make(item.id));
        break;
      }
      case 'daily_goal':
        if (progress.dailyGoal.met) out.push(make(`${item.id}:${today}`));
        break;
      case 'streak':
        if (progress.streak >= item.days) out.push(make(item.id));
        break;
      case 'people': {
        if (item.metric === 'achieved30x30') {
          if (stats.achieved) out.push(make(item.id));
          break;
        }
        const targets = deps.people.targets;
        const threshold =
          item.threshold === 'target'
            ? item.metric === 'customers'
              ? targets.customersTarget
              : item.metric === 'f1'
                ? targets.f1Target
                : targets.contactsTarget
            : item.threshold;
        const value = item.metric === 'customers' ? stats.customers : item.metric === 'f1' ? stats.f1 : stats.contacts;
        if (threshold !== null && value >= threshold) out.push(make(item.id));
        break;
      }
    }
  }
  return out;
}

/**
 * Reads acknowledgements from non-compensated `settings_changed` events:
 * `payload.achievementAcknowledged` (string id), and `payload.stageAcknowledged`
 * which covers that stage and every stage before it (`stage:<id>` ids, using the
 * order of `stages`). Also reports whether `achievementsSeeded === true` exists.
 *
 * @param events Event log.
 * @param stages Stage defs in order (to expand `stageAcknowledged`).
 * @example
 * const { ids, seeded } = readAcknowledged(events, stages);
 */
export function readAcknowledged(events: readonly LogEvent[], stages: readonly StageDef[]): AcknowledgedState {
  const compensated = new Set<string>();
  for (const e of events) {
    const target = e.payload.compensates;
    if (typeof target === 'string') compensated.add(target);
  }
  const ids = new Set<string>();
  let seeded = false;
  for (const e of events) {
    if (e.type !== 'settings_changed') continue;
    if (compensated.has(e.id) || typeof e.payload.compensates === 'string') continue;
    const p = e.payload;
    if (typeof p.achievementAcknowledged === 'string') ids.add(p.achievementAcknowledged);
    if (typeof p.stageAcknowledged === 'string') {
      const index = stages.findIndex((s) => s.id === p.stageAcknowledged);
      for (let i = 0; i <= index; i++) ids.add(`stage:${stages[i]?.id ?? ''}`);
    }
    if (p.achievementsSeeded === true) seeded = true;
  }
  return { ids, seeded };
}

/**
 * New achievements: achieved minus acknowledged, keeping the order of `achieved`.
 *
 * @example
 * const fresh = newAchievements(achieved, ack.ids);
 */
export function newAchievements(achieved: readonly AchievedItem[], acknowledged: ReadonlySet<string>): AchievedItem[] {
  return achieved.filter((a) => !acknowledged.has(a.id));
}

/**
 * Silent acknowledge events (`{ achievementAcknowledged: id, silent: true }`)
 * for every achieved item not yet acknowledged. Reuse after importing a backup.
 *
 * @param timestamp Optional ISO instant passed through to the events.
 * @example
 * for (const e of buildSilentAcknowledgeEvents(achieved, ack.ids)) await store.append(e);
 */
export function buildSilentAcknowledgeEvents(
  achieved: readonly AchievedItem[],
  acknowledged: ReadonlySet<string>,
  timestamp?: string,
): NewEvent[] {
  return newAchievements(achieved, acknowledged).map((a) => withTimestamp({ type: 'settings_changed', payload: { achievementAcknowledged: a.id, silent: true } }, timestamp));
}

/**
 * First-run seeding: the silent acknowledge events plus one
 * `settings_changed { achievementsSeeded: true }`. Returns [] when already seeded.
 *
 * @param achieved Currently achieved items.
 * @param seededAlready `AcknowledgedState.seeded`.
 * @param acknowledged Already acknowledged ids (default none).
 * @param timestamp Optional ISO instant passed through to the events.
 * @example
 * const events = buildSeedEvents(achieved, ack.seeded, ack.ids);
 */
export function buildSeedEvents(
  achieved: readonly AchievedItem[],
  seededAlready: boolean,
  acknowledged: ReadonlySet<string> = new Set(),
  timestamp?: string,
): NewEvent[] {
  if (seededAlready) return [];
  return [
    ...buildSilentAcknowledgeEvents(achieved, acknowledged, timestamp),
    withTimestamp({ type: 'settings_changed', payload: { achievementsSeeded: true } }, timestamp),
  ];
}

function withTimestamp(event: NewEvent, timestamp?: string): NewEvent {
  return timestamp === undefined ? event : { ...event, timestamp };
}

/**
 * Plans popups for new items: sorted stage -> daily_goal -> streak -> people
 * (stable inside a kind). Up to `maxPopupsPerAction` items give one single
 * popup each; more give `max - 1` singles and one `rest` popup with the remaining count.
 *
 * @example
 * planPopups(fresh, cfg.maxPopupsPerAction).popups; // [{kind:'single',item}, ..., {kind:'rest',count:2}]
 */
export function planPopups(newItems: readonly AchievedItem[], maxPopupsPerAction: number): PopupPlan {
  const max = Math.max(1, Math.floor(maxPopupsPerAction));
  const sorted = newItems
    .map((item, index) => ({ item, index }))
    .sort((a, b) => KIND_ORDER.indexOf(a.item.kind) - KIND_ORDER.indexOf(b.item.kind) || a.index - b.index)
    .map((x) => x.item);
  if (sorted.length <= max) return { popups: sorted.map((item) => ({ kind: 'single', item })) };
  const singles: PopupPlanEntry[] = sorted.slice(0, max - 1).map((item) => ({ kind: 'single', item }));
  return { popups: [...singles, { kind: 'rest', count: sorted.length - (max - 1) }] };
}

/**
 * Toast content for an event with a finite `xp > 0` that is not a compensating
 * event; otherwise null.
 *
 * @param nameFor Maps the event to its display name (task, activity or lesson).
 * @example
 * const toast = buildToast(event, (e) => nameOf(e)); // { xp: 15, label: 'Demo sản phẩm' } | null
 */
export function buildToast(event: LogEvent, nameFor: (event: LogEvent) => string): Toast | null {
  const xp = event.payload.xp;
  if (typeof xp !== 'number' || !Number.isFinite(xp) || xp <= 0) return null;
  if (event.payload.compensates !== undefined) return null;
  return { xp, label: nameFor(event) };
}

/**
 * Appends a toast to the pending queue (returns a new array). When the queue
 * already holds `maxQueue` toasts, the incoming one is merged into the last:
 * xp summed, `count` incremented (the UI formats "+X XP · N hoạt động").
 *
 * @example
 * queue = queueToasts(queue, toast); // at most 3 entries
 */
export function queueToasts(pending: readonly QueuedToast[], incoming: Toast, maxQueue = 3): QueuedToast[] {
  const limit = Math.max(1, Math.floor(maxQueue));
  const last = pending[pending.length - 1];
  if (pending.length < limit || last === undefined) return [...pending, { xp: incoming.xp, label: incoming.label, count: 1 }];
  return [...pending.slice(0, -1), { xp: last.xp + incoming.xp, label: last.label, count: last.count + 1 }];
}

/**
 * Picks one encouragement using the injected `random` (0 <= r < 1). Avoids
 * `lastUsed` when the list has more than one distinct choice; returns
 * {@link DEFAULT_ENCOURAGEMENT} for an empty list.
 *
 * @example
 * const text = pickEncouragement(cfg.encouragements, lastText, Math.random);
 */
export function pickEncouragement(list: readonly string[], lastUsed: string | null, random: () => number): string {
  if (list.length === 0) return DEFAULT_ENCOURAGEMENT;
  const filtered = list.length > 1 ? list.filter((s) => s !== lastUsed) : list;
  const pool = filtered.length > 0 ? filtered : list;
  const r = random();
  const index = Math.min(pool.length - 1, Math.max(0, Math.floor(Number.isFinite(r) ? r * pool.length : 0)));
  return pool[index] ?? DEFAULT_ENCOURAGEMENT;
}
