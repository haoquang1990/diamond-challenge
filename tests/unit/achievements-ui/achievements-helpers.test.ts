import { describe, expect, it, vi } from 'vitest';
import type { EventStore, LogEvent } from '../../../src/data/event-store';
import { createObservedStore, readSoundEnabled, toastNameFor } from '../../../src/ui/achievements-helpers';

function ev(id: string, type: LogEvent['type'], payload: Record<string, unknown>): LogEvent {
  return { id, type, timestamp: '2026-03-10T08:00:00.000Z', userId: 'u', schemaVersion: 1, payload, syncedAt: null };
}
const TASKS = [{ id: 'demo', name: 'Demo sản phẩm' }];
const TYPES = [{ id: 'add_name', name: 'Thêm tên vào danh sách' }];

describe('toastNameFor', () => {
  it('maps task, legacy activity, lesson and fallback', () => {
    expect(toastNameFor(ev('1', 'activity_logged', { taskId: 'demo', activityType: 'demo' }), TASKS, TYPES)).toBe('Demo sản phẩm');
    expect(toastNameFor(ev('2', 'activity_logged', { activityType: 'add_name' }), TASKS, TYPES)).toBe('Thêm tên vào danh sách');
    expect(toastNameFor(ev('3', 'activity_logged', { activityType: 'zzz' }), TASKS, TYPES)).toBe('Hoạt động');
    expect(toastNameFor(ev('4', 'lesson_completed', {}), TASKS, TYPES)).toBe('Bài Học');
    expect(toastNameFor(ev('5', 'person_stage_changed', {}), TASKS, TYPES)).toBe('Hoạt động');
  });
});

describe('readSoundEnabled', () => {
  it('uses the fallback, then the latest non-compensated choice', () => {
    expect(readSoundEnabled([], true)).toBe(true);
    const off = ev('a', 'settings_changed', { sound: { enabled: false } });
    const on = ev('b', 'settings_changed', { sound: { enabled: true } });
    expect(readSoundEnabled([off], true)).toBe(false);
    expect(readSoundEnabled([off, on], false)).toBe(true);
    expect(readSoundEnabled([off, ev('c', 'settings_changed', { compensates: 'a' })], true)).toBe(true);
  });
});

describe('createObservedStore', () => {
  it('notifies after append only, not after importEvents', async () => {
    const saved = ev('x', 'lesson_completed', { xp: 10 });
    const inner: EventStore = {
      getUserId: async () => 'u',
      append: async () => saved,
      list: async () => [],
      importEvents: async () => ({ added: 0, skipped: 0 }),
    };
    const { store, subscribe } = createObservedStore(inner);
    const listener = vi.fn();
    const off = subscribe(listener);
    await store.importEvents([]);
    expect(listener).not.toHaveBeenCalled();
    await store.append({ type: 'lesson_completed', payload: {} });
    expect(listener).toHaveBeenCalledWith(saved);
    off();
    await store.append({ type: 'lesson_completed', payload: {} });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
