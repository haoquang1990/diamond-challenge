// Chi tiết NPP "Hộ F1" (story 042): which F1 household a contact stands for, and its totals.
import { describe, expect, it } from 'vitest';
import type { GroupHousehold } from '../../../src/data/group-service';
import { f1TotalsLabel, findF1Household } from '../../../src/ui/group-helpers';

const house = (id: string, code: string | null): GroupHousehold =>
  ({ householdId: id, code, members: [], memberCount: 1, lastActivityAt: null, numbers: null, cheeredToday: false }) as unknown as GroupHousehold;
const LIST = [house('h1', '1111111111'), house('h2', null), house('h3', '2222222222')];

describe('findF1Household', () => {
  it('matches the contact code to the household code', () => {
    expect(findF1Household(LIST, '2222222222')?.householdId).toBe('h3');
  });

  it('is null without a code or without a match', () => {
    expect(findF1Household(LIST, null)).toBeNull();
    expect(findF1Household(LIST, '')).toBeNull();
    expect(findF1Household(LIST, '9999999999')).toBeNull();
  });
});

describe('f1TotalsLabel', () => {
  it('shows totals with no /30 target', () => {
    expect(f1TotalsLabel(12, 3)).toBe('KH 12 · NPP 3');
  });
});
