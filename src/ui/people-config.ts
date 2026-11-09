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
});
if (PARSED.problems.length > 0) console.warn('[people] config problems', PARSED.problems);

/** People stages (legacy), targets, tasks, country codes, Amway code digits and duplicate name distance from game-config.json, validated once at load. */
export const PEOPLE_CONFIG: PeopleConfig & { readonly tasks: readonly PersonTaskDef[]; readonly countryCodes: readonly CountryCodeDef[] } = {
  stages: PARSED.stages,
  targets: PARSED.targets,
  tasks: PARSED.tasks,
  countryCodes: PARSED.countryCodes,
  amwayCodeDigits: PARSED.amwayCodeDigits,
  duplicateNameMaxDistance: PARSED.duplicateNameMaxDistance,
};

/** Person tasks in display order. */
export const PERSON_TASKS: readonly PersonTaskDef[] = PARSED.tasks;
/** Country calling codes; the first is the default. */
export const COUNTRY_CODES: readonly CountryCodeDef[] = PARSED.countryCodes;
