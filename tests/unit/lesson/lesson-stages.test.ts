/**
 * Lesson groups ("chia tab Học theo chặng"): parsing the stage list from the
 * content file and grouping lessons under it. Pure, no clock.
 */
import { describe, expect, it } from 'vitest';
import lessonsJson from '../../../src/content/lessons.json';
import { parseLessons } from '../../../src/domain/lesson';
import type { Lesson } from '../../../src/domain/lesson';
import { groupLessonsByStage, parseLessonStages } from '../../../src/domain/lesson-stages';

const Q = { prompt: 'Q', options: ['a', 'b'], correctIndex: 0, explanation: 'e' };
function lesson(id: string, stage?: string): Lesson {
  return { id, title: id, xp: 10, questions: [Q, Q, Q], ...(stage === undefined ? {} : { stage }) };
}
const STAGES = [
  { id: 'list', title: 'Danh sách' },
  { id: 'invite', title: 'Mời hẹn' },
  { id: 'care', title: 'Chăm sóc KH' },
];

describe('parseLessonStages', () => {
  it('keeps valid stages in file order', () => {
    expect(parseLessonStages({ stages: STAGES })).toEqual({ stages: STAGES, problems: [] });
  });

  it('returns no stages and no problem when the list is absent', () => {
    expect(parseLessonStages({ lessons: [] })).toEqual({ stages: [], problems: [] });
  });

  it.each([
    ['not an array', { stages: 'x' }, 0],
    ['an entry without title', { stages: [{ id: 'a' }, STAGES[0]] }, 1],
    ['a duplicate id', { stages: [STAGES[0], STAGES[0]] }, 1],
  ])('reports %s and keeps the valid entries', (_label, raw, kept) => {
    const result = parseLessonStages(raw);
    expect(result.stages).toHaveLength(kept);
    expect(result.problems).toHaveLength(1);
  });
});

describe('parseLessons stage field', () => {
  it('keeps a lesson with a stage and skips one whose stage is not text', () => {
    const raw = { lessons: [{ ...lesson('a'), stage: 'list' }, { ...lesson('b'), stage: 3 }] };
    const result = parseLessons(raw);
    expect(result.lessons.map((l) => l.stage)).toEqual(['list']);
    expect(result.problems).toHaveLength(1);
  });
});

describe('groupLessonsByStage', () => {
  it('lists every stage in order, including empty ones, with lessons in file order', () => {
    const groups = groupLessonsByStage([lesson('b', 'invite'), lesson('a', 'list'), lesson('c', 'invite')], STAGES);
    expect(groups.map((g) => [g.stage?.id ?? null, g.lessons.map((l) => l.id)])).toEqual([
      ['list', ['a']],
      ['invite', ['b', 'c']],
      ['care', []],
    ]);
  });

  it('puts lessons with no stage or an unknown stage in a final "other" group', () => {
    const groups = groupLessonsByStage([lesson('a', 'list'), lesson('x'), lesson('y', 'typo')], STAGES);
    const last = groups[groups.length - 1];
    expect(last?.stage).toBeNull();
    expect(last?.lessons.map((l) => l.id)).toEqual(['x', 'y']);
  });

  it('adds no "other" group when every lesson has a known stage', () => {
    const groups = groupLessonsByStage([lesson('a', 'list')], STAGES);
    expect(groups.every((g) => g.stage !== null)).toBe(true);
  });

  it('shows all lessons in one "other" group when there are no stages', () => {
    expect(groupLessonsByStage([lesson('a'), lesson('b', 'list')], [])).toEqual([
      { stage: null, lessons: [lesson('a'), lesson('b', 'list')] },
    ]);
  });
});

describe('lessons.json stages', () => {
  it('has a valid stage list and every lesson belongs to a known stage', () => {
    const { stages, problems } = parseLessonStages(lessonsJson);
    expect(problems).toEqual([]);
    const ids = new Set(stages.map((s) => s.id));
    for (const l of parseLessons(lessonsJson).lessons) expect(ids.has(l.stage ?? '')).toBe(true);
  });
});
