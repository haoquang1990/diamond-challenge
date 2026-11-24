/**
 * Hôm nay "Bài nên học tiếp" (story 039): the suggested lesson with its stage. Pure.
 */
import { describe, expect, it } from 'vitest';
import type { LogEvent } from '../../../src/data/event-store';
import type { Lesson } from '../../../src/domain/lesson';
import { nextLessonSuggestion } from '../../../src/domain/lesson-stages';

const Q = { prompt: 'Q', options: ['a', 'b'], correctIndex: 0, explanation: 'e' };
const lesson = (id: string, stage: string): Lesson => ({ id, title: `T-${id}`, xp: 10, stage, questions: [Q, Q, Q, Q, Q] });
const STAGES = [
  { id: 's1', title: 'Một' },
  { id: 's2', title: 'Hai' },
];
const LESSONS = [lesson('a', 's1'), lesson('b', 's1'), lesson('c', 's2')];
let n = 0;
const done = (lessonId: string): LogEvent => ({
  id: `e${++n}`,
  type: 'lesson_completed',
  timestamp: '2026-11-20T01:00:00.000Z',
  userId: 'u',
  schemaVersion: 1,
  payload: { lessonId, xp: 10 },
  syncedAt: null,
});

describe('nextLessonSuggestion', () => {
  it('suggests the first lesson of stage 1 when nothing is learned', () => {
    expect(nextLessonSuggestion(LESSONS, STAGES, [])).toEqual({ lesson: LESSONS[0], stagePosition: 1, stageTitle: 'Một', learned: 0, total: 3 });
  });

  it('moves to the next stage once a stage is learned', () => {
    const s = nextLessonSuggestion(LESSONS, STAGES, [done('a'), done('b')]);
    expect(s?.lesson?.id).toBe('c');
    expect(s?.stagePosition).toBe(2);
    expect(s?.stageTitle).toBe('Hai');
    expect(s?.learned).toBe(2);
  });

  it('returns no lesson when every lesson is learned', () => {
    expect(nextLessonSuggestion(LESSONS, STAGES, [done('a'), done('b'), done('c')])).toEqual({ lesson: null, stagePosition: null, stageTitle: null, learned: 3, total: 3 });
  });

  it('ignores a completion that was undone', () => {
    const first = done('a');
    const undo: LogEvent = { ...done('a'), payload: { lessonId: 'a', xp: 0, compensates: first.id } };
    expect(nextLessonSuggestion(LESSONS, STAGES, [first, undo])?.lesson?.id).toBe('a');
  });
});
