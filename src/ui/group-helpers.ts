/**
 * Names and cheer candidates for F1 households (stories 028, 041). Pure; no network.
 */
import { activityStatus, sortGroup } from '../data/group-service';
import type { GroupData, GroupHousehold, GroupMember } from '../data/group-service';
import type { Person } from '../domain/people';
import { formatE164 } from '../domain/people';
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

/**
 * A member's name (story 059: the sponsor's own names first): my contact name for that account,
 * else the display name they set, else phone, else a placeholder.
 */
export function groupMemberName(member: Pick<GroupMember, 'userId' | 'displayName' | 'phone'>, contactNames: ReadonlyMap<string, string>): string {
  return contactNames.get(member.userId) ?? member.displayName ?? (member.phone === null ? null : formatE164(member.phone)) ?? STRINGS.groupMemberUnnamed;
}

/** Name for one F1 login row (story 059): my contact name for that account, else theirs, else null. */
export function f1LoginName(member: Pick<GroupMember, 'userId' | 'displayName' | 'phone'>, contactNames: ReadonlyMap<string, string>): string | null {
  return contactNames.get(member.userId) ?? member.displayName ?? null;
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
export function householdNames(h: GroupHousehold, contactNames: ReadonlyMap<string, string>, codeNames: ReadonlyMap<string, string> = new Map()): string {
  // Story 059: my own names first. A member linked to one of my contacts gets that name; my
  // contact name for the code goes to the first member without a linked name; only then the name
  // they set, then the phone.
  const linked = h.members.map((m) => contactNames.get(m.userId) ?? null);
  const byCode = h.code === null ? undefined : codeNames.get(h.code);
  let codeUsed = byCode === undefined || linked.includes(byCode);
  const names = h.members.map((m, i) => {
    const name = linked[i];
    if (name != null) return name;
    if (!codeUsed && byCode !== undefined) {
      codeUsed = true;
      return byCode;
    }
    return m.displayName ?? (m.phone === null ? STRINGS.groupMemberUnnamed : formatE164(m.phone));
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
  /** Story 060: some member met today's goal (numbers from `today`); only when `today` is given. */
  readonly goalToday?: boolean;
}

/**
 * Adds up the members' shared progress; null when no member has sent any. With `today` (local
 * YYYY-MM-DD) it also says whether today's goal is met. Pure.
 */
export function householdProgress(h: GroupHousehold, today?: string): HouseholdProgress | null {
  const sent = h.members.map((m) => m.progress).filter((p): p is NonNullable<typeof p> => p != null);
  if (sent.length === 0) return null;
  return {
    xpTotal: sent.reduce((sum, p) => sum + p.xpTotal, 0),
    xp7d: sent.reduce((sum, p) => sum + p.xp7d, 0),
    streak: Math.max(...sent.map((p) => p.streak)),
    ...(today === undefined ? {} : { goalToday: sent.some((p) => p.statsDay === today && p.goalToday === true) }),
  };
}

/** How the NPP list of Làm is ordered (story 044). */
export type NppSort = 'newest' | 'xpTotal' | 'xp7d';

/**
 * Orders NPP contacts by their F1 household's progress, highest first (`xpTotal` or `xp7d`);
 * contacts without numbers keep their given order after the others. `newest` keeps the order.
 * Pure; stable.
 */
export function sortNppByProgress<T extends { readonly amwayCode?: string | null }>(people: readonly T[], progressByCode: ReadonlyMap<string, HouseholdProgress>, sort: NppSort): T[] {
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
export function progressByCode(households: readonly GroupHousehold[], today?: string): ReadonlyMap<string, HouseholdProgress> {
  const map = new Map<string, HouseholdProgress>();
  for (const h of households) {
    const stats = householdProgress(h, today);
    if (h.code !== null && stats !== null) map.set(h.code, stats);
  }
  return map;
}

/** "XP 7 ngày 120 · Tổng 2.340 XP · Chuỗi 5 ngày" (story 044). */
export function householdProgressLabel(p: HouseholdProgress): string {
  const n = (x: number) => x.toLocaleString('vi-VN');
  return `XP 7 ngày ${n(p.xp7d)} · Tổng ${n(p.xpTotal)} XP · Chuỗi ${p.streak} ngày`;
}

/** What a sponsor needs to cheer or remind one F1 NPP (story 050), members combined. */
export interface HouseholdInsight {
  /** Some member met today's goal (numbers computed today). */
  readonly goalToday: boolean;
  /** Best member's active days of the last 7. */
  readonly activeDays7d: number;
  /** Tasks of the last 7 days, members added up. */
  readonly tasks7d: Readonly<Record<string, number>>;
  /** Best member's lessons learned. */
  readonly lessonsDistinct: number;
  readonly lastLessonAt: string | null;
  /** Badges earned in 7 days, members added up. */
  readonly badges7d: number;
  /** Latest time any member's app sent its numbers. */
  readonly lastSeenAt: string | null;
  /** Best streak (as in {@link householdProgress}). */
  readonly streak: number;
  /** Some member never changed the first password. */
  readonly notActivated: boolean;
  /** Today's XP goal the member(s) picked (story 056), highest of those sent today; null when unknown. */
  readonly goalXp?: number | null;
}

/**
 * Combines the members' story 050 numbers; null when no member's app has sent them yet. Today's
 * goal only counts when the numbers are from `today` (local YYYY-MM-DD). Pure.
 */
export function householdInsight(h: GroupHousehold, today: string): HouseholdInsight | null {
  const notActivated = h.members.some((m) => m.activated === false);
  const sent = h.members.map((m) => m.progress).filter((p): p is NonNullable<typeof p> => p != null && p.statsDay !== undefined);
  if (sent.length === 0)
    return notActivated
      ? {
          goalToday: false,
          activeDays7d: 0,
          tasks7d: {},
          lessonsDistinct: 0,
          lastLessonAt: null,
          badges7d: 0,
          lastSeenAt: null,
          streak: 0,
          notActivated,
        }
      : null;
  const latest = (xs: (string | null | undefined)[]) => xs.reduce<string | null>((best, x) => (x != null && (best === null || x > best) ? x : best), null);
  const tasks: Record<string, number> = {};
  for (const p of sent) for (const [k, v] of Object.entries(p.tasks7d ?? {})) tasks[k] = (tasks[k] ?? 0) + v;
  return {
    goalToday: sent.some((p) => p.statsDay === today && p.goalToday === true),
    goalXp: sent.filter((p) => p.statsDay === today && typeof p.goalXp === 'number').reduce<number | null>((best, p) => Math.max(best ?? 0, p.goalXp ?? 0), null),
    activeDays7d: Math.max(...sent.map((p) => p.activeDays7d ?? 0)),
    tasks7d: tasks,
    lessonsDistinct: Math.max(...sent.map((p) => p.lessonsDistinct ?? 0)),
    lastLessonAt: latest(sent.map((p) => p.lastLessonAt)),
    badges7d: sent.reduce((sum, p) => sum + (p.badges7d ?? 0), 0),
    lastSeenAt: latest(sent.map((p) => p.lastSeenAt)),
    streak: Math.max(...sent.map((p) => p.streak)),
    notActivated,
  };
}

/** The device's local calendar day of `d`, as YYYY-MM-DD (matches story 050's `statsDay`). */
export function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Whole days from `iso` to `now`, or null. */
function daysSince(iso: string | null, now: Date): number | null {
  if (iso === null) return null;
  return Math.max(0, Math.floor((now.getTime() - Date.parse(iso)) / 86_400_000));
}

/** "hôm nay" / "hôm qua" / "N ngày trước". */
export function agoLabel(iso: string | null, now: Date): string | null {
  const d = daysSince(iso, now);
  return d === null ? null : d === 0 ? 'hôm nay' : d === 1 ? 'hôm qua' : `${d} ngày trước`;
}

/** Short task names for the 7-day line, in display order. */
const TASK_LABELS: readonly (readonly [string, string])[] = [
  ['contact', 'Liên hệ'],
  ['demo', 'Demo'],
  ['opp', 'OPP'],
  ['new_customer', 'Bán hàng'],
  ['new_npp', 'Bảo trợ'],
];

/** "Liên hệ 5 · Demo 2 · OPP 0 · Bán hàng 1 · Bảo trợ 0". */
export function tasks7dLabel(tasks: Readonly<Record<string, number>>): string {
  return TASK_LABELS.map(([id, name]) => `${name} ${tasks[id] ?? 0}`).join(' · ');
}

/**
 * The most useful reminder line for the cheer card (story 050), or null: not activated, streak
 * about to break, goal already met today, inactive this week.
 */
export function insightNote(i: HouseholdInsight | null): string | null {
  if (i === null) return null;
  if (i.notActivated) return 'Chưa đăng nhập tài khoản';
  if (i.streak >= 3 && !i.goalToday) return `Chuỗi ${i.streak} ngày sắp đứt`;
  if (i.goalToday) return 'Hôm nay đã đạt mục tiêu';
  if (i.activeDays7d === 0) return '7 ngày qua chưa hoạt động';
  return null;
}

/**
 * Cheer lines suited to the F1's numbers (story 050), most relevant first; the picker shows them
 * above the usual lines. Pure.
 */
export function suggestCheers(i: HouseholdInsight | null, now: Date): string[] {
  if (i === null) return [];
  const out: string[] = [];
  if (i.notActivated) out.push('Bạn đăng nhập app thử nhé, cần mật khẩu mới thì nhắn mình!');
  if (i.badges7d > 0) out.push('Chúc mừng bạn có thêm huy hiệu mới!');
  if ((i.tasks7d.new_customer ?? 0) > 0) out.push('Chúc mừng có khách hàng mới tuần này!');
  if ((i.tasks7d.new_npp ?? 0) > 0) out.push('Chúc mừng bạn bảo trợ được NPP mới!');
  if (i.streak >= 3 && !i.goalToday) out.push(`Giữ chuỗi ${i.streak} ngày nhé, hôm nay vẫn còn kịp!`);
  if (i.goalToday) out.push('Hôm nay bạn đạt mục tiêu rồi, tuyệt vời!');
  if ((i.tasks7d.demo ?? 0) > 0) out.push(`Tuần này đã ${i.tasks7d.demo} buổi demo, giỏi quá!`);
  if (!i.notActivated && i.activeDays7d === 0) out.push('Lâu rồi chưa thấy bạn hoạt động, cần mình hỗ trợ gì không?');
  const lesson = daysSince(i.lastLessonAt, now);
  if (!i.notActivated && (lesson === null || lesson >= 7)) out.push('Dành 2 phút học một bài hôm nay nhé!');
  return out;
}

/** What the Hôm nay "Cổ vũ nhóm" card shows (2026-11-27). */
export type CheerCardView =
  | { readonly kind: 'hidden' }
  | { readonly kind: 'done' }
  | { readonly kind: 'list'; readonly households: GroupHousehold[]; readonly spouses: NonNullable<GroupData['spouses']>[number][] };

/**
 * The cheer card's content: hidden without F1 households or spouse, "everyone cheered" when
 * nobody is left today, else who is left (households ordered by {@link cheerCandidates}). A
 * group loaded on an earlier local day (the cache) keeps no "cheered today" marks. Pure.
 */
export function cheerCardView(group: GroupData | null, now: Date, inactiveDays: number): CheerCardView {
  if (group === null || group.myHouseholdId === null) return { kind: 'hidden' };
  const spousesAll = group.spouses ?? [];
  if (group.households.length === 0 && spousesAll.length === 0) return { kind: 'hidden' };
  const fresh = localDayKey(new Date(group.loadedAt)) === localDayKey(now);
  const households = cheerCandidates(fresh ? group.households : group.households.map((h) => ({ ...h, cheeredToday: false })), now, inactiveDays);
  const spouses = spousesAll.filter((m) => !fresh || !m.cheeredToday);
  return households.length === 0 && spouses.length === 0 ? { kind: 'done' } : { kind: 'list', households, spouses };
}
