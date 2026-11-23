// Regression (2026-11-23): an untouched "Ngày giờ" field is rounded down to the minute, so an
// activity done right after adding the person was dated before person_added and ignored by
// derivePeople (no NPP label, not marked done). An untouched field must use the real instant.
import { describe, expect, it } from 'vitest';
import { activityInstant } from '../../../src/ui/people-helpers';

const NOW = new Date('2026-11-23T04:38:45.500Z');

describe('activityInstant', () => {
  it('uses the real instant when the field was not changed', () => {
    expect(activityInstant('2026-11-23T11:38', '2026-11-23T11:38', NOW).toISOString()).toBe(NOW.toISOString());
  });

  it('uses the chosen local time when the field was changed', () => {
    const chosen = activityInstant('2026-11-21T09:30', '2026-11-23T11:38', NOW);
    expect(chosen.getTime()).toBe(new Date('2026-11-21T09:30').getTime());
  });
});
