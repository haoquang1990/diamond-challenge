/**
 * People (Người) model: derived from the event log, never stored.
 * Covers the person list, stage-change XP rules, activity ownership and the
 * 30x30 counts (design/gdd/crm.md; story-008-people-model).
 *
 * Pure and deterministic: no clock, no I/O. Undo uses the log-wide convention
 * `payload.compensates` (same rule as computeProgress). Stage-change XP lives
 * in the event's `payload.xp`, so computeProgress sums it without changes.
 */
import type { LogEvent, NewEvent } from '../data/event-store';

/** Id of the stage counted as "Khách hàng" in the 30x30 board. */
export const CUSTOMER_STAGE_ID = 'customer';
/** Id of the stage counted as F1 (NPP tuyến dưới) in the 30x30 board. */
export const F1_STAGE_ID = 'downline';
/** Marker owner for an activity whose `personId` has no `person_added` ("Người không rõ"). */
export const UNKNOWN_PERSON_ID = '__unknown_person__';

/** A validated person stage definition. */
export interface PersonStageDef {
  readonly id: string;
  /** Player-facing (Vietnamese) name. */
  readonly name: string;
  /** XP for first entering this stage from the previous one. */
  readonly xp: number;
}

/** 30x30 board thresholds. */
export interface PeopleTargets {
  readonly contactsTarget: number;
  readonly customersTarget: number;
  readonly f1Target: number;
}

/** Validated people configuration. */
export interface PeopleConfig {
  /** Ordered stages; the first is the starting stage. Never empty. */
  readonly stages: readonly PersonStageDef[];
  readonly targets: PeopleTargets;
}

/** Result of {@link parsePeopleConfig}. */
export interface PeopleConfigResult extends PeopleConfig {
  /** Human-readable problems; empty when the config is valid. */
  readonly problems: readonly string[];
}

/** A person derived from the log. */
export interface Person {
  readonly personId: string;
  readonly name: string;
  readonly note: string;
  readonly archived: boolean;
  /** Current stage id. */
  readonly stageId: string;
  /** Ids of stages this person already earned XP for (non-compensated change with xp > 0). */
  readonly stageXpAwarded: readonly string[];
}

/** Result of {@link planStageChange}. */
export type StageChangePlan = { readonly ok: true; readonly xp: number } | { readonly ok: false; readonly reason: 'unknown_stage' };

/** Result of {@link buildStageChangeEvent}. */
export type StageChangeResult =
  | { readonly ok: true; readonly xp: number; readonly event: NewEvent }
  | { readonly ok: false; readonly reason: 'unknown_stage' };

/** Result of {@link validatePersonName}. */
export type NameValidation = { readonly ok: true; readonly name: string } | { readonly ok: false; readonly reason: 'empty' };

/** Result of {@link findDuplicateNames}. */
export interface DuplicateNameResult {
  /** True when another non-archived person has the same name (warning, not an error). */
  readonly duplicate: boolean;
  readonly matches: readonly Person[];
}

/** 30x30 counts over non-archived people. */
export interface PeopleStats {
  readonly customers: number;
  readonly f1: number;
  readonly contacts: number;
  /** customers >= customersTarget AND f1 >= f1Target. */
  readonly achieved: boolean;
  /** contacts >= contactsTarget. */
  readonly contactsMet: boolean;
}

/**
 * Safe fallbacks used when a config field is invalid. The single starting
 * stage carries no gameplay value; unreachable targets mean "never achieved".
 */
const FALLBACK_STAGES: readonly PersonStageDef[] = [{ id: 'acquaintance', name: 'Người quen', xp: 0 }];
const UNREACHABLE_TARGET = Number.MAX_SAFE_INTEGER;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function parseStages(raw: unknown, problems: string[]): readonly PersonStageDef[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    problems.push('personStages: expected a non-empty array');
    return FALLBACK_STAGES;
  }
  const stages: PersonStageDef[] = [];
  const seen = new Set<string>();
  let ok = true;
  (raw as unknown[]).forEach((item, index) => {
    const where = `personStages[${index}]`;
    if (!isRecord(item) || !isNonEmptyString(item.id) || !isNonEmptyString(item.name)) {
      problems.push(`${where}: needs a non-empty id and name`);
      ok = false;
      return;
    }
    const { id, name, xp } = item;
    if (typeof xp !== 'number' || !Number.isInteger(xp) || xp < 0) {
      problems.push(`${where} (${id}): xp must be an integer >= 0`);
      ok = false;
      return;
    }
    if (seen.has(id)) {
      problems.push(`${where} (${id}): duplicate id`);
      ok = false;
      return;
    }
    seen.add(id);
    stages.push({ id, name, xp });
  });
  if (ok && stages[0]?.xp !== 0) {
    problems.push('personStages: the first stage must have xp 0');
    ok = false;
  }
  return ok ? stages : FALLBACK_STAGES;
}

function parseTargets(raw: unknown, problems: string[]): PeopleTargets {
  const source = isRecord(raw) ? raw : {};
  if (!isRecord(raw)) problems.push('target30x30: expected an object');
  const read = (key: keyof PeopleTargets): number => {
    const value = source[key];
    if (isPositiveInteger(value)) return value;
    if (isRecord(raw)) problems.push(`target30x30.${key}: must be a positive integer`);
    return UNREACHABLE_TARGET;
  };
  return { contactsTarget: read('contactsTarget'), customersTarget: read('customersTarget'), f1Target: read('f1Target') };
}

/**
 * Validates the raw `personStages` and `target30x30` values at the data
 * boundary. Never throws. An invalid stage list falls back to a single
 * starting stage; each invalid target falls back to an unreachable value.
 * Every fallback is reported in `problems`.
 *
 * @example
 * const cfg = parsePeopleConfig({ personStages: gameConfig.personStages, target30x30: gameConfig.target30x30 });
 * if (cfg.problems.length > 0) console.warn(cfg.problems);
 */
export function parsePeopleConfig(raw: unknown): PeopleConfigResult {
  const problems: string[] = [];
  const source = isRecord(raw) ? raw : {};
  if (!isRecord(raw)) problems.push('people config: expected an object');
  const stages = parseStages(source.personStages, problems);
  const targets = parseTargets(source.target30x30, problems);
  return { stages, targets, problems };
}

/** Ids of events that some other event compensates. */
function compensatedIds(events: readonly LogEvent[]): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const e of events) {
    const target = e.payload.compensates;
    if (typeof target === 'string') ids.add(target);
  }
  return ids;
}

/**
 * Active events (not compensated, not themselves compensating) in
 * chronological order. Equal timestamps keep array order (stable sort).
 */
function activeEvents(events: readonly LogEvent[]): LogEvent[] {
  const compensated = compensatedIds(events);
  return events
    .filter((e) => !compensated.has(e.id) && typeof e.payload.compensates !== 'string')
    .sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0));
}

interface MutablePerson {
  personId: string;
  name: string;
  note: string;
  archived: boolean;
  stageId: string;
  stageXpAwarded: string[];
}

/**
 * Builds the people list from the event log (order of first `person_added`).
 *
 * - Name and note: latest `person_updated` wins; stage: `to` of the latest
 *   non-compensated `person_stage_changed`, else the first configured stage.
 * - Compensated events are excluded; events for unknown personIds, invalid
 *   payloads and stage ids not in the config are ignored (never throws).
 *
 * @example
 * const people = derivePeople(events, config);
 * const active = people.filter((p) => !p.archived);
 */
export function derivePeople(events: readonly LogEvent[], config: PeopleConfig): Person[] {
  const startStage = config.stages[0]?.id ?? '';
  const stageIds = new Set(config.stages.map((s) => s.id));
  const people = new Map<string, MutablePerson>();

  for (const e of activeEvents(events)) {
    const p = e.payload;
    const personId = p.personId;
    if (typeof personId !== 'string') continue;
    if (e.type === 'person_added') {
      if (people.has(personId) || !isNonEmptyString(p.name)) continue;
      people.set(personId, {
        personId,
        name: p.name.trim(),
        note: typeof p.note === 'string' ? p.note : '',
        archived: false,
        stageId: startStage,
        stageXpAwarded: [],
      });
      continue;
    }
    const person = people.get(personId);
    if (person === undefined) continue;
    if (e.type === 'person_updated') {
      if (isNonEmptyString(p.name)) person.name = p.name.trim();
      if (typeof p.note === 'string') person.note = p.note;
    } else if (e.type === 'person_archived') {
      person.archived = true;
    } else if (e.type === 'person_stage_changed') {
      const to = p.to;
      if (typeof to !== 'string' || !stageIds.has(to)) continue;
      person.stageId = to;
      if (typeof p.xp === 'number' && p.xp > 0 && !person.stageXpAwarded.includes(to)) person.stageXpAwarded.push(to);
    }
  }
  return [...people.values()];
}

/**
 * Decides the XP of moving `person` to `toStageId`: the stage's XP only when
 * it is the stage immediately after the current one AND the person has not
 * already earned XP for it; otherwise 0 (backward, skipping, same stage, repeat).
 * An unknown target stage is rejected.
 *
 * @example
 * planStageChange(person, 'contacted', config); // { ok: true, xp: <contacted xp> } first time
 */
export function planStageChange(person: Person, toStageId: string, config: PeopleConfig): StageChangePlan {
  const toIndex = config.stages.findIndex((s) => s.id === toStageId);
  const target = config.stages[toIndex];
  if (target === undefined) return { ok: false, reason: 'unknown_stage' };
  const fromIndex = config.stages.findIndex((s) => s.id === person.stageId);
  const isNext = fromIndex >= 0 && toIndex === fromIndex + 1;
  const alreadyEarned = person.stageXpAwarded.includes(toStageId);
  return { ok: true, xp: isNext && !alreadyEarned ? target.xp : 0 };
}

/**
 * Builds the `person_stage_changed` event for a move, with the XP decided by
 * {@link planStageChange}, or a rejection (no event) for an unknown stage.
 * `timestamp` is passed through so callers own the clock.
 *
 * @example
 * const r = buildStageChangeEvent(person, 'contacted', config, now.toISOString());
 * if (r.ok) await store.append(r.event);
 */
export function buildStageChangeEvent(
  person: Person,
  toStageId: string,
  config: PeopleConfig,
  timestamp?: string,
): StageChangeResult {
  const plan = planStageChange(person, toStageId, config);
  if (!plan.ok) return plan;
  const payload = { personId: person.personId, from: person.stageId, to: toStageId, xp: plan.xp };
  const event: NewEvent =
    timestamp === undefined ? { type: 'person_stage_changed', payload } : { type: 'person_stage_changed', payload, timestamp };
  return { ok: true, xp: plan.xp, event };
}

/**
 * Validates a person name: trims it and rejects empty or whitespace-only input.
 *
 * @example
 * validatePersonName('  Lan '); // { ok: true, name: 'Lan' }
 */
export function validatePersonName(name: string): NameValidation {
  const trimmed = name.trim();
  return trimmed === '' ? { ok: false, reason: 'empty' } : { ok: true, name: trimmed };
}

function nameKey(name: string): string {
  return name.trim().normalize('NFC').toLowerCase();
}

/**
 * Finds non-archived people whose name equals `name` (trimmed, case-insensitive).
 * Duplicates are allowed; this only drives a warning. Pass `excludePersonId`
 * when renaming so a person does not match themselves.
 *
 * @example
 * findDuplicateNames(people, 'lan').duplicate; // true when "Lan" exists
 */
export function findDuplicateNames(people: readonly Person[], name: string, excludePersonId?: string): DuplicateNameResult {
  const key = nameKey(name);
  const matches = people.filter((p) => !p.archived && p.personId !== excludePersonId && nameKey(p.name) === key);
  return { duplicate: matches.length > 0, matches };
}

/**
 * Owner of every non-compensated `activity_logged` event: activityId ->
 * personId, or null when none. `payload.personId` is overridden by the latest
 * non-compensated `activity_reassigned`. An owner without a `person_added`
 * resolves to {@link UNKNOWN_PERSON_ID}. Reassignment carries no XP.
 *
 * @example
 * const owners = deriveActivityOwners(events);
 * const owner = owners.get(activityEvent.id) ?? null;
 */
export function deriveActivityOwners(events: readonly LogEvent[]): ReadonlyMap<string, string | null> {
  const active = activeEvents(events);
  const known = new Set<string>();
  const raw = new Map<string, string | null>();
  for (const e of active) {
    if (e.type === 'person_added' && typeof e.payload.personId === 'string') known.add(e.payload.personId);
    if (e.type === 'activity_logged') {
      raw.set(e.id, typeof e.payload.personId === 'string' ? e.payload.personId : null);
    }
  }
  for (const e of active) {
    if (e.type !== 'activity_reassigned') continue;
    const { activityId, personId } = e.payload;
    if (typeof activityId === 'string' && typeof personId === 'string' && raw.has(activityId)) raw.set(activityId, personId);
  }
  const owners = new Map<string, string | null>();
  for (const [activityId, personId] of raw) {
    owners.set(activityId, personId === null || known.has(personId) ? personId : UNKNOWN_PERSON_ID);
  }
  return owners;
}

/**
 * 30x30 counts over non-archived people: customers (stage `customer`), f1
 * (stage `downline`), contacts (all stages).
 *
 * @example
 * const stats = computePeopleStats(people, config);
 * if (stats.achieved) celebrate();
 */
export function computePeopleStats(people: readonly Person[], config: PeopleConfig): PeopleStats {
  const active = people.filter((p) => !p.archived);
  const customers = active.filter((p) => p.stageId === CUSTOMER_STAGE_ID).length;
  const f1 = active.filter((p) => p.stageId === F1_STAGE_ID).length;
  const contacts = active.length;
  return {
    customers,
    f1,
    contacts,
    achieved: customers >= config.targets.customersTarget && f1 >= config.targets.f1Target,
    contactsMet: contacts >= config.targets.contactsTarget,
  };
}
