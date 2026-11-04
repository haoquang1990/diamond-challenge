/**
 * Activity types (Làm) loaded from `src/config/game-config.json`.
 * Adding a type needs only an entry in that file's `activityTypes` array.
 */
import gameConfig from '../config/game-config.json';

/** One loggable activity type. */
export interface ActivityType {
  /** Stable id written to `payload.activityType`; never rename once used. */
  readonly id: string;
  /** Player-facing name (Vietnamese). */
  readonly name: string;
  /** XP awarded per log. */
  readonly xp: number;
  /** Optional person stage id (from `personStages`) worth suggesting after logging this activity. */
  readonly suggestsStage?: string;
}

/**
 * Validates the raw `activityTypes` config value. Invalid or duplicate
 * entries are skipped with a `console.warn`; never throws. An invalid optional
 * `suggestsStage` (not a string, or not in `stageIds` when given) is ignored with a warning.
 */
export function parseActivityTypes(raw: unknown, stageIds?: readonly string[]): ActivityType[] {
  if (!Array.isArray(raw)) {
    console.warn('[config] activityTypes is not an array');
    return [];
  }
  const seen = new Set<string>();
  const result: ActivityType[] = [];
  for (const entry of raw as unknown[]) {
    const e = (typeof entry === 'object' && entry !== null ? entry : {}) as Record<string, unknown>;
    const valid =
      typeof e.id === 'string' &&
      e.id !== '' &&
      !seen.has(e.id) &&
      typeof e.name === 'string' &&
      e.name !== '' &&
      typeof e.xp === 'number' &&
      Number.isFinite(e.xp) &&
      e.xp >= 0;
    if (!valid) {
      console.warn(`[config] skipping invalid activity type: ${JSON.stringify(entry)}`);
      continue;
    }
    seen.add(e.id as string);
    const base: ActivityType = { id: e.id as string, name: e.name as string, xp: e.xp as number };
    const suggested = e.suggestsStage;
    if (suggested === undefined) {
      result.push(base);
    } else if (typeof suggested === 'string' && (stageIds === undefined || stageIds.includes(suggested))) {
      result.push({ ...base, suggestsStage: suggested });
    } else {
      console.warn(`[config] ignoring invalid suggestsStage on activity type ${base.id}: ${JSON.stringify(suggested)}`);
      result.push(base);
    }
  }
  return result;
}

/** Activity types from game-config.json, validated once at load. */
export const ACTIVITY_TYPES: readonly ActivityType[] = parseActivityTypes(
  gameConfig.activityTypes,
  gameConfig.personStages.map((stage) => stage.id),
);
