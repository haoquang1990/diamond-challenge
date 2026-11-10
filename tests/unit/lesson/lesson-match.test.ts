/**
 * "Ghép cặp" match questions: validation, grading, per-pair result and the
 * pure link/unlink helper used by the screen. Deterministic, no clock.
 */
import { describe, expect, it } from 'vitest';
import {
  MAX_PAIRS,
  MIN_PAIRS,
  computeLessonResult,
  gradeAnswer,
  isMatchQuestion,
  matchPairResults,
  parseLessons,
  toggleMatchLink,
} from '../../../src/domain/lesson';
import type { Lesson, MatchQuestion } from '../../../src/domain/lesson';

const CHOICE = { prompt: 'Q', options: ['a', 'b'], correctIndex: 1, explanation: 'e' };
const MATCH: MatchQuestion = {
  type: 'match',
  prompt: 'Ghép',
  pairs: [
    { left: 'F', right: 'Gia đình' },
    { left: 'O', right: 'Công việc' },
    { left: 'R', right: 'Thời gian rảnh' },
  ],
  explanation: 'e',
};

function lessonWith(questions: readonly unknown[]): unknown {
  return { lessons: [{ id: 'x', title: 'T', xp: 10, questions }] };
}

function pairs(n: number): { left: string; right: string }[] {
  return Array.from({ length: n }, (_, i) => ({ left: `L${i}`, right: `R${i}` }));
}

describe('parseLessons with match questions', () => {
  it('accepts a lesson mixing choice and match questions', () => {
    const result = parseLessons(lessonWith([CHOICE, MATCH, CHOICE]));
    expect(result.problems).toEqual([]);
    expect(result.lessons[0]?.questions.filter(isMatchQuestion)).toHaveLength(1);
  });

  it('accepts exactly MIN_PAIRS and MAX_PAIRS pairs', () => {
    expect(parseLessons(lessonWith([CHOICE, CHOICE, { ...MATCH, pairs: pairs(MIN_PAIRS) }])).problems).toEqual([]);
    expect(parseLessons(lessonWith([CHOICE, CHOICE, { ...MATCH, pairs: pairs(MAX_PAIRS) }])).problems).toEqual([]);
  });

  it.each([
    ['too few pairs', { ...MATCH, pairs: pairs(MIN_PAIRS - 1) }],
    ['too many pairs', { ...MATCH, pairs: pairs(MAX_PAIRS + 1) }],
    ['an empty side', { ...MATCH, pairs: [{ left: 'a', right: ' ' }, ...pairs(2)] }],
    ['a pair that is not an object', { ...MATCH, pairs: ['a', ...pairs(2)] }],
    ['duplicate left items', { ...MATCH, pairs: [{ left: 'L0', right: 'x' }, ...pairs(2)] }],
    ['duplicate right items', { ...MATCH, pairs: [{ left: 'x', right: 'R0' }, ...pairs(2)] }],
    ['no pairs', { type: 'match', prompt: 'P', explanation: 'e' }],
  ])('skips a lesson whose match question has %s', (_label, bad) => {
    const result = parseLessons(lessonWith([CHOICE, CHOICE, bad]));
    expect(result.lessons).toEqual([]);
    expect(result.problems).toHaveLength(1);
  });
});

describe('gradeAnswer for match questions', () => {
  it('is right only when every left item is linked to its own pair', () => {
    expect(gradeAnswer(MATCH, [0, 1, 2])).toBe(true);
    expect(gradeAnswer(MATCH, [1, 0, 2])).toBe(false);
  });

  it('is wrong for an incomplete answer or a number answer', () => {
    expect(gradeAnswer(MATCH, [0, 1])).toBe(false);
    expect(gradeAnswer(MATCH, 0)).toBe(false);
  });
});

describe('matchPairResults', () => {
  it('marks each left item right when linked to its own pair', () => {
    expect(matchPairResults([0, 2, 1])).toEqual([true, false, false]);
  });
});

describe('computeLessonResult with a match question', () => {
  it('counts a match question as one right or wrong answer', () => {
    const lesson = { id: 'm', title: 'T', xp: 10, questions: [CHOICE, MATCH, MATCH] } as Lesson;
    expect(computeLessonResult(lesson, [1, [0, 1, 2], [2, 1, 0]])).toEqual({ correct: 2, total: 3 });
  });
});

describe('toggleMatchLink', () => {
  const empty = [null, null, null] as const;

  it('links a free left item to a free right item', () => {
    expect(toggleMatchLink(empty, 0, 2)).toEqual([2, null, null]);
  });

  it('moves a right item that was linked elsewhere to the new left item', () => {
    expect(toggleMatchLink([2, null, null], 1, 2)).toEqual([null, 2, null]);
  });

  it('replaces the link of a left item that already had one', () => {
    expect(toggleMatchLink([2, null, null], 0, 1)).toEqual([1, null, null]);
  });

  it('unlinks when the same pair is tapped again', () => {
    expect(toggleMatchLink([2, null, null], 0, 2)).toEqual([null, null, null]);
  });
});
