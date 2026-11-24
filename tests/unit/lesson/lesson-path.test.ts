/**
 * Học path (story 037): the suggested next lesson and the optional icon /
 * description fields of the content file. Pure, no clock.
 */
import { describe, expect, it } from 'vitest';
import lessonsJson from '../../../src/content/lessons.json';
import { parseLessons } from '../../../src/domain/lesson';
import type { Lesson } from '../../../src/domain/lesson';
import { groupLessonsByStage, parseLessonStages, suggestedNextLesson } from '../../../src/domain/lesson-stages';
import { DEFAULT_LESSON_ICON, LESSON_ICONS, resolveLessonIcon } from '../../../src/ui/lesson-icons';

const Q = { prompt: 'Q', options: ['a', 'b'], correctIndex: 0, explanation: 'e' };
function lesson(id: string, stage: string): Lesson {
  return { id, title: id, xp: 10, stage, questions: [Q, Q, Q, Q, Q] };
}
const STAGES = [
  { id: 'start', title: 'Khởi đầu' },
  { id: 'list', title: 'Danh sách' },
];
const LESSONS = [lesson('b1', 'list'), lesson('a1', 'start'), lesson('a2', 'start'), lesson('b2', 'list')];
const GROUPS = groupLessonsByStage(LESSONS, STAGES);

describe('suggestedNextLesson', () => {
  it('suggests the first lesson of the first stage when nothing is learned', () => {
    expect(suggestedNextLesson(GROUPS, () => false)).toBe('a1');
  });

  it('follows stage order, then lesson order, skipping learned lessons', () => {
    const learned = new Set(['a1', 'a2']);
    expect(suggestedNextLesson(GROUPS, (id) => learned.has(id))).toBe('b1');
  });

  it('suggests an earlier gap before later unlearned lessons', () => {
    const learned = new Set(['a1', 'b1', 'b2']);
    expect(suggestedNextLesson(GROUPS, (id) => learned.has(id))).toBe('a2');
  });

  it('returns null when every lesson is learned', () => {
    expect(suggestedNextLesson(GROUPS, () => true)).toBeNull();
  });

  it('returns null when there are no lessons', () => {
    expect(suggestedNextLesson(groupLessonsByStage([], STAGES), () => false)).toBeNull();
  });
});

describe('optional icon and description', () => {
  it('keeps a stage icon and description when they are text', () => {
    const raw = { stages: [{ id: 's', title: 'S', icon: 'rocket', description: 'Mô tả' }] };
    expect(parseLessonStages(raw)).toEqual({ stages: [{ id: 's', title: 'S', icon: 'rocket', description: 'Mô tả' }], problems: [] });
  });

  it('drops a stage icon or description that is not text but keeps the stage', () => {
    const raw = { stages: [{ id: 's', title: 'S', icon: 5, description: '' }] };
    expect(parseLessonStages(raw).stages).toEqual([{ id: 's', title: 'S' }]);
  });

  it('keeps a lesson icon when it is text and drops it otherwise, keeping the lesson', () => {
    const result = parseLessons({ lessons: [{ ...lesson('ok', 'start'), icon: 'key' }, { ...lesson('bad', 'start'), icon: 42 }] });
    expect(result.problems).toEqual([]);
    expect(result.lessons.map((l) => l.icon)).toEqual(['key', undefined]);
    expect(result.lessons[1]).not.toHaveProperty('icon');
  });

  it('gives every stage in lessons.json an icon and a description', () => {
    for (const stage of parseLessonStages(lessonsJson).stages) {
      expect(stage.icon, stage.id).toBeTruthy();
      expect(stage.description, stage.id).toBeTruthy();
    }
  });
});

describe('resolveLessonIcon', () => {
  it('uses the lesson icon, then the stage icon, then the default', () => {
    expect(resolveLessonIcon('key', 'list')).toBe(LESSON_ICONS.key);
    expect(resolveLessonIcon('nope', 'list')).toBe(LESSON_ICONS.list);
    expect(resolveLessonIcon(undefined, undefined)).toBe(LESSON_ICONS[DEFAULT_LESSON_ICON]);
    expect(resolveLessonIcon('toString')).toBe(LESSON_ICONS[DEFAULT_LESSON_ICON]);
  });

  it('knows every icon named in lessons.json', () => {
    const names = [
      ...parseLessonStages(lessonsJson).stages.map((s) => s.icon),
      ...parseLessons(lessonsJson).lessons.map((l) => l.icon),
    ];
    for (const name of names) expect(Object.hasOwn(LESSON_ICONS, name ?? ''), String(name)).toBe(true);
  });
});
