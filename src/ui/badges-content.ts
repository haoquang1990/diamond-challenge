/**
 * The badge catalog (`content/badges.json` + one "Xong chặng" badge per lesson stage), loaded
 * once, and the evaluation the overlay and the Huy hiệu screen share (stories 046–047).
 */
import badgesJson from '../content/badges.json';
import gameConfig from '../config/game-config.json';
import type { LogEvent } from '../data/event-store';
import type { AchievedItem } from '../domain/achievements';
import { achievedBadgeItems, badgeRows, computeBadgeMetrics, parseBadges } from '../domain/badges';
import type { BadgeRow, ParsedBadges } from '../domain/badges';
import { otherMemberIds } from '../domain/progress';
import { LOADED_LESSONS, LOADED_STAGES } from './lesson-content';
import { PEOPLE_CONFIG } from './people-config';

/** Validated catalog. */
export const BADGES: ParsedBadges = parseBadges(badgesJson, LOADED_STAGES, LOADED_LESSONS.lessons);
if (BADGES.problems.length > 0) console.warn('[badges] catalog problems', BADGES.problems);

/** Badge cards with values, plus the achieved tier items, for `events` now. */
export function evaluateBadges(
  events: readonly LogEvent[],
  now: Date,
  timeZone: string,
  memberIds: ReadonlySet<string>,
): { readonly rows: BadgeRow[]; readonly achieved: AchievedItem[] } {
  const metrics = computeBadgeMetrics(events, now, timeZone, {
    people: PEOPLE_CONFIG,
    progress: { dailyXpGoal: gameConfig.dailyXpGoal },
    lessons: LOADED_LESSONS.lessons,
    stages: LOADED_STAGES,
    others: otherMemberIds(events, memberIds),
    householdMembers: memberIds.size,
  });
  const rows = badgeRows(BADGES.defs, metrics);
  return { rows, achieved: achievedBadgeItems(rows) };
}
