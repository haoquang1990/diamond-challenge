import gameConfig from '../config/game-config.json';
import { parsePeopleConfig } from '../domain/people';
import type { CountryCodeDef, PeopleConfig, PersonTaskDef } from '../domain/people';

const PARSED = parsePeopleConfig({
  personStages: gameConfig.personStages,
  target30x30: gameConfig.target30x30,
  personTasks: gameConfig.personTasks,
  countryCodes: gameConfig.countryCodes,
  amwayCodeDigits: gameConfig.amwayCodeDigits,
  duplicateNameMaxDistance: gameConfig.duplicateNameMaxDistance,
  activityBackdateDays: gameConfig.activityBackdateDays,
  activityNoteMaxLength: gameConfig.activityNoteMaxLength,
});
if (PARSED.problems.length > 0) console.warn('[people] config problems', PARSED.problems);

/** People stages (legacy), targets, tasks, country codes, Amway code digits, duplicate name distance and activity limits (story 034) from game-config.json, validated once at load. */
export const PEOPLE_CONFIG: PeopleConfig & { readonly tasks: readonly PersonTaskDef[]; readonly countryCodes: readonly CountryCodeDef[]; readonly activityBackdateDays: number; readonly activityNoteMaxLength: number } = {
  stages: PARSED.stages,
  targets: PARSED.targets,
  tasks: PARSED.tasks,
  countryCodes: PARSED.countryCodes,
  amwayCodeDigits: PARSED.amwayCodeDigits,
  duplicateNameMaxDistance: PARSED.duplicateNameMaxDistance,
  activityBackdateDays: PARSED.activityBackdateDays,
  activityNoteMaxLength: PARSED.activityNoteMaxLength,
};

/** Person tasks in display order. */
export const PERSON_TASKS: readonly PersonTaskDef[] = PARSED.tasks;
/** Country calling codes; the first is the default. */
export const COUNTRY_CODES: readonly CountryCodeDef[] = PARSED.countryCodes;

/** Positive whole number from the config, else the fallback (with a warning). */
function positiveInt(raw: unknown, fallback: number, key: string): number {
  if (typeof raw === 'number' && Number.isInteger(raw) && raw > 0) return raw;
  console.warn(`[people] config ${key} is not a positive whole number; using ${fallback}`);
  return fallback;
}

/** Days without activity after which a contact's day count turns orange (story 051). */
export const CONTACT_STALE_DAYS = positiveInt((gameConfig as Record<string, unknown>).contactStaleDays, 14, 'contactStaleDays');
/** Quiet time before the contact note saves itself (story 051). */
export const NOTE_AUTOSAVE_MS = positiveInt((gameConfig as Record<string, unknown>).noteAutosaveMs, 1000, 'noteAutosaveMs');
