/** Story 069: reading my friendships and the invite link. Fixed data only. */
import { describe, expect, it } from 'vitest';
import { friendInviteUrl, parseFriendRows, readInviteToken, splitFriends } from '../../../src/data/friends-service';

const rows = [
  { friend_id: 'b', status: 'accepted', incoming: false, display_name: 'Chị Ngọc Thử', code: '7001111111', created_at: '2026-11-20T00:00:00Z' },
  { friend_id: 'c', status: 'pending', incoming: true, display_name: 'Chị Thu Thử', code: '7005556667', created_at: '2026-11-27T00:00:00Z' },
  { friend_id: 'd', status: 'pending', incoming: false, display_name: null, code: null, created_at: '2026-11-26T00:00:00Z' },
  { friend_id: 7, status: 'weird' },
];

describe('parseFriendRows', () => {
  it('keeps well-formed rows and drops the rest', () => {
    const list = parseFriendRows(rows);
    expect(list.map((f) => f.id)).toEqual(['b', 'c', 'd']);
    expect(list[0]).toEqual({ id: 'b', status: 'accepted', incoming: false, name: 'Chị Ngọc Thử', code: '7001111111', since: '2026-11-20T00:00:00Z' });
  });
});

describe('splitFriends', () => {
  it('sorts into invitations to answer, friends and requests I sent', () => {
    const s = splitFriends(parseFriendRows(rows));
    expect(s.invites.map((f) => f.id)).toEqual(['c']);
    expect(s.friends.map((f) => f.id)).toEqual(['b']);
    expect(s.sent.map((f) => f.id)).toEqual(['d']);
  });
});

describe('invite link', () => {
  it('builds the link with ?ban= and reads it back', () => {
    const url = friendInviteUrl('https://example.test/diamond-challenge/', 'abc123');
    expect(url).toBe('https://example.test/diamond-challenge/?ban=abc123');
    expect(readInviteToken('?ban=abc123')).toBe('abc123');
    expect(readInviteToken('?x=1')).toBeNull();
    expect(readInviteToken('?ban=../evil')).toBeNull();
  });
});
