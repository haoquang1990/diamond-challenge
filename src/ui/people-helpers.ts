/** Pure helpers for the Người screens (grouping, stage suggestion, legacy activities). */
import type { LogEvent } from '../data/event-store';
import { UNKNOWN_PERSON_ID, planStageChange } from '../domain/people';
import type { PeopleConfig, Person, PersonStageDef } from '../domain/people';

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
