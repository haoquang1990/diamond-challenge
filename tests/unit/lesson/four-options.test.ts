// 2026-11-28: every multiple-choice question has 4 different answers, and the right one is not always in the same place.
import { describe, expect, it } from 'vitest';
import lessons from '../../../src/content/lessons.json';

type Q = { readonly prompt: string; readonly options?: readonly string[]; readonly correctIndex?: number };
const choice = (lessons.lessons as { readonly id: string; readonly questions: readonly Q[] }[]).flatMap((l) => l.questions.filter((q) => q.options !== undefined).map((q) => ({ id: l.id, q })));

describe('multiple-choice questions', () => {
  it('have exactly 4 different answers', () => {
    const bad = choice.filter(({ q }) => q.options?.length !== 4 || new Set(q.options.map((o) => o.toLowerCase())).size !== 4);
    expect(bad.map(({ id, q }) => `${id}: ${q.prompt}`)).toEqual([]);
  });

  it('put the right answer in every position', () => {
    const at = new Set(choice.map(({ q }) => q.correctIndex));
    expect([...at].sort()).toEqual([0, 1, 2, 3]);
  });
});
