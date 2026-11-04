import gameConfig from '../config/game-config.json';
import { parsePeopleConfig } from '../domain/people';
import type { PeopleConfig } from '../domain/people';

const PARSED = parsePeopleConfig({ personStages: gameConfig.personStages, target30x30: gameConfig.target30x30 });
if (PARSED.problems.length > 0) console.warn('[people] config problems', PARSED.problems);

/** People stages and targets from game-config.json, validated once at load. */
export const PEOPLE_CONFIG: PeopleConfig = { stages: PARSED.stages, targets: PARSED.targets };
