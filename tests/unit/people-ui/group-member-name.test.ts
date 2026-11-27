// Story 059: a member is shown by the name I saved for that account in my own Danh bạ, else by
// the display name they set, else by phone.
import { describe, expect, it } from 'vitest';
import { groupMemberName, linkedContactNames } from '../../../src/ui/group-helpers';
import type { Person } from '../../../src/domain/people';

const member = (displayName: string | null, phone: string | null) => ({ userId: 'u1', displayName, phone });
const NAMES = new Map([['u1', 'Anh Bình Thử']]);

describe('groupMemberName', () => {
  it('prefers the name I saved for that account in my Danh bạ (story 059)', () => {
    expect(groupMemberName(member('Phái', '+84900000444'), NAMES)).toBe('Anh Bình Thử');
  });

  it('falls back to the display name the member set', () => {
    expect(groupMemberName(member('Phái', '+84900000444'), new Map())).toBe('Phái');
  });

  it('falls back to the phone, then a placeholder', () => {
    expect(groupMemberName(member(null, '+84900000444'), new Map())).toBe('+84 900 000 444');
    expect(groupMemberName(member(null, null), new Map())).toBe('Chưa có tên');
  });
});

describe('linkedContactNames', () => {
  it('maps linked account ids to my contact names, skipping unlinked people (an archived contact is still that person)', () => {
    const people = [
      { personId: 'a', name: 'Anh Bình Thử', linkedUserId: 'u1', archived: false },
      { personId: 'b', name: 'Khách', linkedUserId: null, archived: false },
      { personId: 'c', name: 'Cũ', linkedUserId: 'u2', archived: true },
    ] as unknown as Person[];
    expect([...linkedContactNames(people)]).toEqual([['u1', 'Anh Bình Thử'], ['u2', 'Cũ']]);
  });
});
