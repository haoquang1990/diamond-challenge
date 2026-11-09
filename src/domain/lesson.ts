/**
 * Lesson logic (Học, story-005): validation of `src/content/lessons.json` at
 * the data boundary, answer grading, scoring and the same-day XP rule.
 *
 * Pure and deterministic: the clock (`now`) and the IANA time zone are
 * parameters, nothing reads the real clock.
 *
 * Replay policy (chosen): a replay on the same local day STILL appends
 * `lesson_completed`, but with `xp: 0`. The log keeps a faithful history and
 * the lesson still counts as "Học" for the day; computeProgress adds 0 XP,
 * so totals are not inflated.
 */
import type { LogEvent } from '../data/event-store';

/** One multiple-choice question (the default when `type` is absent). */
export interface ChoiceQuestion {
  readonly type?: 'choice';
  readonly prompt: string;
  readonly options: readonly string[];
  /** Index into `options` of the right answer. */
  readonly correctIndex: number;
  /** Short explanation shown after answering. */
  readonly explanation: string;
}

/**
 * "Xếp đúng thứ tự" question: `steps` are written in the RIGHT order; the
 * screen shuffles them and the player taps them back into order.
 */
export interface OrderQuestion {
  readonly type: 'order';
  readonly prompt: string;
  /** Steps in their correct order (unique, non-empty). */
  readonly steps: readonly string[];
  /** Short explanation shown after checking. */
  readonly explanation: string;
}

/** Any lesson question. */
export type LessonQuestion = ChoiceQuestion | OrderQuestion;

/**
 * A player's answer: the chosen option index for a choice question, or, for
 * an order question, the original step indices in the order they were placed.
 */
export type LessonAnswer = number | readonly number[];

/** True when `question` is a "Xếp đúng thứ tự" question. */
export function isOrderQuestion(question: LessonQuestion): question is OrderQuestion {
  return question.type === 'order';
}

/** One lesson. */
export interface Lesson {
  /** Stable id written to `payload.lessonId`; never rename once used. */
  readonly id: string;
  readonly title: string;
  /** XP awarded for the first completion each local day. */
  readonly xp: number;
  readonly questions: readonly LessonQuestion[];
}

/** Result of {@link parseLessons}. */
export interface ParsedLessons {
  /** Valid lessons in file order. */
  readonly lessons: readonly Lesson[];
  /** Human-readable problems (Vietnamese-friendly summary + technical detail). */
  readonly problems: readonly string[];
}

/** Bounds of the question count and option count per the content schema. */
export const MIN_QUESTIONS = 3;
export const MAX_QUESTIONS = 5;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 4;
/** Bounds of the step count of an order question. */
export const MIN_STEPS = 3;
export const MAX_STEPS = 6;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/** Returns a problem description for an order question, or null when it is valid. */
function orderQuestionProblem(raw: Record<string, unknown>): string | null {
  const steps = raw.steps;
  if (!Array.isArray(steps) || steps.length < MIN_STEPS || steps.length > MAX_STEPS) {
    return `câu xếp thứ tự cần ${MIN_STEPS}–${MAX_STEPS} bước (steps)`;
  }
  if (!(steps as unknown[]).every(isNonEmptyString)) return 'bước (steps) bị trống';
  if (new Set(steps as string[]).size !== steps.length) return 'các bước (steps) bị trùng nhau';
  return null;
}

/** Returns a problem description for a question, or null when it is valid. */
function questionProblem(raw: unknown): string | null {
  if (!isRecord(raw)) return 'câu hỏi không hợp lệ';
  if (!isNonEmptyString(raw.prompt)) return 'câu hỏi thiếu nội dung (prompt)';
  if (!isNonEmptyString(raw.explanation)) return 'câu hỏi thiếu giải thích (explanation)';
  if (raw.type === 'order') return orderQuestionProblem(raw);
  if (raw.type !== undefined && raw.type !== 'choice') return `dạng câu hỏi "${String(raw.type)}" chưa được hỗ trợ`;
  const options = raw.options;
  if (!Array.isArray(options) || options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) {
    return `câu hỏi cần ${MIN_OPTIONS}–${MAX_OPTIONS} đáp án (options)`;
  }
  if (!(options as unknown[]).every(isNonEmptyString)) return 'đáp án (options) bị trống';
  const index = raw.correctIndex;
  if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= options.length) {
    return 'correctIndex nằm ngoài danh sách đáp án';
  }
  return null;
}

/**
 * Validates the raw JSON content. Never throws: a missing, empty or malformed
 * file yields no lessons and a problem; an invalid lesson is skipped and
 * reported, the valid ones are kept. Duplicate ids keep the first.
 *
 * @param raw Parsed contents of lessons.json (any shape).
 */
export function parseLessons(raw: unknown): ParsedLessons {
  const problems: string[] = [];
  if (!isRecord(raw) || !Array.isArray(raw.lessons)) {
    return { lessons: [], problems: ['File bài học bị thiếu hoặc sai định dạng (cần mục "lessons").'] };
  }
  const lessons: Lesson[] = [];
  const seen = new Set<string>();
  (raw.lessons as unknown[]).forEach((entry, position) => {
    const label = isRecord(entry) && isNonEmptyString(entry.id) ? `"${entry.id}"` : `#${position + 1}`;
    const fail = (reason: string): void => {
      problems.push(`Bài ${label} bị bỏ qua: ${reason}.`);
    };
    if (!isRecord(entry)) return fail('không phải một bài hợp lệ');
    if (!isNonEmptyString(entry.id)) return fail('thiếu id');
    if (seen.has(entry.id)) return fail('trùng id');
    if (!isNonEmptyString(entry.title)) return fail('thiếu tiêu đề (title)');
    if (typeof entry.xp !== 'number' || !Number.isFinite(entry.xp) || entry.xp < 0) return fail('xp không hợp lệ');
    const questions = entry.questions;
    if (!Array.isArray(questions) || questions.length < MIN_QUESTIONS || questions.length > MAX_QUESTIONS) {
      return fail(`cần ${MIN_QUESTIONS}–${MAX_QUESTIONS} câu hỏi`);
    }
    for (const q of questions as unknown[]) {
      const problem = questionProblem(q);
      if (problem !== null) return fail(problem);
    }
    seen.add(entry.id);
    lessons.push(entry as unknown as Lesson);
  });
  if (lessons.length === 0 && problems.length === 0) problems.push('File bài học đang trống.');
  return { lessons, problems };
}

/**
 * Per-slot result of an order answer: slot i is right when it holds the step
 * that belongs at position i.
 */
export function orderSlotResults(placed: readonly number[]): boolean[] {
  return placed.map((stepIndex, slot) => stepIndex === slot);
}

/**
 * True when `answer` is the question's right answer. A choice question needs
 * the right option index; an order question needs every step placed in its
 * original position. A mismatched answer shape is wrong.
 */
export function gradeAnswer(question: LessonQuestion, answer: LessonAnswer): boolean {
  if (isOrderQuestion(question)) {
    return Array.isArray(answer) && answer.length === question.steps.length && orderSlotResults(answer).every(Boolean);
  }
  return answer === question.correctIndex;
}

/**
 * Shuffled display order of `count` steps (Fisher-Yates with an injected
 * random source in [0, 1)). Never returns the solved order when count > 1:
 * that case is rotated by one so the player always has something to do.
 */
export function shuffledStepOrder(count: number, random: () => number): number[] {
  const order = Array.from({ length: count }, (_, i) => i);
  for (let i = count - 1; i > 0; i -= 1) {
    const j = Math.min(i, Math.floor(random() * (i + 1)));
    const tmp = order[i] as number;
    order[i] = order[j] as number;
    order[j] = tmp;
  }
  if (count > 1 && order.every((v, i) => v === i)) order.push(order.shift() as number);
  return order;
}

/** Score of a finished lesson. */
export interface LessonResult {
  readonly correct: number;
  readonly total: number;
}

/**
 * Computes the score from the answer per question (same order as the
 * lesson). A missing answer counts as wrong.
 */
export function computeLessonResult(lesson: Lesson, answers: readonly LessonAnswer[]): LessonResult {
  const correct = lesson.questions.filter((q, i) => {
    const answer = answers[i];
    return answer !== undefined && gradeAnswer(q, answer);
  }).length;
  return { correct, total: lesson.questions.length };
}

function localDayKey(formatter: Intl.DateTimeFormat, instant: Date): string {
  return formatter.format(instant);
}

/**
 * True when the lesson already earned XP on `now`'s local day: a
 * non-compensated `lesson_completed` for `lessonId` with xp > 0 and a
 * timestamp on the same local day in `timeZone`. Zero-XP replays do not
 * count, and a compensated completion (undone) does not block XP.
 */
export function isLessonCompletedToday(
  events: readonly LogEvent[],
  lessonId: string,
  now: Date,
  timeZone: string,
): boolean {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const today = localDayKey(formatter, now);
  const compensated = new Set<string>();
  for (const e of events) {
    const target = e.payload.compensates;
    if (typeof target === 'string') compensated.add(target);
  }
  return events.some(
    (e) =>
      e.type === 'lesson_completed' &&
      e.payload.lessonId === lessonId &&
      typeof e.payload.xp === 'number' &&
      e.payload.xp > 0 &&
      !compensated.has(e.id) &&
      typeof e.payload.compensates !== 'string' &&
      localDayKey(formatter, new Date(e.timestamp)) === today,
  );
}

/**
 * XP to award now for completing `lesson`: the lesson's XP the first time
 * today, 0 on a same-day repeat.
 */
export function xpForCompletion(
  lesson: Lesson,
  events: readonly LogEvent[],
  now: Date,
  timeZone: string,
): number {
  return isLessonCompletedToday(events, lesson.id, now, timeZone) ? 0 : lesson.xp;
}
