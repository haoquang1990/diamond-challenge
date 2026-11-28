/**
 * Friends (story 069): requests by Amway code or invite link, answering them, and my list. Every
 * write goes through a server function; a request by code always answers "sent", so the app never
 * learns whether a code has an account.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/** One of my friendships, as the server lets me see it. */
export interface Friend {
  readonly id: string;
  readonly status: 'pending' | 'accepted';
  /** A request someone sent me (I answer it). */
  readonly incoming: boolean;
  /** Name and household code: null for a request I sent. */
  readonly name: string | null;
  readonly code: string | null;
  readonly since: string;
}

/** Rows of `my_friends()` as {@link Friend}s; malformed rows are dropped. Pure. */
export function parseFriendRows(raw: unknown): Friend[] {
  if (!Array.isArray(raw)) return [];
  const out: Friend[] = [];
  for (const r of raw as Record<string, unknown>[]) {
    if (typeof r !== 'object' || r === null || typeof r.friend_id !== 'string') continue;
    if (r.status !== 'pending' && r.status !== 'accepted') continue;
    out.push({
      id: r.friend_id,
      status: r.status,
      incoming: r.incoming === true,
      name: typeof r.display_name === 'string' && r.display_name.trim() !== '' ? r.display_name : null,
      code: typeof r.code === 'string' ? r.code : null,
      since: typeof r.created_at === 'string' ? r.created_at : '',
    });
  }
  return out;
}

/** Invitations to answer (newest first), friends (by name) and requests I sent. Pure. */
export function splitFriends(list: readonly Friend[]): { readonly invites: Friend[]; readonly friends: Friend[]; readonly sent: Friend[] } {
  const byNewest = (a: Friend, b: Friend) => (a.since < b.since ? 1 : a.since > b.since ? -1 : 0);
  return {
    invites: list.filter((f) => f.status === 'pending' && f.incoming).sort(byNewest),
    friends: list.filter((f) => f.status === 'accepted').sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'vi')),
    sent: list.filter((f) => f.status === 'pending' && !f.incoming).sort(byNewest),
  };
}

/** Query parameter of an invite link. */
export const INVITE_PARAM = 'ban';

/** My invite link: the app address with `?ban=<token>`. Pure. */
export function friendInviteUrl(appUrl: string, token: string): string {
  const url = new URL(appUrl);
  url.search = '';
  url.hash = '';
  url.searchParams.set(INVITE_PARAM, token);
  return url.toString();
}

/** The invite token in a `location.search`, or null when absent or malformed. Pure. */
export function readInviteToken(search: string): string | null {
  const token = new URLSearchParams(search).get(INVITE_PARAM);
  return token !== null && /^[0-9a-z]{1,64}$/.test(token) ? token : null;
}

/** Answer of a request. */
export type FriendRequestResult = 'sent' | 'invalid' | 'limit' | 'failed';

const asRequestResult = (data: unknown, error: unknown): FriendRequestResult =>
  error !== null && error !== undefined ? 'failed' : data === 'sent' || data === 'invalid' || data === 'limit' ? data : 'failed';

/** Sends a request to the household holding `code`. */
export async function requestFriendByCode(client: Pick<SupabaseClient, 'rpc'>, code: string): Promise<FriendRequestResult> {
  try {
    const { data, error } = await client.rpc('request_friend_by_code', { p_code: code });
    return asRequestResult(data, error);
  } catch {
    return 'failed';
  }
}

/** Sends a request to the owner of an invite link. */
export async function requestFriendByToken(client: Pick<SupabaseClient, 'rpc'>, token: string): Promise<FriendRequestResult> {
  try {
    const { data, error } = await client.rpc('request_friend_by_token', { p_token: token });
    return asRequestResult(data, error);
  } catch {
    return 'failed';
  }
}

/** My invite link token, or null when it cannot be read. */
export async function loadFriendToken(client: Pick<SupabaseClient, 'rpc'>): Promise<string | null> {
  try {
    const { data, error } = await client.rpc('my_friend_token');
    return error === null && typeof data === 'string' ? data : null;
  } catch {
    return null;
  }
}

/** My friendships, or null when they cannot be read (offline, older server). */
export async function loadFriends(client: Pick<SupabaseClient, 'rpc'>): Promise<Friend[] | null> {
  try {
    const { data, error } = await client.rpc('my_friends');
    return error === null ? parseFriendRows(data) : null;
  } catch {
    return null;
  }
}

/** Accepts or declines a request; 'ok' | 'not_found' | 'limit' | 'failed'. */
export async function respondFriend(client: Pick<SupabaseClient, 'rpc'>, otherId: string, accept: boolean): Promise<'ok' | 'not_found' | 'limit' | 'failed'> {
  try {
    const { data, error } = await client.rpc('respond_friend', { p_other: otherId, p_accept: accept });
    return error === null && (data === 'ok' || data === 'not_found' || data === 'limit') ? data : 'failed';
  } catch {
    return 'failed';
  }
}

/** Ends a friendship or withdraws my request. */
export async function removeFriend(client: Pick<SupabaseClient, 'rpc'>, otherId: string): Promise<boolean> {
  try {
    const { data, error } = await client.rpc('remove_friend', { p_other: otherId });
    return error === null && (data === 'ok' || data === 'not_found');
  } catch {
    return false;
  }
}
