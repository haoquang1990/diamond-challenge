/**
 * "Xếp đúng thứ tự" order questions: validation, grading, per-slot result,
 * shuffling. Randomness is injected, so every test is deterministic.
 */
import { describe, expect, it } from 'vitest';
import {
  MAX_STEPS,
  MIN_STEPS,
  computeLessonResult,
  gradeAnswer,
  isOrderQuestion,
  orderSlotResults,
  parseLessons,
  shuffledStepOrder,
} from '../../../src/domain/lesson';
import type { Lesson, OrderQuestion } from '../../../src/domain/lesson';

const CHOICE = { prompt: 'Q', options: ['a', 'b'], correctIndex: 1, explanation: 'e' };
const ORDER: OrderQuestion = { type: 'order', prompt: 'Xếp', steps: ['một', 'hai', 'ba', 'bốn'], explanation: 'e' };

/** Deterministic random source cycling through the given values. */
function sequence(values: readonly number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length] ?? 0;
    i += 1;
    return v;
  };
}

function lessonWith(questions: readonly unknown[]): unknown {
  return { lessons: [{ id: 'x', title: 'T', xp: 10, questions }] };
}

describe('parseLessons with order questions', () => {
  it('accepts a lesson mixing choice and order questions', () => {
    const result = parseLessons(lessonWith([CHOICE, ORDER, CHOICE]));
    expect(result.problems).toEqual([]);
    expect(result.lessons[0]?.questions.filter(isOrderQuestion)).toHaveLength(1);
  });

  it('accepts exactly MIN_STEPS and MAX_STEPS steps', () => {
    const steps = (n: number) => Array.from({ length: n }, (_, i) => `b${i}`);
    expect(parseLessons(lessonWith([CHOICE, CHOICE, { ...ORDER, steps: steps(MIN_STEPS) }])).problems).toEqual([]);
    expect(parseLessons(lessonWith([CHOICE, CHOICE, { ...ORDER, steps: steps(MAX_STEPS) }])).problems).toEqual([]);
  });

  it.each([
    ['too few steps', { ...ORDER, steps: ['a', 'b'] }],
    ['too many steps', { ...ORDER, steps: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }],
    ['an empty step', { ...ORDER, steps: ['a', ' ', 'c'] }],
    ['duplicate steps', { ...ORDER, steps: ['a', 'a', 'c'] }],
    ['no steps', { type: 'order', prompt: 'P', explanation: 'e' }],
    ['no explanation', { type: 'order', prompt: 'P', steps: ['a', 'b', 'c'] }],
    ['an unknown type', { ...CHOICE, type: 'drag' }],
  ])('skips a lesson whose order question has %s', (_label, bad) => {
    const result = parseLessons(lessonWith([CHOICE, CHOICE, bad]));
    expect(result.lessons).toEqual([]);
    expect(result.problems).toHaveLength(1);
  });
});

describe('gradeAnswer for order questions', () => {
  it('is right only when every step is in its original position', () => {
    expect(gradeAnswer(ORDER, [0, 1, 2, 3])).toBe(true);
    expect(gradeAnswer(ORDER, [1, 0, 2, 3])).toBe(false);
  });

  it('is wrong for an incomplete placement or a number answer', () => {
    expect(gradeAnswer(ORDER, [0, 1, 2])).toBe(false);
    expect(gradeAnswer(ORDER, 0)).toBe(false);
  });

  it('keeps choice grading unchanged and rejects an array answer', () => {
    expect(gradeAnswer(CHOICE, 1)).toBe(true);
    expect(gradeAnswer(CHOICE, [1])).toBe(false);
  });
});

describe('orderSlotResults', () => {
  it('marks each slot right when it holds the step that belongs there', () => {
    expect(orderSlotResults([0, 2, 1, 3])).toEqual([true, false, false, true]);
  });
});

describe('computeLessonResult with mixed answers', () => {
  it('counts each order question as one right or wrong answer', () => {
    const lesson = { id: 'm', title: 'T', xp: 10, questions: [CHOICE, ORDER, ORDER] } as Lesson;
    expect(computeLessonResult(lesson, [1, [0, 1, 2, 3], [3, 2, 1, 0]])).toEqual({ correct: 2, total: 3 });
  });
});

describe('shuffledStepOrder', () => {
  it('returns a permutation of all step indices', () => {
    const order = shuffledStepOrder(5, sequence([0.7, 0.1, 0.4, 0.9]));
    expect([...order].sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it('never returns the already-solved order', () => {
    // random() = 0.999… makes Fisher-Yates swap each item with itself.
    const order = shuffledStepOrder(4, () => 0.9999);
    expect(order).not.toEqual([0, 1, 2, 3]);
    expect([...order].sort()).toEqual([0, 1, 2, 3]);
  });

  it('is deterministic for the same random source', () => {
    expect(shuffledStepOrder(6, sequence([0.3, 0.6]))).toEqual(shuffledStepOrder(6, sequence([0.3, 0.6])));
  });
});
