/** Pure helpers for the Làm tab (person list): filters, name search, legacy activities, history. */
import type { HouseholdMember } from '../data/contact-sync';
import { STRINGS } from './strings';
import { FORMER_MEMBER_ID } from '../data/event-store';
import type { LogEvent } from '../data/event-store';
import {
  UNKNOWN_PERSON_ID,
  deriveActivityOwners,
  deriveMerges,
  planStageChange,
  sortCustomersByLastContact,
  sortNppByDate,
} from '../domain/people';
import type { PeopleConfig, Person, PersonPhone, PersonStageDef } from '../domain/people';

/** Non-archived people sharing one stage. */
export interface StageGroup {
  readonly stage: PersonStageDef;
  readonly people: readonly Person[];
}

/**
 * Groups non-archived people by stage in configured order. Stages with nobody
 * are omitted; people whose stage is not configured are skipped.
 */
export function groupPeopleByStage(people: readonly Person[], config: PeopleConfig): StageGroup[] {
  const groups: StageGroup[] = [];
  for (const stage of config.stages) {
    const inStage = people.filter((p) => !p.archived && p.stageId === stage.id);
    if (inStage.length > 0) groups.push({ stage, people: inStage });
  }
  return groups;
}

/** A stage change worth offering after logging an activity. */
export interface StageSuggestion {
  readonly stage: PersonStageDef;
  /** XP the move would give (0 when skipping a stage or already earned). */
  readonly xp: number;
}

/**
 * Suggestion after an activity: only when `suggestsStage` is a configured
 * stage strictly ahead of the person's current one. Otherwise null.
 */
export function suggestStageChange(
  person: Person,
  suggestsStage: string | undefined,
  config: PeopleConfig,
): StageSuggestion | null {
  if (suggestsStage === undefined) return null;
  const toIndex = config.stages.findIndex((s) => s.id === suggestsStage);
  const fromIndex = config.stages.findIndex((s) => s.id === person.stageId);
  const stage = config.stages[toIndex];
  if (stage === undefined || fromIndex < 0 || toIndex <= fromIndex) return null;
  const plan = planStageChange(person, suggestsStage, config);
  return plan.ok ? { stage, xp: plan.xp } : null;
}

/** A non-compensated activity with no owner, or whose owner does not exist. */
export interface UnassignedActivity {
  readonly event: LogEvent;
  /** True when it points to a missing person ("Người không rõ"). */
  readonly unknownOwner: boolean;
}

/**
 * Activities that need (re)assigning: owner null (legacy) or {@link UNKNOWN_PERSON_ID}.
 * `owners` comes from deriveActivityOwners; newest first.
 */
export function listUnassignedActivities(
  events: readonly LogEvent[],
  owners: ReadonlyMap<string, string | null>,
): UnassignedActivity[] {
  const result: UnassignedActivity[] = [];
  for (const event of events) {
    if (event.type !== 'activity_logged' || !owners.has(event.id)) continue;
    const owner = owners.get(event.id) ?? null;
    if (owner === null) result.push({ event, unknownOwner: false });
    else if (owner === UNKNOWN_PERSON_ID) result.push({ event, unknownOwner: true });
  }
  return result.sort((a, b) => (a.event.timestamp < b.event.timestamp ? 1 : a.event.timestamp > b.event.timestamp ? -1 : 0));
}

/** Filter chips of the Làm tab (person list). */
export type ContactsFilter = 'all' | 'kh' | 'npp' | 'archived';

/** Chip order in the UI; the first is the default. */
export const CONTACTS_FILTERS: readonly ContactsFilter[] = ['all', 'kh', 'npp', 'archived'];

/**
 * People shown under one filter chip (no separate lists, one source).
 * - all: non-archived, newest added first (derivePeople yields add order, so reversed; stable).
 * - kh: label KH, longest without contact first.
 * - npp: label NPP, newest NPP first.
 * - archived: archived people, newest added first.
 */
export function filterContacts(people: readonly Person[], filter: ContactsFilter): Person[] {
  const newestFirst = (list: readonly Person[]): Person[] => [...list].reverse();
  switch (filter) {
    case 'all':
      return newestFirst(people.filter((p) => !p.archived));
    case 'kh':
      return sortCustomersByLastContact(people.filter((p) => !p.archived && p.label === 'KH'));
    case 'npp':
      return sortNppByDate(people.filter((p) => !p.archived && p.label === 'NPP'));
    case 'archived':
      return newestFirst(people.filter((p) => p.archived));
  }
}

/**
 * Folds a name for search: NFD, combining marks removed, đ/Đ mapped to d,
 * lower case, outer whitespace trimmed. "Dũng Giang" → "dung giang".
 */
export function foldName(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim();
}

/**
 * Name search over an already filtered list (order kept). Substring match on
 * {@link foldName} of both sides, so it ignores case and Vietnamese diacritics:
 * "dung" and "DŨNG" match "Dũng Giang", and "an" matches it too (inside
 * "giang"); "an" does not match "Nam Uyên" (no contiguous "an").
 * A blank query returns every person.
 */
export function searchPeopleByName(people: readonly Person[], query: string): Person[] {
  const q = foldName(query);
  if (q === '') return [...people];
  return people.filter((p) => foldName(p.name).includes(q));
}

/** Number of people under each filter chip. */
export function countContacts(people: readonly Person[]): Record<ContactsFilter, number> {
  return {
    all: filterContacts(people, 'all').length,
    kh: filterContacts(people, 'kh').length,
    npp: filterContacts(people, 'npp').length,
    archived: filterContacts(people, 'archived').length,
  };
}

/** "+84 912345678", or '' when the person has no phone. */
export function formatPhone(phone: PersonPhone | null | undefined): string {
  return phone === null || phone === undefined ? '' : `${phone.country} ${phone.number}`;
}

/** One line of a person's history (read-only). */
export interface HistoryEntry {
  readonly id: string;
  readonly timestamp: string;
  readonly kind: 'activity' | 'stage';
  /** Activity/task name (kind 'activity', '' when unknown) or stage name (kind 'stage'). */
  readonly name: string;
  /** `userId` of the event (who did it). */
  readonly userId: string;
  /** Activity type id (kind 'activity' only). */
  readonly taskId?: string;
  /** XP the activity earned (kind 'activity' only, when recorded). */
  readonly xp?: number;
  /** Free-text note of the activity; present only when non-empty. */
  readonly note?: string;
}

/** One task's count in a {@link HistorySummary}. */
export interface HistoryTaskCount {
  readonly id: string;
  /** Task name, '' when unknown. */
  readonly name: string;
  readonly count: number;
}

/** Totals over a person's history (see {@link summarizeHistory}). */
export interface HistorySummary {
  /** Per-task counts, in order of first occurrence. */
  readonly counts: readonly HistoryTaskCount[];
  readonly totalXp: number;
  /** Timestamp of the earliest / latest activity, null when there is none. */
  readonly firstAt: string | null;
  readonly lastAt: string | null;
  /** Whole days from `lastAt` to `now` (never negative), null when there is no activity. */
  readonly daysSinceLast: number | null;
}

/**
 * Summary of a person's history: per-task counts, total XP, first and last
 * activity and whole days since the last one, relative to the injected `now`.
 * Takes the rows of {@link buildPersonHistory}, which already drops compensated
 * (undone) activities and includes merged contacts' activities; legacy stage
 * rows are ignored. Pure.
 *
 * @example
 * const s = summarizeHistory(buildPersonHistory(events, id, config, named), new Date());
 */
export function summarizeHistory(entries: readonly HistoryEntry[], now: Date): HistorySummary {
  const counts = new Map<string, { name: string; count: number }>();
  let totalXp = 0;
  let first: { ms: number; iso: string } | null = null;
  let last: { ms: number; iso: string } | null = null;
  for (const h of entries) {
    if (h.kind !== 'activity') continue;
    const id = h.taskId ?? '';
    const c = counts.get(id);
    if (c === undefined) counts.set(id, { name: h.name, count: 1 });
    else c.count += 1;
    totalXp += h.xp ?? 0;
    const ms = Date.parse(h.timestamp);
    if (Number.isNaN(ms)) continue;
    if (first === null || ms < first.ms) first = { ms, iso: h.timestamp };
    if (last === null || ms > last.ms) last = { ms, iso: h.timestamp };
  }
  const days = last === null ? null : Math.max(0, Math.floor((now.getTime() - last.ms) / 86_400_000));
  return {
    counts: [...counts].map(([id, c]) => ({ id, name: c.name, count: c.count })),
    totalXp,
    firstAt: first === null ? null : first.iso,
    lastAt: last === null ? null : last.iso,
    daysSinceLast: days,
  };
}

/** Value for an `<input type="datetime-local">` in local time, minute precision ("YYYY-MM-DDTHH:mm"). */
export function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * History of one person, newest first: non-compensated activities they own
 * (names from `namedTypes`, tasks first) and legacy non-compensated stage
 * changes to a configured stage, including those of contacts merged into this one. Pure; ties keep log order reversed.
 */
export function buildPersonHistory(
  events: readonly LogEvent[],
  personId: string,
  config: PeopleConfig,
  namedTypes: readonly { readonly id: string; readonly name: string }[],
): HistoryEntry[] {
  const compensated = new Set<string>();
  for (const e of events) {
    const target = e.payload.compensates;
    if (typeof target === 'string') compensated.add(target);
  }
  const owners = deriveActivityOwners(events);
  const { rootOf } = deriveMerges(events);
  const entries: HistoryEntry[] = [];
  for (const e of events) {
    if (compensated.has(e.id) || typeof e.payload.compensates === 'string') continue;
    if (e.type === 'activity_logged') {
      if (owners.get(e.id) !== personId) continue;
      const typeId = e.payload.activityType;
      const name = namedTypes.find((t) => t.id === typeId)?.name ?? '';
      const row: HistoryEntry = { id: e.id, timestamp: e.timestamp, kind: 'activity', name, userId: e.userId };
      const note = typeof e.payload.note === 'string' ? e.payload.note.trim() : '';
      entries.push({
        ...row,
        ...(typeof typeId === 'string' ? { taskId: typeId } : {}),
        ...(typeof e.payload.xp === 'number' ? { xp: e.payload.xp } : {}),
        ...(note !== '' ? { note } : {}),
      });
    } else if (e.type === 'person_stage_changed' && typeof e.payload.personId === 'string' && (rootOf.get(e.payload.personId) ?? e.payload.personId) === personId) {
      const stage = config.stages.find((s) => s.id === e.payload.to);
      if (stage !== undefined) entries.push({ id: e.id, timestamp: e.timestamp, kind: 'stage', name: stage.name, userId: e.userId });
    }
  }
  return entries.reverse().sort((a, b) => (a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0));
}

/**
 * How many times each activity type appears in a person's history (non-compensated
 * `activity_logged` rows, merged contacts included, as {@link buildPersonHistory} gives them).
 * Drives "đã làm N lần" in the Hoạt động list (story 035). Pure.
 *
 * @example
 * countDoneTasks(history).get('demo'); // 2
 */
export function countDoneTasks(entries: readonly HistoryEntry[]): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const h of entries) {
    if (h.kind !== 'activity' || h.taskId === undefined) continue;
    counts.set(h.taskId, (counts.get(h.taskId) ?? 0) + 1);
  }
  return counts;
}

/**
 * People (non-archived, other than `excludePersonId`) whose code equals `code`. `code` is a
 * normalized code; null or empty matches nobody. Pure; drives the typing warning in the form.
 */
export function findPeopleWithCode(people: readonly Person[], code: string | null, excludePersonId?: string): Person[] {
  if (code === null || code === '') return [];
  return people.filter((p) => !p.archived && p.personId !== excludePersonId && p.amwayCode === code);
}

/**
 * For each non-archived person that shares its code with others, the other people sharing it
 * (personId -> others). People with no code or a unique code are absent. Pure, no I/O.
 */
export function findDuplicateCodes(people: readonly Person[]): ReadonlyMap<string, readonly Person[]> {
  const result = new Map<string, readonly Person[]>();
  for (const p of people) {
    if (p.archived) continue;
    const others = findPeopleWithCode(people, p.amwayCode ?? null, p.personId);
    if (others.length > 0) result.set(p.personId, others);
  }
  return result;
}

/** Names of the people in a duplicate-code list, joined for the "Trùng mã số với …" warning. */
export function duplicateCodeNames(others: readonly Person[]): string {
  return others.map((o) => o.name).join(', ');
}

/**
 * Who did a history row (story 023), or null when it was me (`userId` not in `others`, see
 * `otherMemberIds`): the member's display name, else phone, else "Thành viên cũ" (removed
 * author). Null for another member while their names are not loaded (`members` null).
 *
 * @example
 * historyAuthorLabel(entry.userId, otherMemberIds(events, memberIds), members); // 'Lan' | null
 */
export function historyAuthorLabel(userId: string, others: ReadonlySet<string>, members: ReadonlyMap<string, HouseholdMember> | null): string | null {
  if (!others.has(userId)) return null;
  if (userId === FORMER_MEMBER_ID) return STRINGS.historyFormerMember;
  if (members === null) return null;
  const member = members.get(userId);
  return member?.displayName ?? member?.phone ?? STRINGS.historyFormerMember;
}
