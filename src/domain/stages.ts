/**
 * Con đường Diamond stages: config validation, stage selection and progress
 * toward the next stage (design/game-brief.md MVP feature 4; story-006).
 *
 * Pure and deterministic: no clock, no I/O. Stages are recomputed from the
 * event log and total XP, never stored. This is a habit roadmap, not a
 * verification of any official title.
 */
import type { LogEvent } from '../data/event-store';

/** An activity-count condition for a stage, e.g. 5 x `new_customer`. */
export interface StageMilestone {
  /** Activity type id counted from non-compensated `activity_logged` events. */
  readonly activityType: string;
  /** Required number of such activities (positive integer). */
  readonly count: number;
  /** Player-facing label, e.g. "5 lần Khách hàng mới". */
  readonly label: string;
}

/** A validated stage definition. */
export interface StageDef {
  readonly id: string;
  readonly name: string;
  /** Total XP needed. */
  readonly xp: number;
  /** Extra conditions; empty when the stage is XP-only. */
  readonly milestones: readonly StageMilestone[];
}

/** Result of {@link parseStageConfig}. */
export interface StageConfigResult {
  /** Valid stages, sorted by xp (non-decreasing) with unique ids. */
  readonly stages: readonly StageDef[];
  /** Human-readable problems found (also for skipped stages). */
  readonly problems: readonly string[];
}

/** Whether a stage is behind, at, or ahead of the player. */
export type StageState = 'done' | 'current' | 'locked';

/** One milestone with the player's current count. */
export interface MilestoneStatus extends StageMilestone {
  /** Count so far (may exceed `count`). */
  readonly current: number;
  readonly met: boolean;
}

/** Status of one stage. */
export interface StageStatus {
  readonly stage: StageDef;
  readonly state: StageState;
  /** XP still missing for this stage's own threshold (0 when reached). */
  readonly xpMissing: number;
  readonly milestones: readonly MilestoneStatus[];
  /** This stage's own conditions (XP and milestones) are all met, ignoring sequence. */
  readonly conditionsMet: boolean;
}

/** Result of {@link computeStageProgress}. */
export interface StageProgress {
  /** Every stage, in order. */
  readonly stages: readonly StageStatus[];
  /** Index of the current stage, or -1 when there are no stages. */
  readonly currentIndex: number;
  readonly current: StageDef | null;
  /** The first locked stage, or null at the last stage. */
  readonly next: StageDef | null;
  /** XP-based progress from the current stage's threshold to the next one's, clamped 0..100. 100 when there is no next stage. */
  readonly percentToNext: number;
  /** The next stage's XP threshold is met but a milestone is still missing (not "reached"). */
  readonly blockedByMilestones: boolean;
  /** XP still missing for the next stage (0 when met). */
  readonly xpToNext: number;
  /** Milestones of the next stage not yet met. */
  readonly missingMilestones: readonly MilestoneStatus[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * Validates the raw `stages` value from game-config.json at the data
 * boundary. Never throws. Invalid stages (bad fields, duplicate id, xp lower
 * than the previous kept stage) are skipped and reported; a non-array or empty
 * input yields an empty list plus a problem.
 */
export function parseStageConfig(raw: unknown): StageConfigResult {
  const problems: string[] = [];
  if (!Array.isArray(raw)) {
    return { stages: [], problems: ['stages: expected an array'] };
  }
  const stages: StageDef[] = [];
  const seen = new Set<string>();
  raw.forEach((item: unknown, index) => {
    const where = `stages[${index}]`;
    if (!isRecord(item)) {
      problems.push(`${where}: not an object`);
      return;
    }
    const { id, name, xp, milestones: rawMilestones } = item;
    if (!isNonEmptyString(id)) {
      problems.push(`${where}: missing id`);
      return;
    }
    if (!isNonEmptyString(name)) {
      problems.push(`${where} (${id}): missing name`);
      return;
    }
    if (typeof xp !== 'number' || !Number.isFinite(xp) || xp < 0) {
      problems.push(`${where} (${id}): xp must be a number >= 0`);
      return;
    }
    if (seen.has(id)) {
      problems.push(`${where} (${id}): duplicate id`);
      return;
    }
    const milestones: StageMilestone[] = [];
    if (rawMilestones !== undefined) {
      if (!Array.isArray(rawMilestones)) {
        problems.push(`${where} (${id}): milestones must be an array`);
        return;
      }
      for (const m of rawMilestones as unknown[]) {
        if (
          !isRecord(m) ||
          !isNonEmptyString(m.activityType) ||
          typeof m.count !== 'number' ||
          !Number.isInteger(m.count) ||
          m.count < 1 ||
          !isNonEmptyString(m.label)
        ) {
          problems.push(`${where} (${id}): invalid milestone`);
          return;
        }
        milestones.push({ activityType: m.activityType, count: m.count, label: m.label });
      }
    }
    const previous = stages[stages.length - 1];
    if (previous !== undefined && xp < previous.xp) {
      problems.push(`${where} (${id}): not sorted by xp ascending`);
      return;
    }
    seen.add(id);
    stages.push({ id, name, xp, milestones });
  });
  if (stages.length === 0) problems.push('stages: no valid stage');
  return { stages, problems };
}

/**
 * Counts non-compensated `activity_logged` events per `payload.activityType`.
 * Same compensation rule as computeProgress: an event whose id is some event's
 * `payload.compensates` is excluded, and compensating events themselves never count.
 * Events whose `userId` is in `others` do not count (story 023, see `otherMemberIds`).
 */
export function countActivities(events: readonly LogEvent[], others?: ReadonlySet<string>): ReadonlyMap<string, number> {
  const compensated = new Set<string>();
  for (const e of events) {
    const target = e.payload.compensates;
    if (typeof target === 'string') compensated.add(target);
  }
  const counts = new Map<string, number>();
  for (const e of events) {
    if (e.type !== 'activity_logged') continue;
    if (compensated.has(e.id) || typeof e.payload.compensates === 'string') continue;
    if (others?.has(e.userId) === true) continue;
    const type = e.payload.activityType;
    if (typeof type !== 'string') continue;
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  return counts;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/**
 * Determines every stage's state, the current and next stage, and progress.
 *
 * Unlock is sequential: a stage is unlocked only when its own XP and
 * milestones are met and every earlier stage is unlocked. The percentage is
 * XP-based; `blockedByMilestones` tells the UI that 100% XP is not "reached".
 *
 * @param events Event log (for milestone counts).
 * @param totalXp Total XP from computeProgress.
 * @param stages Validated stages from {@link parseStageConfig}.
 * @param others Optional authors that are not me: their events do not count for milestones (story 023).
 */
export function computeStageProgress(
  events: readonly LogEvent[],
  totalXp: number,
  stages: readonly StageDef[],
  others?: ReadonlySet<string>,
): StageProgress {
  const counts = countActivities(events, others);
  const details = stages.map((stage) => {
    const milestones: MilestoneStatus[] = stage.milestones.map((m) => {
      const current = counts.get(m.activityType) ?? 0;
      return { ...m, current, met: current >= m.count };
    });
    const xpMissing = Math.max(0, stage.xp - totalXp);
    return { stage, xpMissing, milestones, conditionsMet: xpMissing === 0 && milestones.every((m) => m.met) };
  });

  let unlockedCount = 0;
  while (unlockedCount < details.length && details[unlockedCount]?.conditionsMet === true) unlockedCount++;
  const currentIndex = unlockedCount - 1;

  const statuses: StageStatus[] = details.map((d, i) => ({
    ...d,
    state: i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'locked',
  }));

  const current = stages[currentIndex] ?? null;
  const nextStatus = statuses[currentIndex + 1];
  const next = nextStatus?.stage ?? null;
  let percentToNext = 100;
  if (nextStatus !== undefined) {
    const start = current?.xp ?? 0;
    const span = nextStatus.stage.xp - start;
    percentToNext = span > 0 ? clampPercent(((totalXp - start) / span) * 100) : nextStatus.xpMissing === 0 ? 100 : 0;
  }
  const missingMilestones = nextStatus?.milestones.filter((m) => !m.met) ?? [];
  return {
    stages: statuses,
    currentIndex,
    current,
    next,
    percentToNext,
    blockedByMilestones: nextStatus !== undefined && nextStatus.xpMissing === 0 && missingMilestones.length > 0,
    xpToNext: nextStatus?.xpMissing ?? 0,
    missingMilestones,
  };
}

/**
 * Last acknowledged stage id from `settings_changed` events with
 * `payload.stageAcknowledged` (latest timestamp wins; ties go to the later
 * event in the array), or null when none.
 */
export function lastAcknowledgedStageId(events: readonly LogEvent[]): string | null {
  let best: LogEvent | null = null;
  let id: string | null = null;
  for (const e of events) {
    if (e.type !== 'settings_changed') continue;
    const ack = e.payload.stageAcknowledged;
    if (typeof ack !== 'string') continue;
    if (best === null || e.timestamp >= best.timestamp) {
      best = e;
      id = ack;
    }
  }
  return id;
}

/**
 * Whether to show the "reached a new stage" celebration.
 * True when the current stage is higher than the acknowledged one. With no
 * (or unknown) acknowledgement, only a stage above the first counts, so a new
 * user at the starting stage is never celebrated for it.
 */
export function shouldCelebrate(
  acknowledgedId: string | null,
  currentIndex: number,
  stages: readonly StageDef[],
): boolean {
  if (currentIndex < 0) return false;
  const ackIndex = acknowledgedId === null ? -1 : stages.findIndex((s) => s.id === acknowledgedId);
  return currentIndex > Math.max(ackIndex, 0);
}
