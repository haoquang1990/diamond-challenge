/**
 * Cheering earns XP (story 070): the sender gets `cheerXp.xp` for each of the first
 * `cheerXp.maxPerDay` cheers of a local day. The receiver gets none, so two people cannot farm
 * XP by cheering each other. A `cheer_sent` event is personal and is not a "Việc làm".
 */
import gameConfig from '../config/game-config.json';
import type { LogEvent, NewEvent } from '../data/event-store';

/** Tuning from `game-config.json` `cheerXp`. */
export const CHEER_XP: { readonly xp: number; readonly maxPerDay: number } = gameConfig.cheerXp;

/**
 * The `cheer_sent` event for a cheer I just sent, or null when today's XP cheers are used up.
 * Days are local to `timeZone`; my co-members' events (`others`) do not count. Pure.
 */
export function buildCheerXpEvent(
  events: readonly LogEvent[],
  now: Date,
  timeZone: string,
  others: ReadonlySet<string>,
  target: { readonly toHouseholdId: string; readonly toUserId?: string },
): NewEvent | null {
  const day = (d: Date) => d.toLocaleDateString('en-CA', { timeZone });
  const today = day(now);
  const undone = new Set<string>();
  for (const e of events) if (typeof e.payload.compensates === 'string') undone.add(e.payload.compensates);
  const used = events.filter(
    (e) => e.type === 'cheer_sent' && !undone.has(e.id) && !others.has(e.userId) && typeof e.payload.xp === 'number' && e.payload.xp > 0 && day(new Date(e.timestamp)) === today,
  ).length;
  if (used >= CHEER_XP.maxPerDay) return null;
  return {
    type: 'cheer_sent',
    payload: { xp: CHEER_XP.xp, toHouseholdId: target.toHouseholdId, ...(target.toUserId === undefined ? {} : { toUserId: target.toUserId }) },
  };
}
