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

/** Member names of a household, joined; a placeholder when it has none. */
export function householdNames(h: GroupHousehold, contactNames: ReadonlyMap<string, string>): string {
  const names = h.members.map((m) => groupMemberName(m, contactNames));
  return names.length === 0 ? STRINGS.groupMemberUnnamed : names.join(', ');
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
