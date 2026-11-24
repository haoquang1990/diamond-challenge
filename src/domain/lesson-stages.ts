/**
 * Lesson groups for the Học list ("chia tab Học theo chặng"). The group list
 * and its order live in `src/content/lessons.json` (`stages`), each lesson
 * names its group with `stage`. Pure; never throws.
 */
import type { LogEvent } from '../data/event-store';
import { lessonHistory } from './lesson';
import type { Lesson } from './lesson';

/** One lesson group (a sales-process step such as "Mời hẹn"). */
export interface LessonStage {
  readonly id: string;
  readonly title: string;
  /** Icon name for the stage card and the fallback lesson icon (story 037). */
  readonly icon?: string;
  /** One-line stage description under the title (story 037). */
  readonly description?: string;
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
    stages.push({
      id: entry.id,
      title: entry.title,
      ...(isNonEmptyString(entry.icon) ? { icon: entry.icon } : {}),
      ...(isNonEmptyString(entry.description) ? { description: entry.description } : {}),
    });
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

/**
 * The lesson the Học path suggests next (story 037): the first lesson never
 * learned, in stage order then lesson order. Null when every lesson has been
 * learned. Nothing is locked; this is only a hint.
 */
export function suggestedNextLesson(groups: readonly LessonGroup[], isLearned: (lessonId: string) => boolean): string | null {
  for (const group of groups) {
    for (const lesson of group.lessons) {
      if (!isLearned(lesson.id)) return lesson.id;
    }
  }
  return null;
}

/** Result of {@link nextLessonSuggestion}. */
export interface NextLessonSuggestion {
  /** The lesson to learn next, or null when every lesson has been learned. */
  readonly lesson: Lesson | null;
  /** 1-based position of its stage on the path (null with no lesson or for the "other" group). */
  readonly stagePosition: number | null;
  /** Title of its stage (null with no lesson or for the "other" group). */
  readonly stageTitle: string | null;
  /** Lessons learned at least once, out of `total`. */
  readonly learned: number;
  readonly total: number;
}

/**
 * The Hôm nay "Bài nên học tiếp" suggestion (story 039): the same lesson the
 * Học path marks "Học tiếp" ({@link suggestedNextLesson}), with its stage.
 */
export function nextLessonSuggestion(
  lessons: readonly Lesson[],
  stages: readonly LessonStage[],
  events: readonly LogEvent[],
): NextLessonSuggestion {
  const groups = groupLessonsByStage(lessons, stages);
  const learnedIds = new Set(lessons.filter((l) => lessonHistory(events, l.id).count > 0).map((l) => l.id));
  const id = suggestedNextLesson(groups, (lessonId) => learnedIds.has(lessonId));
  const learned = learnedIds.size;
  const total = lessons.length;
  if (id === null) return { lesson: null, stagePosition: null, stageTitle: null, learned, total };
  const groupIndex = groups.findIndex((g) => g.lessons.some((l) => l.id === id));
  const group = groups[groupIndex];
  const lesson = group?.lessons.find((l) => l.id === id) ?? null;
  const stage = group?.stage ?? null;
  return { lesson, stagePosition: stage === null ? null : groupIndex + 1, stageTitle: stage?.title ?? null, learned, total };
}
