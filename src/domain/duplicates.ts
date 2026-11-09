/**
 * Duplicate contacts (story 026; design/gdd/crm.md rules 19-22): detection, merge planning and
 * the event builders for merge, "not the same person" and split. Pure and deterministic: no clock,
 * no I/O. The merge itself is applied when reading, by `derivePeople` (see `deriveMerges`).
 *
 * Event payloads (none ever carries `xp`):
 * - `person_merged { keepId, mergedId, amwayCode? }`: `keepId` is the contact added earlier;
 *   `amwayCode` (normalized digits) is present only when both had different codes and holds the chosen one.
 * - `person_not_duplicate { personIds: [a, b] }` (ids sorted).
 * - split = `person_merged { compensates: <merge event id> }` plus a `person_not_duplicate` for the pair.
 */
import type { LogEvent, NewEvent } from '../data/event-store';
import { deriveMerges, pairKey, phoneKey } from './people';
import type { PeopleConfig, Person } from './people';

/** Default max name distance when the config carries none. */
const DEFAULT_NAME_DISTANCE = 1;

/** Why two contacts look like the same person. */
export type DuplicateReason = 'amway_code' | 'phone' | 'same_name' | 'near_name';

/** How sure the detection is: `certain` (same code or phone) or `possible` (name only). */
export type DuplicateStrength = 'certain' | 'possible';

/** An unresolved pair of possibly duplicate contacts. */
export interface DuplicatePair {
  /** Order-independent identity of the pair (`pairKey` of the two person ids). */
  readonly key: string;
  /** The contact added earlier (the one kept by a merge). */
  readonly first: Person;
  /** The contact added later. */
  readonly second: Person;
  readonly strength: DuplicateStrength;
  readonly reasons: readonly DuplicateReason[];
}

/** Result of {@link planMerge}. */
export type MergePlan =
  | {
      readonly ok: true;
      readonly keepId: string;
      readonly mergedId: string;
      /** True when both have different codes: the user must choose one (`codes`) before merging. */
      readonly needsCodeChoice: boolean;
      /** The two different codes when `needsCodeChoice`, else empty. */
      readonly codes: readonly string[];
    }
  | { readonly ok: false; readonly reason: 'linked_conflict' };

/** Result of {@link buildMergeEvent}. */
export type MergeEventResult =
  | { readonly ok: true; readonly event: NewEvent }
  | { readonly ok: false; readonly reason: 'code_choice_required' | 'invalid_code_choice' };

/**
 * Folds a name for comparison: removes diacritics (đ -> d), lower-cases, collapses runs of
 * whitespace and trims. "  Nguyễn   ĐỨC " -> "nguyen duc".
 */
export function foldDuplicateName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Levenshtein edit distance, giving up (returning `limit + 1`) once it must exceed `limit`. */
export function editDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row.push(Math.min((previous[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, (previous[j - 1] ?? 0) + cost));
    }
    previous = row;
  }
  return previous[b.length] ?? limit + 1;
}

function phoneKeys(person: Person): Set<string> {
  const keys = new Set<string>();
  for (const phone of [person.phone, ...(person.phones ?? [])]) if (phone != null) keys.add(phoneKey(phone));
  return keys;
}

/**
 * Pairs the user still has to review. `people` is `derivePeople` output (add order: `first` is the
 * earlier one; merged-away people are already absent). Skipped: archived people and pairs marked
 * `person_not_duplicate` (also through merges: ids resolve to their keeper).
 * - certain: same `amwayCode`, or the same phone (also a secondary phone kept by a merge);
 * - possible: same name, or names within `config.duplicateNameMaxDistance` edits after folding
 *   (see {@link foldDuplicateName}); 0 means exact only.
 * A pair with a code or phone match is certain even when the names also match.
 *
 * @example
 * const pairs = findDuplicatePairs(derivePeople(events, config), events, config);
 */
export function findDuplicatePairs(people: readonly Person[], events: readonly LogEvent[], config: PeopleConfig): DuplicatePair[] {
  const maxDistance = config.duplicateNameMaxDistance ?? DEFAULT_NAME_DISTANCE;
  const { rootOf } = deriveMerges(events);
  const dismissed = new Set<string>();
  const cancelled = new Set<string>();
  for (const e of events) {
    const target = e.payload.compensates;
    if (typeof target === 'string') cancelled.add(target);
  }
  for (const e of events) {
    if (e.type !== 'person_not_duplicate' || cancelled.has(e.id)) continue;
    const ids = e.payload.personIds;
    if (Array.isArray(ids) && ids.length === 2 && typeof ids[0] === 'string' && typeof ids[1] === 'string') {
      dismissed.add(pairKey(rootOf.get(ids[0]) ?? ids[0], rootOf.get(ids[1]) ?? ids[1]));
    }
  }
  const candidates = people
    .filter((p) => !p.archived)
    .map((person) => ({ person, name: foldDuplicateName(person.name), phones: phoneKeys(person) }));
  const pairs: DuplicatePair[] = [];
  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const a = candidates[i];
      const b = candidates[j];
      if (a === undefined || b === undefined) continue;
      const key = pairKey(a.person.personId, b.person.personId);
      if (dismissed.has(key)) continue;
      const reasons: DuplicateReason[] = [];
      if (a.person.amwayCode != null && a.person.amwayCode === b.person.amwayCode) reasons.push('amway_code');
      if ([...a.phones].some((k) => b.phones.has(k))) reasons.push('phone');
      if (a.name !== '' && a.name === b.name) reasons.push('same_name');
      else if (maxDistance > 0 && a.name !== '' && b.name !== '' && editDistance(a.name, b.name, maxDistance) <= maxDistance) reasons.push('near_name');
      if (reasons.length === 0) continue;
      const certain = reasons.includes('amway_code') || reasons.includes('phone');
      pairs.push({ key, first: a.person, second: b.person, strength: certain ? 'certain' : 'possible', reasons });
    }
  }
  return pairs;
}

/**
 * Number of unresolved duplicate pairs (certain and possible); what the Làm tab entry and the
 * 30x30 warning show. Same inputs as {@link findDuplicatePairs}.
 */
export function pendingDuplicates(people: readonly Person[], events: readonly LogEvent[], config: PeopleConfig): number {
  return findDuplicatePairs(people, events, config).length;
}

/**
 * Decides how two contacts can be merged. `keepId` is the first (earlier added). Refused when both
 * are linked to two DIFFERENT accounts. With two different non-empty codes `needsCodeChoice` is true
 * and the user must pick one (see {@link buildMergeEvent}).
 */
export function planMerge(first: Person, second: Person): MergePlan {
  const linkedA = first.linkedUserId ?? null;
  const linkedB = second.linkedUserId ?? null;
  if (linkedA !== null && linkedB !== null && linkedA !== linkedB) return { ok: false, reason: 'linked_conflict' };
  const codeA = first.amwayCode ?? null;
  const codeB = second.amwayCode ?? null;
  const conflict = codeA !== null && codeB !== null && codeA !== codeB;
  return { ok: true, keepId: first.personId, mergedId: second.personId, needsCodeChoice: conflict, codes: conflict ? [codeA, codeB] : [] };
}

/**
 * Plans of the pairs "Gộp tất cả" may merge: ONLY `certain` pairs, in order, with no code conflict
 * and no two different linked accounts, also counting merges planned earlier in the same batch
 * (A-B and A-C together must not put two different codes into one contact). `possible` (name-only)
 * pairs are never included.
 */
export function planMergeAll(pairs: readonly DuplicatePair[]): { readonly pair: DuplicatePair; readonly plan: MergePlan & { readonly ok: true } }[] {
  const group = new Map<string, string>();
  const codes = new Map<string, Set<string>>();
  const linked = new Map<string, Set<string>>();
  const find = (id: string): string => {
    let root = id;
    for (let next = group.get(root); next !== undefined; next = group.get(root)) root = next;
    return root;
  };
  const seed = (p: Person): void => {
    if (!codes.has(p.personId)) codes.set(p.personId, new Set(p.amwayCode == null ? [] : [p.amwayCode]));
    if (!linked.has(p.personId)) linked.set(p.personId, new Set(p.linkedUserId == null ? [] : [p.linkedUserId]));
  };
  const result: { pair: DuplicatePair; plan: MergePlan & { ok: true } }[] = [];
  for (const pair of pairs) {
    if (pair.strength !== 'certain') continue;
    const plan = planMerge(pair.first, pair.second);
    if (!plan.ok || plan.needsCodeChoice) continue;
    seed(pair.first);
    seed(pair.second);
    const ra = find(pair.first.personId);
    const rb = find(pair.second.personId);
    if (ra === rb) continue;
    const mergedCodes = new Set([...(codes.get(ra) ?? []), ...(codes.get(rb) ?? [])]);
    const mergedLinked = new Set([...(linked.get(ra) ?? []), ...(linked.get(rb) ?? [])]);
    if (mergedCodes.size > 1 || mergedLinked.size > 1) continue;
    group.set(rb, ra);
    codes.set(ra, mergedCodes);
    linked.set(ra, mergedLinked);
    result.push({ pair, plan });
  }
  return result;
}

/**
 * Builds `person_merged { keepId, mergedId, amwayCode? }`. `chosenCode` is required exactly when
 * the plan needs a code choice and must be one of `plan.codes`; otherwise it is ignored and no
 * `amwayCode` is written. `timestamp` is passed through so callers own the clock.
 */
export function buildMergeEvent(plan: MergePlan & { readonly ok: true }, chosenCode?: string, timestamp?: string): MergeEventResult {
  if (plan.needsCodeChoice && chosenCode === undefined) return { ok: false, reason: 'code_choice_required' };
  if (plan.needsCodeChoice && chosenCode !== undefined && !plan.codes.includes(chosenCode)) return { ok: false, reason: 'invalid_code_choice' };
  const payload = {
    keepId: plan.keepId,
    mergedId: plan.mergedId,
    ...(plan.needsCodeChoice && chosenCode !== undefined ? { amwayCode: chosenCode } : {}),
  };
  return { ok: true, event: timestamp === undefined ? { type: 'person_merged', payload } : { type: 'person_merged', payload, timestamp } };
}

/** Builds `person_not_duplicate { personIds: [a, b] }` ("Không phải cùng người"); ids are sorted. */
export function buildNotDuplicateEvent(personIdA: string, personIdB: string, timestamp?: string): NewEvent {
  const payload = { personIds: [personIdA, personIdB].sort() };
  return timestamp === undefined ? { type: 'person_not_duplicate', payload } : { type: 'person_not_duplicate', payload, timestamp };
}

/**
 * Builds the events of "Tách liên hệ", to append in order: the compensating
 * `person_merged { compensates: mergeEventId }`, then `person_not_duplicate` for the pair so it is
 * not offered again. Neither carries XP.
 */
export function buildSplitEvents(mergeEventId: string, personIdA: string, personIdB: string, timestamp?: string): NewEvent[] {
  const payload = { compensates: mergeEventId };
  return [
    timestamp === undefined ? { type: 'person_merged', payload } : { type: 'person_merged', payload, timestamp },
    buildNotDuplicateEvent(personIdA, personIdB, timestamp),
  ];
}

/** `userId` of the event that added a person (who added it), or null when there is none. */
export function personAddedBy(events: readonly LogEvent[], personId: string): string | null {
  return events.find((e) => e.type === 'person_added' && e.payload.personId === personId)?.userId ?? null;
}
