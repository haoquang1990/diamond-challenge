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

/** Label shown on a person: customer (KH) or distributor downline (NPP). */
export type PersonLabel = 'KH' | 'NPP';

/** Legacy stage id -> task id it implies when the stage earned XP (read-only legacy migration). */
const LEGACY_STAGE_TASKS: Readonly<Record<string, string>> = { contacted: 'contact', demoed: 'demo', heard_opp: 'opp' };
/** Legacy `activity_logged` types (no `taskId`) that count as a done task for their person. */
const LEGACY_ACTIVITY_TASKS: ReadonlySet<string> = new Set(['demo', 'opp']);
/** Activity type that is not a contact with a person (adding a name). */
const ADD_NAME_ACTIVITY = 'add_name';
/** Valid phone number digit count (inclusive). */
export const PHONE_MIN_DIGITS = 6;
/** Valid phone number digit count (inclusive). */
export const PHONE_MAX_DIGITS = 15;

/** A validated person task definition (config `personTasks`). */
export interface PersonTaskDef {
  readonly id: string;
  /** Player-facing (Vietnamese) name. */
  readonly name: string;
  readonly xp: number;
  /** Repeatable tasks stay pending after completion. */
  readonly repeatable: boolean;
  /** Label this task gives the person, if any. */
  readonly label?: PersonLabel;
}

/** A validated country calling code (config `countryCodes`); the first is the default. */
export interface CountryCodeDef {
  readonly code: string;
  readonly name: string;
}

/** A person's phone: calling code plus digits only. */
export interface PersonPhone {
  readonly country: string;
  readonly number: string;
}

/** Inclusive digit-count bounds of a valid Amway code (config `amwayCodeDigits`). */
export interface AmwayCodeDigits {
  readonly min: number;
  readonly max: number;
}

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
  /** Person tasks in display order (additive; absent means none). */
  readonly tasks?: readonly PersonTaskDef[];
  /** Country calling codes, default first (additive; absent means none). */
  readonly countryCodes?: readonly CountryCodeDef[];
  /** Amway code digit bounds (additive; absent means the fallback bounds). */
  readonly amwayCodeDigits?: AmwayCodeDigits;
}

/** Result of {@link parsePeopleConfig}. */
export interface PeopleConfigResult extends PeopleConfig {
  readonly tasks: readonly PersonTaskDef[];
  readonly countryCodes: readonly CountryCodeDef[];
  readonly amwayCodeDigits: AmwayCodeDigits;
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
  /** Derived label; absent or null means none. */
  readonly label?: PersonLabel | null;
  /** Latest phone, or null/absent when none. */
  readonly phone?: PersonPhone | null;
  /** Latest valid Amway code (normalized digits), or null/absent when none. Lives on the person, never on the label. */
  readonly amwayCode?: string | null;
  /** Ids of tasks already done (non-repeatable ones are hidden from pending). */
  readonly doneTaskIds?: readonly string[];
  /** Timestamp of the event that set the currently effective label; null when none. */
  readonly labelledAt?: string | null;
  /** Latest contact timestamp (falls back to the add timestamp). */
  readonly lastContactAt?: string;
  /** When the person became NPP (= labelledAt when label is NPP), else null. */
  readonly nppAt?: string | null;
}

/** Result of {@link buildTaskCompletionEvent}. */
export type TaskCompletionResult =
  | { readonly ok: true; readonly xp: number; readonly event: NewEvent }
  | { readonly ok: false; readonly reason: 'archived' | 'unknown_task' | 'already_done' };

/** Result of {@link validatePhone}. `phone` is null for an empty number (no phone). */
export type PhoneValidation =
  | { readonly ok: true; readonly phone: PersonPhone | null }
  | { readonly ok: false; readonly reason: 'unknown_country' | 'not_digits' | 'bad_length' };

/** Result of {@link validateAmwayCode}. `code` is null for an empty input (no code). */
export type AmwayCodeValidation = { readonly ok: true; readonly code: string | null } | { readonly ok: false };

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
/** Safe bounds used when `amwayCodeDigits` is missing or invalid. */
const FALLBACK_AMWAY_DIGITS: AmwayCodeDigits = { min: 4, max: 15 };
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
 * Validates raw `personTasks`. Never throws; invalid items are skipped and
 * reported, an unusable list gives an empty task list.
 *
 * @example
 * const { tasks, problems } = parsePersonTasks(gameConfig.personTasks);
 */
export function parsePersonTasks(raw: unknown): { tasks: readonly PersonTaskDef[]; problems: readonly string[] } {
  const problems: string[] = [];
  if (!Array.isArray(raw)) return { tasks: [], problems: ['personTasks: expected an array'] };
  const tasks: PersonTaskDef[] = [];
  const seen = new Set<string>();
  (raw as unknown[]).forEach((item, index) => {
    const where = `personTasks[${index}]`;
    if (!isRecord(item) || !isNonEmptyString(item.id) || !isNonEmptyString(item.name)) {
      problems.push(`${where}: needs a non-empty id and name`);
      return;
    }
    const { id, name, xp, repeatable, label } = item;
    if (typeof xp !== 'number' || !Number.isInteger(xp) || xp < 0) {
      problems.push(`${where} (${id}): xp must be an integer >= 0`);
      return;
    }
    if (seen.has(id)) {
      problems.push(`${where} (${id}): duplicate id`);
      return;
    }
    if (repeatable !== undefined && typeof repeatable !== 'boolean') problems.push(`${where} (${id}): repeatable must be a boolean`);
    if (label !== undefined && label !== 'KH' && label !== 'NPP') problems.push(`${where} (${id}): label must be 'KH' or 'NPP'`);
    seen.add(id);
    const def = { id, name, xp, repeatable: repeatable === true };
    tasks.push(label === 'KH' || label === 'NPP' ? { ...def, label } : def);
  });
  return { tasks, problems };
}

/**
 * Validates raw `amwayCodeDigits` (`{min, max}` positive integers, min <= max).
 * Never throws; an invalid value falls back to the default bounds and is reported.
 */
export function parseAmwayCodeDigits(raw: unknown): { amwayCodeDigits: AmwayCodeDigits; problems: readonly string[] } {
  if (isRecord(raw) && isPositiveInteger(raw.min) && isPositiveInteger(raw.max) && raw.min <= raw.max) {
    return { amwayCodeDigits: { min: raw.min, max: raw.max }, problems: [] };
  }
  return {
    amwayCodeDigits: FALLBACK_AMWAY_DIGITS,
    problems: ['amwayCodeDigits: expected {min, max} positive integers with min <= max, using fallback'],
  };
}

/** Safe default when `countryCodes` is unusable. */
const FALLBACK_COUNTRY_CODES: readonly CountryCodeDef[] = [{ code: '+84', name: 'Việt Nam' }];

/**
 * Validates raw `countryCodes` (array of `{code: '+NN', name}`; first is the
 * default). Never throws; invalid items are skipped and reported; an unusable
 * list falls back to a single Vietnam entry.
 *
 * @example
 * const { countryCodes } = parseCountryCodes(gameConfig.countryCodes);
 */
export function parseCountryCodes(raw: unknown): { countryCodes: readonly CountryCodeDef[]; problems: readonly string[] } {
  const problems: string[] = [];
  if (!Array.isArray(raw)) return { countryCodes: FALLBACK_COUNTRY_CODES, problems: ['countryCodes: expected an array'] };
  const out: CountryCodeDef[] = [];
  const seen = new Set<string>();
  (raw as unknown[]).forEach((item, index) => {
    const where = `countryCodes[${index}]`;
    if (!isRecord(item) || typeof item.code !== 'string' || !/^\+\d{1,4}$/.test(item.code) || !isNonEmptyString(item.name)) {
      problems.push(`${where}: needs code like "+84" and a non-empty name`);
      return;
    }
    if (seen.has(item.code)) {
      problems.push(`${where} (${item.code}): duplicate code`);
      return;
    }
    seen.add(item.code);
    out.push({ code: item.code, name: item.name });
  });
  if (out.length === 0) {
    problems.push('countryCodes: no valid entry, using fallback');
    return { countryCodes: FALLBACK_COUNTRY_CODES, problems };
  }
  return { countryCodes: out, problems };
}

/**
 * Validates the raw `personStages` and `target30x30` values at the data
 * boundary. Never throws. An invalid stage list falls back to a single
 * starting stage; each invalid target falls back to an unreachable value.
 * Every fallback is reported in `problems`. `personTasks` / `countryCodes`
 * are validated too, but only when the key is present in `raw` (so callers
 * passing just the legacy keys get empty tasks and the fallback country, with
 * no extra problems); pass the whole game config to validate them.
 *
 * @example
 * const cfg = parsePeopleConfig(gameConfig);
 * if (cfg.problems.length > 0) console.warn(cfg.problems);
 */
export function parsePeopleConfig(raw: unknown): PeopleConfigResult {
  const problems: string[] = [];
  const source = isRecord(raw) ? raw : {};
  if (!isRecord(raw)) problems.push('people config: expected an object');
  const stages = parseStages(source.personStages, problems);
  const targets = parseTargets(source.target30x30, problems);
  let tasks: readonly PersonTaskDef[] = [];
  if ('personTasks' in source) {
    const r = parsePersonTasks(source.personTasks);
    tasks = r.tasks;
    problems.push(...r.problems);
  }
  let countryCodes = FALLBACK_COUNTRY_CODES;
  if ('countryCodes' in source) {
    const r = parseCountryCodes(source.countryCodes);
    countryCodes = r.countryCodes;
    problems.push(...r.problems);
  }
  let amwayCodeDigits = FALLBACK_AMWAY_DIGITS;
  if ('amwayCodeDigits' in source) {
    const r = parseAmwayCodeDigits(source.amwayCodeDigits);
    amwayCodeDigits = r.amwayCodeDigits;
    problems.push(...r.problems);
  }
  return { stages, targets, tasks, countryCodes, amwayCodeDigits, problems };
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
  label: PersonLabel | null;
  labelledAt: string | null;
  phone: PersonPhone | null;
  amwayCode: string | null;
  done: Set<string>;
  lastContactAt: string;
}

function readPhone(raw: unknown): PersonPhone | null | undefined {
  if (!isRecord(raw) || typeof raw.country !== 'string' || typeof raw.number !== 'string') return undefined;
  return raw.number === '' ? null : { country: raw.country, number: raw.number };
}

/**
 * Normalizes an Amway code with the server's rule (`normalize_amway_code`): drops spaces, dots
 * and dashes; the rest must be `digits.min`-`digits.max` digits. Returns null when invalid.
 *
 * @example
 * normalizeAmwayCode('1234 567-89', { min: 4, max: 15 }); // '123456789'
 */
export function normalizeAmwayCode(input: string, digits: AmwayCodeDigits): string | null {
  const compact = input.replace(/[\s.\-]/g, '');
  return /^[0-9]+$/.test(compact) && compact.length >= digits.min && compact.length <= digits.max ? compact : null;
}

/**
 * Validates the optional Amway code typed in a form. An empty (or blank) input is valid and
 * yields `code: null` (no code / clear); otherwise see {@link normalizeAmwayCode}.
 *
 * @example
 * validateAmwayCode('12', config); // { ok: false }
 */
export function validateAmwayCode(input: string, config: PeopleConfig): AmwayCodeValidation {
  if (input.trim() === '') return { ok: true, code: null };
  const code = normalizeAmwayCode(input, config.amwayCodeDigits ?? FALLBACK_AMWAY_DIGITS);
  return code === null ? { ok: false } : { ok: true, code };
}

function setLabel(person: MutablePerson, next: PersonLabel | null, timestamp: string): void {
  if (next === person.label) return;
  person.label = next;
  person.labelledAt = next === null ? null : timestamp;
}

/**
 * Builds the people list from the event log (order of first `person_added`).
 *
 * - Amway code: latest valid `amwayCode` wins ('' clears; an invalid one is ignored). Label
 *   changes never touch it.
 * - Name, note, phone: latest `person_updated` wins; archived: latest of
 *   `person_archived` / `person_restored`.
 * - Stage (legacy): `to` of the latest non-compensated `person_stage_changed`.
 * - Label: iterate active events in log order. Legacy stage `customer` -> KH,
 *   `downline` -> NPP, any other known stage -> none. An `activity_logged`
 *   with a string `taskId` whose config task has label KH sets KH (unless NPP);
 *   label NPP sets NPP, which never reverts to KH. Legacy `new_customer`
 *   without `taskId` gives no label.
 * - Done tasks: activities owned by the person (honouring `activity_reassigned`)
 *   by `taskId` (or legacy `demo`/`opp`), plus legacy stages that earned XP.
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
  const tasks = config.tasks ?? [];
  const digits = config.amwayCodeDigits ?? FALLBACK_AMWAY_DIGITS;
  const readCode = (raw: unknown): string | null | undefined =>
    typeof raw !== 'string' ? undefined : raw.trim() === '' ? null : (normalizeAmwayCode(raw, digits) ?? undefined);
  const owners = deriveActivityOwners(events);
  const people = new Map<string, MutablePerson>();

  for (const e of activeEvents(events)) {
    const p = e.payload;
    if (e.type === 'activity_logged') {
      const owner = owners.get(e.id);
      const person = typeof owner === 'string' ? people.get(owner) : undefined;
      if (person === undefined) continue;
      const activityType = typeof p.activityType === 'string' ? p.activityType : '';
      if (activityType !== ADD_NAME_ACTIVITY) person.lastContactAt = e.timestamp;
      if (typeof p.taskId === 'string') {
        person.done.add(p.taskId);
        const label = tasks.find((t) => t.id === p.taskId)?.label;
        if (label === 'KH' && person.label === null) setLabel(person, 'KH', e.timestamp);
        else if (label === 'NPP') setLabel(person, 'NPP', e.timestamp);
      } else if (LEGACY_ACTIVITY_TASKS.has(activityType)) {
        person.done.add(activityType);
      }
      continue;
    }
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
        label: null,
        labelledAt: null,
        phone: readPhone(p.phone) ?? null,
        amwayCode: readCode(p.amwayCode) ?? null,
        done: new Set(),
        lastContactAt: e.timestamp,
      });
      continue;
    }
    const person = people.get(personId);
    if (person === undefined) continue;
    if (e.type === 'person_updated') {
      if (isNonEmptyString(p.name)) person.name = p.name.trim();
      if (typeof p.note === 'string') person.note = p.note;
      const phone = readPhone(p.phone);
      if (phone !== undefined) person.phone = phone;
      const code = readCode(p.amwayCode);
      if (code !== undefined) person.amwayCode = code;
    } else if (e.type === 'person_archived') {
      person.archived = true;
    } else if (e.type === 'person_restored') {
      person.archived = false;
    } else if (e.type === 'person_stage_changed') {
      const to = p.to;
      if (typeof to !== 'string' || !stageIds.has(to)) continue;
      person.stageId = to;
      person.lastContactAt = e.timestamp;
      const earned = typeof p.xp === 'number' && p.xp > 0;
      if (earned && !person.stageXpAwarded.includes(to)) person.stageXpAwarded.push(to);
      const doneTask = LEGACY_STAGE_TASKS[to];
      if (earned && doneTask !== undefined) person.done.add(doneTask);
      setLabel(person, to === CUSTOMER_STAGE_ID ? 'KH' : to === F1_STAGE_ID ? 'NPP' : null, e.timestamp);
    }
  }
  return [...people.values()].map((m) => ({
    personId: m.personId,
    name: m.name,
    note: m.note,
    archived: m.archived,
    stageId: m.stageId,
    stageXpAwarded: m.stageXpAwarded,
    label: m.label,
    phone: m.phone,
    amwayCode: m.amwayCode,
    doneTaskIds: [...m.done],
    labelledAt: m.labelledAt,
    lastContactAt: m.lastContactAt,
    nppAt: m.label === 'NPP' ? m.labelledAt : null,
  }));
}

/**
 * Tasks still to do for a person, in config order: non-repeatable tasks vanish
 * once done, repeatable ones always stay, archived people have none.
 *
 * @example
 * pendingTasks(person, config).map((t) => t.name);
 */
export function pendingTasks(person: Person, config: PeopleConfig): PersonTaskDef[] {
  if (person.archived) return [];
  const done = person.doneTaskIds ?? [];
  return (config.tasks ?? []).filter((t) => t.repeatable || !done.includes(t.id));
}

/**
 * Builds the single `activity_logged` event that completes a task:
 * `{activityType: taskId, taskId, xp, personId}` with xp from the config.
 * Rejects (no event) an archived person, an unknown task and an already-done
 * non-repeatable task. `timestamp` is passed through so callers own the clock.
 *
 * @example
 * const r = buildTaskCompletionEvent(person, 'demo', config, now.toISOString());
 * if (r.ok) await store.append(r.event);
 */
export function buildTaskCompletionEvent(
  person: Person,
  taskId: string,
  config: PeopleConfig,
  timestamp?: string,
): TaskCompletionResult {
  if (person.archived) return { ok: false, reason: 'archived' };
  const task = (config.tasks ?? []).find((t) => t.id === taskId);
  if (task === undefined) return { ok: false, reason: 'unknown_task' };
  if (!task.repeatable && (person.doneTaskIds ?? []).includes(taskId)) return { ok: false, reason: 'already_done' };
  const payload = { activityType: task.id, taskId: task.id, xp: task.xp, personId: person.personId };
  const event: NewEvent = timestamp === undefined ? { type: 'activity_logged', payload } : { type: 'activity_logged', payload, timestamp };
  return { ok: true, xp: task.xp, event };
}

/**
 * Customers ordered by `lastContactAt`, oldest first (longest without contact
 * first). Returns a new array; does not filter.
 *
 * @example
 * const list = sortCustomersByLastContact(people.filter((p) => p.label === 'KH'));
 */
export function sortCustomersByLastContact(people: readonly Person[]): Person[] {
  return [...people].sort((a, b) => cmp(a.lastContactAt ?? '', b.lastContactAt ?? ''));
}

/**
 * NPP ordered by `nppAt`, newest first. Returns a new array; does not filter.
 *
 * @example
 * const list = sortNppByDate(people.filter((p) => p.label === 'NPP'));
 */
export function sortNppByDate(people: readonly Person[]): Person[] {
  return [...people].sort((a, b) => cmp(b.nppAt ?? '', a.nppAt ?? ''));
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Validates a phone: the country must be in `config.countryCodes`, spaces are
 * stripped, only digits remain, 6-15 digits. An empty number is valid and
 * yields `phone: null` (no phone).
 *
 * @example
 * validatePhone('+84', '912 345 678', config); // { ok: true, phone: { country: '+84', number: '912345678' } }
 */
export function validatePhone(country: string, number: string, config: PeopleConfig): PhoneValidation {
  if (!(config.countryCodes ?? []).some((c) => c.code === country)) return { ok: false, reason: 'unknown_country' };
  const digits = number.replace(/\s+/g, '');
  if (digits === '') return { ok: true, phone: null };
  if (!/^[0-9]+$/.test(digits)) return { ok: false, reason: 'not_digits' };
  if (digits.length < PHONE_MIN_DIGITS || digits.length > PHONE_MAX_DIGITS) return { ok: false, reason: 'bad_length' };
  return { ok: true, phone: { country, number: digits } };
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
 * 30x30 counts over non-archived people: customers (label KH), f1 (label
 * NPP), contacts (everyone). Thresholds come from `target30x30`.
 *
 * @example
 * const stats = computePeopleStats(people, config);
 * if (stats.achieved) celebrate();
 */
export function computePeopleStats(people: readonly Person[], config: PeopleConfig): PeopleStats {
  const active = people.filter((p) => !p.archived);
  const customers = active.filter((p) => p.label === 'KH').length;
  const f1 = active.filter((p) => p.label === 'NPP').length;
  const contacts = active.length;
  return {
    customers,
    f1,
    contacts,
    achieved: customers >= config.targets.customersTarget && f1 >= config.targets.f1Target,
    contactsMet: contacts >= config.targets.contactsTarget,
  };
}
