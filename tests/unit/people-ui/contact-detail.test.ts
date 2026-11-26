// Story 051: the contact page's summary (days since, counts without "Thêm tên") and note autosave.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { calendarDaysSince, createNoteAutosave, summaryCounts } from '../../../src/ui/people-helpers';

describe('calendarDaysSince', () => {
  it('counts local calendar days, 0 for today, null without a date', () => {
    const now = new Date(2026, 10, 26, 9, 0);
    expect(calendarDaysSince(new Date(2026, 10, 26, 0, 5).toISOString(), now)).toBe(0);
    expect(calendarDaysSince(new Date(2026, 10, 25, 23, 50).toISOString(), now)).toBe(1);
    expect(calendarDaysSince(new Date(2026, 10, 2, 12, 0).toISOString(), now)).toBe(24);
    expect(calendarDaysSince(null, now)).toBeNull();
  });

  it('never goes negative for a time later today or in the future', () => {
    const now = new Date(2026, 10, 26, 9, 0);
    expect(calendarDaysSince(new Date(2026, 10, 27, 9, 0).toISOString(), now)).toBe(0);
  });
});

describe('summaryCounts', () => {
  it('drops "Thêm tên" and keeps the order', () => {
    const counts = [
      { id: 'add_name', name: 'Thêm tên vào danh sách', count: 1 },
      { id: 'expo', name: 'Expo/Hội thảo', count: 1 },
      { id: 'demo', name: 'Demo', count: 2 },
    ];
    expect(summaryCounts(counts).map((c) => c.id)).toEqual(['expo', 'demo']);
  });
});

describe('createNoteAutosave', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('saves once after the quiet time, with the latest text trimmed', async () => {
    const save = vi.fn(async () => undefined);
    const a = createNoteAutosave({ saved: 'cũ', delayMs: 1000, save });
    a.change('m');
    a.change('mới ');
    await vi.advanceTimersByTimeAsync(999);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('mới');
  });

  it('does not save text equal to what is stored (spaces aside)', async () => {
    const save = vi.fn(async () => undefined);
    const a = createNoteAutosave({ saved: 'giữ', delayMs: 1000, save });
    a.change('giữ  ');
    await vi.advanceTimersByTimeAsync(2000);
    await a.flush();
    expect(save).not.toHaveBeenCalled();
  });

  it('flush saves now and cancels the timer', async () => {
    const save = vi.fn(async () => undefined);
    const a = createNoteAutosave({ saved: '', delayMs: 1000, save });
    a.change('ghi chú');
    await a.flush();
    expect(save).toHaveBeenCalledWith('ghi chú');
    await vi.advanceTimersByTimeAsync(2000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('reports the state and keeps the text for a retry after a failure', async () => {
    const states: string[] = [];
    const save = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const a = createNoteAutosave({ saved: '', delayMs: 1000, save, onState: (s) => states.push(s) });
    a.change('x');
    await a.flush();
    expect(states).toEqual(['pending', 'saving', 'error']);
    await a.flush();
    expect(save).toHaveBeenCalledTimes(2);
    expect(states.at(-1)).toBe('saved');
  });
});
