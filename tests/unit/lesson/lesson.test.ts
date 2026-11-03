/**
 * Lessons (story 005): content validation, grading, same-day XP rule.
 * Fixed instants only; clock and time zone are passed in.
 */
import { describe, expect, it, vi } from 'vitest';
import lessonsJson from '../../../src/content/lessons.json';
import type { LogEvent } from '../../../src/data/event-store';
import {
  computeLessonResult,
  gradeAnswer,
  isLessonCompletedToday,
  parseLessons,
  xpForCompletion,
} from '../../../src/domain/lesson';
import type { Lesson } from '../../../src/domain/lesson';
import { computeProgress } from '../../../src/domain/progress';

const VN = 'Asia/Ho_Chi_Minh';
const CONFIG = { dailyXpGoal: 30 };
const NOW = new Date('2026-11-03T05:00:00.000Z'); // 12:00 local
const TODAY_MORNING = '2026-11-03T01:00:00.000Z'; // 08:00 local
const YESTERDAY = '2026-11-02T05:00:00.000Z';
const JUST_BEFORE_MIDNIGHT_LOCAL = '2026-11-02T16:59:00.000Z'; // 23:59 on 2 Nov local

const QUESTION = { prompt: 'Q', options: ['a', 'b'], correctIndex: 1, explanation: 'e' };
const LESSON: Lesson = { id: 'l1', title: 'T', xp: 10, questions: [QUESTION, QUESTION, QUESTION] };

let counter = 0;
function lessonEvent(timestamp: string, xp: number, extra: Record<string, unknown> = {}, lessonId = 'l1'): LogEvent {
  counter += 1;
  return {
    id: `e${counter}`,
    type: 'lesson_completed',
    timestamp,
    userId: 'u',
    schemaVersion: 1,
    payload: { lessonId, xp, ...extra },
    syncedAt: null,
  };
}

describe('lessons.json content', () => {
  const parsed = parseLessons(lessonsJson);

  it('passes validation with no problems and at least 5 lessons', () => {
    expect(parsed.problems).toEqual([]);
    expect(parsed.lessons.length).toBeGreaterThanOrEqual(5);
  });

  it('has 3-5 questions per lesson with valid correctIndex and unique ids', () => {
    for (const lesson of parsed.lessons) {
      expect(lesson.questions.length).toBeGreaterThanOrEqual(3);
      expect(lesson.questions.length).toBeLessThanOrEqual(5);
      for (const q of lesson.questions) {
        expect(q.correctIndex).toBeGreaterThanOrEqual(0);
        expect(q.correctIndex).toBeLessThan(q.options.length);
      }
    }
    expect(new Set(parsed.lessons.map((l) => l.id)).size).toBe(parsed.lessons.length);
  });

  it('never uses the word Amway', () => {
    expect(JSON.stringify(lessonsJson).toLowerCase()).not.toContain('amway');
  });
});

describe('parseLessons error handling', () => {
  it.each([undefined, null, 42, 'text', [], {}, { lessons: 'x' }])('does not throw and returns an error for %j', (raw) => {
    const result = parseLessons(raw);
    expect(result.lessons).toEqual([]);
    expect(result.problems.length).toBeGreaterThan(0);
  });

  it('reports an empty file', () => {
    expect(parseLessons({ lessons: [] }).problems.length).toBeGreaterThan(0);
  });

  it('skips invalid lessons, keeps valid ones and reports them', () => {
    const badIndex = { ...LESSON, id: 'bad', questions: [QUESTION, QUESTION, { ...QUESTION, correctIndex: 5 }] };
    const missingTitle = { id: 'nt', xp: 10, questions: LESSON.questions };
    const tooFew = { ...LESSON, id: 'few', questions: [QUESTION] };
    const result = parseLessons({ lessons: [LESSON, badIndex, missingTitle, tooFew, null] });
    expect(result.lessons.map((l) => l.id)).toEqual(['l1']);
    expect(result.problems).toHaveLength(4);
  });
});

describe('grading', () => {
  it('grades right and wrong answers', () => {
    expect(gradeAnswer(QUESTION, 1)).toBe(true);
    expect(gradeAnswer(QUESTION, 0)).toBe(false);
  });

  it('computes the score; missing answers are wrong', () => {
    expect(computeLessonResult(LESSON, [1, 0, 1])).toEqual({ correct: 2, total: 3 });
    expect(computeLessonResult(LESSON, [1])).toEqual({ correct: 1, total: 3 });
  });
});

describe('same-day XP rule', () => {
  it('awards XP when there is no completion', () => {
    expect(xpForCompletion(LESSON, [], NOW, VN)).toBe(10);
  });

  it('awards no XP again for the same lesson on the same local day', () => {
    const events = [lessonEvent(TODAY_MORNING, 10)];
    expect(isLessonCompletedToday(events, 'l1', NOW, VN)).toBe(true);
    expect(xpForCompletion(LESSON, events, NOW, VN)).toBe(0);
  });

  it('awards XP for a different lesson on the same day', () => {
    const events = [lessonEvent(TODAY_MORNING, 10, {}, 'other')];
    expect(xpForCompletion(LESSON, events, NOW, VN)).toBe(10);
  });

  it('awards XP again on a different day, using local midnight', () => {
    expect(xpForCompletion(LESSON, [lessonEvent(YESTERDAY, 10)], NOW, VN)).toBe(10);
    expect(xpForCompletion(LESSON, [lessonEvent(JUST_BEFORE_MIDNIGHT_LOCAL, 10)], NOW, VN)).toBe(10);
  });

  it('a compensated completion does not block XP', () => {
    const original = lessonEvent(TODAY_MORNING, 10);
    const undo = lessonEvent(TODAY_MORNING, 0, { compensates: original.id });
    expect(xpForCompletion(LESSON, [original, undo], NOW, VN)).toBe(10);
  });

  it('computeProgress totals are not inflated by a zero-XP replay', () => {
    const first = lessonEvent(TODAY_MORNING, xpForCompletion(LESSON, [], NOW, VN));
    const replayXp = xpForCompletion(LESSON, [first], NOW, VN);
    const replay = lessonEvent('2026-11-03T04:00:00.000Z', replayXp);
    const progress = computeProgress([first, replay], NOW, CONFIG, VN);
    expect(replayXp).toBe(0);
    expect(progress.totalXp).toBe(10);
    expect(progress.xpToday).toBe(10);
    expect(progress.dailyGoal.hasLesson).toBe(true);
  });

  it('parse does not log or throw on bad input', () => {
    const spy = vi.spyOn(console, 'error');
    parseLessons({ lessons: [{ id: 1 }] });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
