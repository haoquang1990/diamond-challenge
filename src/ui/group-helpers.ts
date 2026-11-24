/**
 * Names and cheer candidates for F1 households (stories 028, 041). Pure; no network.
 */
import { activityStatus, sortGroup } from '../data/group-service';
import type { GroupHousehold, GroupMember } from '../data/group-service';
import type { Person } from '../domain/people';
import { STRINGS } from './strings';

/**
 * Account id → the name I saved in my own Danh bạ for the contact linked to that account
 * (`linkedUserId`, set by "Tạo tài khoản"). Archived contacts are included: still that person.
 */
export function linkedContactNames(people: readonly Person[]): ReadonlyMap<string, string> {
  const names = new Map<string, string>();
  for (const p of people) if (p.linkedUserId != null && p.linkedUserId !== '' && !names.has(p.linkedUserId)) names.set(p.linkedUserId, p.name);
  return names;
}

/** A member's name: the display name they set, else my contact name for that account, else phone, else a placeholder. */
export function groupMemberName(member: Pick<GroupMember, 'userId' | 'displayName' | 'phone'>, contactNames: ReadonlyMap<string, string>): string {
  return member.displayName ?? contactNames.get(member.userId) ?? member.phone ?? STRINGS.groupMemberUnnamed;
}

/**
 * Amway code → the name I saved in my own Danh bạ for the contact with that code (story 041,
 * 2026-11-24): names an F1 household whose members have not set a name yet.
 */
export function codeContactNames(people: readonly Person[]): ReadonlyMap<string, string> {
  const names = new Map<string, string>();
  for (const p of people) if (p.amwayCode != null && p.amwayCode !== '' && !names.has(p.amwayCode)) names.set(p.amwayCode, p.name);
  return names;
}

/**
 * Names of every member of a household, joined with " & " so a couple shows both (2026-11-24).
 * Each member: the display name they set, else my contact name for that account; when no member
 * is known that way the first unnamed one takes my contact name for the household code (unless a
 * member already shows it); the rest fall back to phone, then a placeholder.
 */
export function householdNames(
  h: GroupHousehold,
  contactNames: ReadonlyMap<string, string>,
  codeNames: ReadonlyMap<string, string> = new Map(),
): string {
  const known = h.members.map((m) => m.displayName ?? contactNames.get(m.userId) ?? null);
  const byCode = h.code === null ? undefined : codeNames.get(h.code);
  // My contact name for the household code goes to the first member without a name, unless a member already has it.
  let codeUsed = byCode === undefined || known.includes(byCode);
  const names = h.members.map((m, i) => {
    const name = known[i];
    if (name != null) return name;
    if (!codeUsed && byCode !== undefined) {
      codeUsed = true;
      return byCode;
    }
    return m.phone ?? STRINGS.groupMemberUnnamed;
  });
  if (names.length === 0) return byCode ?? STRINGS.groupMemberUnnamed;
  return names.join(' & ');
}

/**
 * Households the Hôm nay "Cổ vũ nhóm" card lists (story 041): not cheered today yet, inactive
 * or never-active first (then the loaded order), as {@link sortGroup} orders them.
 */
export function cheerCandidates(households: readonly GroupHousehold[], now: Date, inactiveDays: number): GroupHousehold[] {
  return sortGroup(households, now, inactiveDays).filter((h) => !h.cheeredToday);
}

/** "N ngày chưa hoạt động" / "Chưa hoạt động lần nào", or null for an active household. */
export function householdActivityNote(h: GroupHousehold, now: Date, inactiveDays: number): string | null {
  const status = activityStatus(h.lastActivityAt, now, inactiveDays);
  if (status.kind === 'never') return STRINGS.groupNeverActive;
  return status.kind === 'inactive' ? `${status.days} ngày chưa hoạt động` : null;
}

/**
 * The F1 household a contact stands for (story 042): the one whose active code equals the
 * contact's Amway code. Null when the contact has no code or no F1 household has it.
 */
export function findF1Household(households: readonly GroupHousehold[], amwayCode: string | null | undefined): GroupHousehold | null {
  if (amwayCode == null || amwayCode === '') return null;
  return households.find((h) => h.code === amwayCode) ?? null;
}

/** "KH 12 · NPP 3": the totals of an F1 household, no target (story 042). */
export function f1TotalsLabel(customers: number, f1: number): string {
  return `KH ${customers} · NPP ${f1}`;
}

/** A household's shared progress (story 044): XP of every member added up, the best streak. */
export interface HouseholdProgress {
  readonly xpTotal: number;
  readonly xp7d: number;
  readonly streak: number;
}

/** Adds up the members' shared progress; null when no member has sent any. Pure. */
export function householdProgress(h: GroupHousehold): HouseholdProgress | null {
  const sent = h.members.map((m) => m.progress).filter((p): p is NonNullable<typeof p> => p != null);
  if (sent.length === 0) return null;
  return {
    xpTotal: sent.reduce((sum, p) => sum + p.xpTotal, 0),
    xp7d: sent.reduce((sum, p) => sum + p.xp7d, 0),
    streak: Math.max(...sent.map((p) => p.streak)),
  };
}

/** How the NPP list of Làm is ordered (story 044). */
export type NppSort = 'newest' | 'xpTotal' | 'xp7d';

/**
 * Orders NPP contacts by their F1 household's progress, highest first (`xpTotal` or `xp7d`);
 * contacts without numbers keep their given order after the others. `newest` keeps the order.
 * Pure; stable.
 */
export function sortNppByProgress<T extends { readonly amwayCode?: string | null }>(
  people: readonly T[],
  progressByCode: ReadonlyMap<string, HouseholdProgress>,
  sort: NppSort,
): T[] {
  if (sort === 'newest') return [...people];
  const value = (p: T): number | null => {
    const stats = p.amwayCode == null ? undefined : progressByCode.get(p.amwayCode);
    return stats === undefined ? null : sort === 'xpTotal' ? stats.xpTotal : stats.xp7d;
  };
  return people
    .map((p, i) => ({ p, i, v: value(p) }))
    .sort((a, b) => (a.v === null && b.v === null ? a.i - b.i : a.v === null ? 1 : b.v === null ? -1 : b.v - a.v || a.i - b.i))
    .map((x) => x.p);
}

/** Code → household progress for every F1 household with a code and shared numbers. */
export function progressByCode(households: readonly GroupHousehold[]): ReadonlyMap<string, HouseholdProgress> {
  const map = new Map<string, HouseholdProgress>();
  for (const h of households) {
    const stats = householdProgress(h);
    if (h.code !== null && stats !== null) map.set(h.code, stats);
  }
  return map;
}

/** "XP 7 ngày 120 · Tổng 2.340 XP · Chuỗi 5 ngày" (story 044). */
export function householdProgressLabel(p: HouseholdProgress): string {
  const n = (x: number) => x.toLocaleString('vi-VN');
  return `XP 7 ngày ${n(p.xp7d)} · Tổng ${n(p.xpTotal)} XP · Chuỗi ${p.streak} ngày`;
}
