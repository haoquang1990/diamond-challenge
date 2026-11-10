/**
 * Lesson groups for the Học list ("chia tab Học theo chặng"). The group list
 * and its order live in `src/content/lessons.json` (`stages`), each lesson
 * names its group with `stage`. Pure; never throws.
 */
import type { Lesson } from './lesson';

/** One lesson group (a sales-process step such as "Mời hẹn"). */
export interface LessonStage {
  readonly id: string;
  readonly title: string;
}

/** Result of {@link parseLessonStages}. */
export interface ParsedLessonStages {
  /** Valid groups in file order. */
  readonly stages: readonly LessonStage[];
  /** Human-readable problems with skipped entries. */
  readonly problems: readonly string[];
}

/** One section of the Học list; `stage` null is the final "other" group. */
export interface LessonGroup {
  readonly stage: LessonStage | null;
  readonly lessons: readonly Lesson[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * Reads the optional `stages` list of the content file. Absent means no
 * groups (every lesson goes to "other"); a bad entry is skipped and reported.
 */
export function parseLessonStages(raw: unknown): ParsedLessonStages {
  if (!isRecord(raw) || raw.stages === undefined) return { stages: [], problems: [] };
  if (!Array.isArray(raw.stages)) return { stages: [], problems: ['Danh sách nhóm bài (stages) sai định dạng.'] };
  const stages: LessonStage[] = [];
  const problems: string[] = [];
  const seen = new Set<string>();
  (raw.stages as unknown[]).forEach((entry, position) => {
    if (!isRecord(entry) || !isNonEmptyString(entry.id) || !isNonEmptyString(entry.title)) {
      problems.push(`Nhóm bài #${position + 1} bị bỏ qua: cần id và title.`);
      return;
    }
    if (seen.has(entry.id)) {
      problems.push(`Nhóm bài "${entry.id}" bị bỏ qua: trùng id.`);
      return;
    }
    seen.add(entry.id);
    stages.push({ id: entry.id, title: entry.title });
  });
  return { stages, problems };
}

/**
 * Groups lessons under `stages` in stage order (empty stages included, so the
 * player sees the whole path). Lessons keep file order inside a group. Lessons
 * with no stage or an unknown one go to a final group with `stage: null`,
 * present only when it has lessons.
 */
export function groupLessonsByStage(lessons: readonly Lesson[], stages: readonly LessonStage[]): LessonGroup[] {
  const known = new Set(stages.map((s) => s.id));
  const groups: LessonGroup[] = stages.map((stage) => ({ stage, lessons: lessons.filter((l) => l.stage === stage.id) }));
  const other = lessons.filter((l) => l.stage === undefined || !known.has(l.stage));
  if (other.length > 0) groups.push({ stage: null, lessons: other });
  return groups;
}
