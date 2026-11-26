/**
 * Story 034: activity time validation, activity note, config limits.
 * Fixed instants only: no clock, no randomness.
 */
import { describe, expect, it } from 'vitest';
import gameConfig from '../../../src/config/game-config.json';
import { buildTaskCompletionEvent, parseActivityLimits, parsePeopleConfig, validateActivityTime } from '../../../src/domain/people';
import type { Person } from '../../../src/domain/people';

const CONFIG = parsePeopleConfig(gameConfig);
const NOW = new Date('2026-11-21T10:00:00.000Z');
const MINUTE = 60_000;
const DAY = 86_400_000;
const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs);

const PERSON: Person = { personId: 'p', name: 'P', note: '', archived: false, stageId: 'a', stageXpAwarded: [] };

describe('validateActivityTime', () => {
  it('now is ok', () => {
    expect(validateActivityTime(NOW, NOW, 7)).toBe('ok');
  });
  it('exactly backdateDays days back is ok', () => {
    expect(validateActivityTime(at(-7 * DAY), NOW, 7)).toBe('ok');
  });
  it('backdateDays days plus one minute back is too_old', () => {
    expect(validateActivityTime(at(-7 * DAY - MINUTE), NOW, 7)).toBe('too_old');
  });
  it('one minute in the future is future', () => {
    expect(validateActivityTime(at(MINUTE), NOW, 7)).toBe('future');
  });
  it('two days back is ok', () => {
    expect(validateActivityTime(at(-2 * DAY), NOW, 7)).toBe('ok');
  });
  it('backdateDays 0 allows only now', () => {
    expect(validateActivityTime(at(-MINUTE), NOW, 0)).toBe('too_old');
    expect(validateActivityTime(NOW, NOW, 0)).toBe('ok');
  });
  it('an unparseable date is invalid', () => {
    expect(validateActivityTime(new Date('not a date'), NOW, 7)).toBe('invalid');
  });
});

describe('buildTaskCompletionEvent note', () => {
  const ts = '2026-11-19T08:00:00.000Z';
  it('writes the trimmed note and the chosen timestamp', () => {
    const r = buildTaskCompletionEvent(PERSON, 'demo', CONFIG, ts, '  gặp ở quán  ');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.event.timestamp).toBe(ts);
      expect(r.event.payload.note).toBe('gặp ở quán');
      expect(r.event.payload.taskId).toBe('demo');
    }
  });
  it('omits payload.note when empty or blank', () => {
    for (const note of [undefined, '', '   ']) {
      const r = buildTaskCompletionEvent(PERSON, 'demo', CONFIG, ts, note);
      expect(r.ok && 'note' in r.event.payload).toBe(false);
    }
  });
});

describe('parseActivityLimits', () => {
  it('game-config has no backdate limit (2026-11-26) and 500 characters', () => {
    expect(CONFIG.activityBackdateDays).toBe(Infinity);
    expect(CONFIG.activityNoteMaxLength).toBe(500);
  });
  it('null means no backdate limit: years back are ok, the future is still refused', () => {
    expect(parseActivityLimits(null, 500)).toEqual({ activityBackdateDays: Infinity, activityNoteMaxLength: 500, problems: [] });
    const now = new Date('2026-11-26T05:00:00.000Z');
    expect(validateActivityTime(new Date('2021-01-01T00:00:00.000Z'), now, Infinity)).toBe('ok');
    expect(validateActivityTime(new Date('2026-11-26T05:01:00.000Z'), now, Infinity)).toBe('future');
  });
  it('out of range values fall back and are reported', () => {
    const r = parseActivityLimits(31, 10);
    expect(r.activityBackdateDays).toBe(7);
    expect(r.activityNoteMaxLength).toBe(500);
    expect(r.problems).toHaveLength(2);
  });
});
