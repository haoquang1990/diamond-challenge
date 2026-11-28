/**
 * The people of my Nhóm (story 070): vợ/chồng, tuyến trên, tuyến dưới and bạn bè with the numbers
 * they share, from `nhom_people()`, and what the Hôm nay card shows of them.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/** How a Nhóm person is related to me. */
export type NhomRelation = 'spouse' | 'upline' | 'downline' | 'friend';

/** Card order after "about to lose a streak": vợ/chồng, F1, tuyến trên, bạn bè. */
const RELATION_ORDER: readonly NhomRelation[] = ['spouse', 'downline', 'upline', 'friend'];

/** One person of my Nhóm. */
export interface NhomPerson {
  readonly userId: string;
  readonly relation: NhomRelation;
  readonly householdId: string;
  readonly name: string | null;
  readonly code: string | null;
  /** Null when the person has not shared numbers yet. */
  readonly streak: number | null;
  /** As shared; true counts only when `statsDay` is today. */
  readonly goalToday: boolean;
  readonly statsDay: string | null;
  readonly xp7d: number | null;
  readonly lastSeenAt: string | null;
  readonly cheeredToday: boolean;
}

/** `nhom_people()` rows as {@link NhomPerson}s; malformed rows are dropped. Pure. */
export function parseNhomRows(raw: unknown): NhomPerson[] {
  if (!Array.isArray(raw)) return [];
  const out: NhomPerson[] = [];
  for (const r of raw as Record<string, unknown>[]) {
    if (typeof r !== 'object' || r === null || typeof r.user_id !== 'string' || typeof r.household_id !== 'string') continue;
    if (!(RELATION_ORDER as readonly unknown[]).includes(r.relation)) continue;
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    out.push({
      userId: r.user_id,
      relation: r.relation as NhomRelation,
      householdId: r.household_id,
      name: typeof r.display_name === 'string' && r.display_name.trim() !== '' ? r.display_name : null,
      code: typeof r.code === 'string' ? r.code : null,
      streak: num(r.streak),
      goalToday: r.goal_today === true,
      statsDay: typeof r.stats_day === 'string' ? r.stats_day.slice(0, 10) : null,
      xp7d: num(r.xp_7d),
      lastSeenAt: typeof r.last_seen_at === 'string' ? r.last_seen_at : null,
      cheeredToday: r.cheered_today === true,
    });
  }
  return out;
}

/** True when the person met today's goal (`today`: my local day, YYYY-MM-DD). Pure. */
export function metToday(p: NhomPerson, today: string): boolean {
  return p.goalToday && p.statsDay === today;
}

/** A row of "Chưa đạt hôm nay". */
export interface NhomNeed extends NhomPerson {
  /** Whole days since last seen, when 2 or more. */
  readonly daysAway: number | null;
}

/**
 * The Hôm nay card: how many met today's goal, avatars (met first), and up to `limit` people to
 * cheer: those about to lose a streak first, then vợ/chồng, F1, tuyến trên, bạn bè. Pure.
 */
export function nhomSummary(people: readonly NhomPerson[], today: string, now: Date, limit: number): {
  readonly total: number;
  readonly met: number;
  readonly avatars: readonly NhomPerson[];
  readonly needs: readonly NhomNeed[];
} {
  const rel = (p: NhomPerson) => RELATION_ORDER.indexOf(p.relation);
  const ordered = [...people].sort((a, b) => rel(a) - rel(b));
  const met = ordered.filter((p) => metToday(p, today));
  const notMet = ordered.filter((p) => !metToday(p, today));
  const atRisk = (p: NhomPerson) => ((p.streak ?? 0) > 0 ? 0 : 1);
  const needs = [...notMet]
    .sort((a, b) => atRisk(a) - atRisk(b) || rel(a) - rel(b))
    .slice(0, limit)
    .map((p) => {
      const days = p.lastSeenAt === null ? null : Math.floor((now.getTime() - Date.parse(p.lastSeenAt)) / 86_400_000);
      return { ...p, daysAway: days !== null && days >= 2 ? days : null };
    });
  return { total: people.length, met: met.length, avatars: [...met, ...notMet], needs };
}

/** My Nhóm, or null when it cannot be read (offline, older server). */
export async function loadNhomPeople(client: Pick<SupabaseClient, 'rpc'>): Promise<NhomPerson[] | null> {
  try {
    const { data, error } = await client.rpc('nhom_people');
    return error === null ? parseNhomRows(data) : null;
  } catch {
    return null;
  }
}
