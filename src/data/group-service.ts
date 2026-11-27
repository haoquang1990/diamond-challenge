import type { SupabaseClient } from '@supabase/supabase-js';

/** Validated "Nhóm của tôi" settings from `game-config.json`. */
export interface GroupConfig {
  /** A household with no activity for this many whole days (or never) is flagged. */
  readonly inactiveDays: number;
  /** Cheers one F1 household may receive per day from its sponsor (the server enforces it). */
  readonly cheersPerDay: number;
  /** Encouragement lines; one is picked at random per cheer. */
  readonly cheerMessages: readonly string[];
}

const DEFAULT_INACTIVE_DAYS = 3;
const DEFAULT_CHEERS_PER_DAY = 1;

/**
 * Validates the group settings at the config boundary: a bad `inactiveDays` (1-14) or
 * `cheersPerDay` (1-3) falls back to the GDD default with a console warning; blank or
 * non-string cheer messages are dropped (an empty list disables sending).
 */
export function parseGroupConfig(raw: { readonly inactiveDays?: unknown; readonly cheersPerDay?: unknown; readonly cheerMessages?: unknown }): GroupConfig {
  const intIn = (v: unknown, min: number, max: number, fallback: number, name: string): number => {
    if (typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max) return v;
    console.warn(`[group] config ${name} must be an integer ${min}-${max}; using ${fallback}`);
    return fallback;
  };
  const messages = Array.isArray(raw.cheerMessages)
    ? raw.cheerMessages.filter((m): m is string => typeof m === 'string' && m.trim() !== '').map((m) => m.trim())
    : [];
  if (messages.length === 0) console.warn('[group] config cheerMessages has no usable line; cheering is disabled');
  return {
    inactiveDays: intIn(raw.inactiveDays, 1, 14, DEFAULT_INACTIVE_DAYS, 'inactiveDays'),
    cheersPerDay: intIn(raw.cheersPerDay, 1, 3, DEFAULT_CHEERS_PER_DAY, 'cheersPerDay'),
    cheerMessages: messages,
  };
}

/** Picks one cheer message; `random` is injectable for tests. Null when the list is empty. */
export function pickCheerMessage(messages: readonly string[], random: () => number = Math.random): string | null {
  if (messages.length === 0) return null;
  return messages[Math.min(messages.length - 1, Math.floor(random() * messages.length))] ?? null;
}

/** How active an F1 household is, from the server-stamped `last_activity_at`. */
export type ActivityStatus =
  | { readonly kind: 'active' }
  | { readonly kind: 'inactive'; readonly days: number }
  | { readonly kind: 'never' };

/**
 * Whole days since `lastActivityAt` against `inactiveDays`: `never` without a timestamp,
 * `inactive` with the day count once it reaches `inactiveDays`, else `active`.
 */
export function activityStatus(lastActivityAt: string | null, now: Date, inactiveDays: number): ActivityStatus {
  if (lastActivityAt === null) return { kind: 'never' };
  const days = Math.floor((now.getTime() - new Date(lastActivityAt).getTime()) / 86_400_000);
  return days >= inactiveDays ? { kind: 'inactive', days: Math.max(days, inactiveDays) } : { kind: 'active' };
}

/** A person in an F1 household (display name, else phone). Never contact-book data. */
export interface GroupMember {
  readonly userId: string;
  readonly displayName: string | null;
  readonly phone: string | null;
  /** Shared progress numbers (story 044); null or absent when the member's app never sent them. */
  readonly progress?: MemberProgress | null;
  /** Whether the account changed its first password (story 050); absent when unknown. */
  readonly activated?: boolean;
}

/** One member's shared progress (`member_progress`, story 044). */
export interface MemberProgress {
  readonly xpTotal: number;
  readonly xp7d: number;
  readonly streak: number;
  readonly updatedAt: string;
  /** Story 050 (absent before that migration or on an old app): local day the numbers are for. */
  readonly statsDay?: string | null;
  readonly goalToday?: boolean;
  /** Today's XP goal the member picked (story 056), when sent. */
  readonly goalXp?: number;
  readonly activeDays7d?: number;
  readonly tasks7d?: Readonly<Record<string, number>>;
  readonly lessonsDistinct?: number;
  readonly lastLessonAt?: string | null;
  readonly badges7d?: number;
  readonly lastSeenAt?: string | null;
}

/** Synced 30x30 numbers of one household. */
export interface GroupNumbers {
  readonly customers: number;
  readonly f1: number;
  readonly achieved30x30: boolean;
  readonly updatedAt: string;
}

const PROGRESS_COLUMNS = 'user_id, xp_total, xp_7d, streak, updated_at';
const INSIGHT_COLUMNS_050 = 'stats_day, goal_today, active_days_7d, tasks_7d, lessons_distinct, last_lesson_at, badges_7d, last_seen_at';
const INSIGHT_COLUMNS = `${INSIGHT_COLUMNS_050}, goal_xp`;

interface ProgressRow {
  user_id: string;
  xp_total: number;
  xp_7d: number;
  streak: number;
  updated_at: string;
  stats_day?: string | null;
  goal_today?: boolean;
  goal_xp?: number | null;
  active_days_7d?: number;
  tasks_7d?: Record<string, number> | null;
  lessons_distinct?: number;
  last_lesson_at?: string | null;
  badges_7d?: number;
  last_seen_at?: string | null;
}

function toMemberProgress(r: ProgressRow): MemberProgress {
  const base = { xpTotal: r.xp_total, xp7d: r.xp_7d, streak: r.streak, updatedAt: r.updated_at };
  if (r.stats_day === undefined) return base;
  return {
    ...base,
    statsDay: r.stats_day,
    goalToday: r.goal_today === true,
    ...(typeof r.goal_xp === 'number' ? { goalXp: r.goal_xp } : {}),
    activeDays7d: r.active_days_7d ?? 0,
    tasks7d: r.tasks_7d ?? {},
    lessonsDistinct: r.lessons_distinct ?? 0,
    lastLessonAt: r.last_lesson_at ?? null,
    badges7d: r.badges_7d ?? 0,
    lastSeenAt: r.last_seen_at ?? null,
  };
}

/** One direct F1 household as listed on "Nhóm của tôi". */
export interface GroupHousehold {
  readonly householdId: string;
  readonly members: readonly GroupMember[];
  readonly memberCount: number;
  /** Active Amway code, or null. */
  readonly code: string | null;
  /** Null = "Chưa có số liệu" (no row, or the row was never written by the household's app). */
  readonly numbers: GroupNumbers | null;
  readonly lastActivityAt: string | null;
  /** True when my household already sent `cheersPerDay` cheers to it today (UTC day). */
  readonly cheeredToday: boolean;
}

/** What {@link loadGroup} returns; also what is cached for offline use. */
export interface GroupData {
  readonly myHouseholdId: string | null;
  /** Member limit from `app_config.max_household_members`. */
  readonly maxMembers: number;
  readonly households: readonly GroupHousehold[];
  /** The other members of my own NPP (my spouse), for spouse cheers (story 049); absent in old caches. */
  readonly spouses?: readonly SpouseMember[];
  /** ISO time of the load. */
  readonly loadedAt: string;
}

/** Another member of my own NPP (story 049). */
export interface SpouseMember extends GroupMember {
  /** True when I already sent `cheersPerDay` cheers to this member today (UTC day). */
  readonly cheeredToday: boolean;
}

/** UTC calendar date `YYYY-MM-DD`: the day boundary of the server's `cheers.cheer_day`. */
export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Reads the caller's direct F1 households (`sponsor_household_id` = my household, status active),
 * their members, active codes, synced numbers, `last_activity_at` and today's cheers. It never
 * reads `contact_events` or contact names. Any read error gives `null`.
 *
 * @example
 * const group = await loadGroup(client, accountId, 2, config.cheersPerDay);
 */
export async function loadGroup(
  client: SupabaseClient,
  accountId: string,
  fallbackMaxMembers: number,
  cheersPerDay: number,
  now: Date = new Date(),
): Promise<GroupData | null> {
  const own = await client.from('household_members').select('household_id').eq('user_id', accountId).is('left_at', null).maybeSingle();
  if (own.error) return null;
  const maxRow = await client.from('app_config').select('value').eq('key', 'max_household_members').maybeSingle();
  const value = (maxRow.data as { value?: unknown } | null)?.value;
  const maxMembers = !maxRow.error && typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallbackMaxMembers;
  const mine = (own.data as { household_id?: string } | null)?.household_id ?? null;
  const loadedAt = now.toISOString();
  if (mine === null) return { myHouseholdId: null, maxMembers, households: [], loadedAt };
  const spouses = await loadSpouses(client, mine, accountId, cheersPerDay, now);

  const f1 = await client.from('households').select('id, last_activity_at').eq('sponsor_household_id', mine).eq('status', 'active');
  if (f1.error) return null;
  const rows = (f1.data ?? []) as { id: string; last_activity_at: string | null }[];
  if (rows.length === 0) return { myHouseholdId: mine, maxMembers, households: [], spouses, loadedAt };
  const ids = rows.map((r) => r.id);

  const [memberRows, codeRows, numberRows, cheerRows] = await Promise.all([
    client.from('household_members').select('household_id, user_id').in('household_id', ids).is('left_at', null),
    client.from('household_codes').select('household_id, code').in('household_id', ids).eq('status', 'active'),
    client.from('household_aggregates').select('household_id, customers, f1, achieved_30x30, updated_at, updated_by').in('household_id', ids),
    client.from('cheers').select('to_household_id').eq('from_household_id', mine).eq('cheer_day', utcDay(now)).in('to_household_id', ids),
  ]);
  if (memberRows.error || codeRows.error || numberRows.error || cheerRows.error) return null;
  const members = (memberRows.data ?? []) as { household_id: string; user_id: string }[];
  const userIds = members.map((m) => m.user_id);
  let profiles: { id: string; phone: string | null; display_name: string | null }[] = [];
  let progressRows: ProgressRow[] = [];
  let activation: { user_id: string; activated: boolean }[] = [];
  if (userIds.length > 0) {
    const [p, mp, act] = await Promise.all([
      client.from('profiles').select('id, phone, display_name').in('id', userIds),
      client.from('member_progress').select(`${PROGRESS_COLUMNS}, ${INSIGHT_COLUMNS}`).in('user_id', userIds),
      client.rpc('f1_member_activation', { p_user_ids: userIds }),
    ]);
    if (p.error) return null;
    profiles = (p.data ?? []) as typeof profiles;
    if (!mp.error) progressRows = (mp.data ?? []) as ProgressRow[];
    else {
      // A server before story 056 has no goal_xp.
      const mid = await client.from('member_progress').select(`${PROGRESS_COLUMNS}, ${INSIGHT_COLUMNS_050}`).in('user_id', userIds);
      if (!mid.error) progressRows = (mid.data ?? []) as ProgressRow[];
    }
    if (progressRows.length === 0 && mp.error) {
      // Optional: a server before story 050 has only the story 044 columns, before 044 none.
      const old = await client.from('member_progress').select(PROGRESS_COLUMNS).in('user_id', userIds);
      if (!old.error) progressRows = (old.data ?? []) as ProgressRow[];
    }
    if (!act.error && Array.isArray(act.data)) activation = act.data as typeof activation;
  }
  const codes = (codeRows.data ?? []) as { household_id: string; code: string }[];
  const numbers = (numberRows.data ?? []) as {
    household_id: string; customers: number; f1: number; achieved_30x30: boolean; updated_at: string; updated_by: string | null;
  }[];
  const cheers = (cheerRows.data ?? []) as { to_household_id: string }[];

  const households = rows.map((r): GroupHousehold => {
    const mine = members.filter((m) => m.household_id === r.id);
    const n = numbers.find((x) => x.household_id === r.id);
    return {
      householdId: r.id,
      members: mine.map((m) => {
        const p = profiles.find((x) => x.id === m.user_id);
        const mp = progressRows.find((x) => x.user_id === m.user_id);
        const act = activation.find((x) => x.user_id === m.user_id);
        return {
          userId: m.user_id,
          displayName: p?.display_name ?? null,
          phone: p?.phone ?? null,
          progress: mp === undefined ? null : toMemberProgress(mp),
          ...(act === undefined ? {} : { activated: act.activated }),
        };
      }),
      memberCount: mine.length,
      code: codes.find((c) => c.household_id === r.id)?.code ?? null,
      // provisioning inserts a zero row with no `updated_by`; only the household's own app sets it
      numbers:
        n === undefined || n.updated_by === null
          ? null
          : { customers: n.customers, f1: n.f1, achieved30x30: n.achieved_30x30, updatedAt: n.updated_at },
      lastActivityAt: r.last_activity_at,
      cheeredToday: cheers.filter((c) => c.to_household_id === r.id).length >= cheersPerDay,
    };
  });
  return { myHouseholdId: mine, maxMembers, households, spouses, loadedAt };
}

/**
 * Orders households for display: inactive or never-active first, then the rest; each group keeps the
 * loaded order.
 */
export function sortGroup(households: readonly GroupHousehold[], now: Date, inactiveDays: number): GroupHousehold[] {
  const flagged = (h: GroupHousehold) => activityStatus(h.lastActivityAt, now, inactiveDays).kind !== 'active';
  return [...households.filter(flagged), ...households.filter((h) => !flagged(h))];
}

/** Outcome of {@link sendCheer}. */
export type CheerResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: 'already' | 'not_allowed' | 'no_message' | 'network' };

/**
 * Asks the server to push the cheer just sent to its receivers (story 057). Best effort: a
 * failure (no keys configured yet, offline) is logged and never shown.
 */
export async function notifyCheer(client: Pick<SupabaseClient, 'functions'>, target: { readonly toHouseholdId: string; readonly toUserId?: string }): Promise<void> {
  try {
    const { error } = await client.functions.invoke('notify-cheer', { body: target });
    if (error) console.warn('[cheer] push not sent', error.message);
  } catch (error) {
    console.warn('[cheer] push not sent', error);
  }
}

/**
 * Sends one cheer with a random line from `messages`. The server decides: a second cheer the
 * same UTC day fails with Postgres 23505 (`already`), a non-sponsor with 42501 (`not_allowed`).
 * No event and no XP are created.
 *
 * @example
 * const r = await sendCheer(client, { fromHouseholdId, toHouseholdId, messages });
 */
export async function sendCheer(
  client: SupabaseClient,
  input: {
    readonly fromHouseholdId: string;
    readonly toHouseholdId: string;
    /** The spouse receiving a cheer inside my own NPP (story 049); absent for a sponsor cheer. */
    readonly toUserId?: string;
    /** The text the sender chose (story 049); a random line of `messages` when absent. */
    readonly message?: string;
    readonly messages: readonly string[];
    readonly random?: () => number;
  },
): Promise<CheerResult> {
  const message = input.message !== undefined ? cleanCheerMessage(input.message) : pickCheerMessage(input.messages, input.random);
  if (message === null) return { ok: false, error: 'no_message' };
  const row: Record<string, unknown> = { from_household_id: input.fromHouseholdId, to_household_id: input.toHouseholdId, message };
  if (input.toUserId !== undefined) row.to_user_id = input.toUserId;
  const { error } = await client.from('cheers').insert(row);
  if (error === null) return { ok: true };
  if (error.code === '23505') return { ok: false, error: 'already' };
  if (error.code === '42501') return { ok: false, error: 'not_allowed' };
  return { ok: false, error: 'network' };
}

/** Longest cheer the server accepts (`cheers.message` check). */
export const CHEER_MAX_LENGTH = 200;

/** A typed cheer trimmed, or null when empty or longer than {@link CHEER_MAX_LENGTH}. Pure. */
export function cleanCheerMessage(text: string): string | null {
  const trimmed = text.trim();
  return trimmed === '' || trimmed.length > CHEER_MAX_LENGTH ? null : trimmed;
}

/** The other active members of my NPP with today's cheer state; [] when the read fails. */
async function loadSpouses(client: SupabaseClient, mine: string, accountId: string, cheersPerDay: number, now: Date): Promise<SpouseMember[]> {
  const members = await client.from('household_members').select('user_id').eq('household_id', mine).is('left_at', null);
  if (members.error) return [];
  const ids = ((members.data ?? []) as { user_id: string }[]).map((m) => m.user_id).filter((id) => id !== accountId);
  if (ids.length === 0) return [];
  const [p, sent] = await Promise.all([
    client.from('profiles').select('id, phone, display_name').in('id', ids),
    client.from('cheers').select('to_user_id').eq('from_household_id', mine).eq('to_household_id', mine).eq('sent_by', accountId).eq('cheer_day', utcDay(now)),
  ]);
  const profiles = (p.error ? [] : (p.data ?? [])) as { id: string; phone: string | null; display_name: string | null }[];
  // A server without `to_user_id` yet (before the story 049 migration) just shows no sent cheers.
  const sentTo = (sent.error ? [] : (sent.data ?? [])) as { to_user_id: string | null }[];
  return ids.map((id) => {
    const profile = profiles.find((x) => x.id === id);
    return {
      userId: id,
      displayName: profile?.display_name ?? null,
      phone: profile?.phone ?? null,
      cheeredToday: sentTo.filter((c) => c.to_user_id === id).length >= cheersPerDay,
    };
  });
}

/** A cheer my household received. */
export interface ReceivedCheer {
  readonly id: string;
  readonly message: string;
  readonly createdAt: string;
  /** Who sent it (set by the server from the sender's profile, story 049); null on old rows. */
  readonly senderName: string | null;
}

/** Cheers meant for me: sponsor cheers to my NPP, and spouse cheers whose receiver is me (story 049). Pure. */
export function cheersForMe<T extends { readonly toUserId: string | null }>(rows: readonly T[], accountId: string): T[] {
  return rows.filter((r) => r.toUserId === null || r.toUserId === accountId);
}

/** Latest cheers received by `householdId` (newest first), or null on a read error. */
export async function loadReceivedCheers(client: SupabaseClient, householdId: string, limit = 20, accountId?: string): Promise<ReceivedCheer[] | null> {
  const full = await client
    .from('cheers')
    .select('id, message, created_at, sender_name, to_user_id')
    .eq('to_household_id', householdId)
    .order('created_at', { ascending: false })
    .limit(limit);
  let rows: { id: string; message: string; created_at: string; sender_name?: string | null; to_user_id?: string | null }[];
  if (full.error) {
    // Before the story 049 migration: the old columns only.
    const old = await client.from('cheers').select('id, message, created_at').eq('to_household_id', householdId).order('created_at', { ascending: false }).limit(limit);
    if (old.error) return null;
    rows = (old.data ?? []) as typeof rows;
  } else rows = (full.data ?? []) as typeof rows;
  const mapped = rows.map((r) => ({ id: r.id, message: r.message, createdAt: r.created_at, senderName: r.sender_name ?? null, toUserId: r.to_user_id ?? null }));
  const mineOnly = accountId === undefined ? mapped.filter((r) => r.toUserId === null) : cheersForMe(mapped, accountId);
  return mineOnly.map(({ id, message, createdAt, senderName }) => ({ id, message, createdAt, senderName }));
}

const GROUP_CACHE_KEY = 'diamond.group.cache.v1';
const DISMISSED_KEY = 'diamond.cheers.dismissed.v1';
const DISMISSED_MAX = 200;

/** Last loaded group of `accountId` from localStorage, or null (missing, other account, unreadable). */
export function readGroupCache(accountId: string, storage: Pick<Storage, 'getItem'> = localStorage): GroupData | null {
  try {
    const raw = storage.getItem(`${GROUP_CACHE_KEY}:${accountId}`);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as Partial<GroupData>;
    if (typeof parsed.loadedAt !== 'string' || !Array.isArray(parsed.households) || typeof parsed.maxMembers !== 'number') return null;
    return parsed as GroupData;
  } catch {
    return null;
  }
}

/** Stores the last loaded group for offline use; a storage failure is ignored. */
export function writeGroupCache(accountId: string, data: GroupData, storage: Pick<Storage, 'setItem'> = localStorage): void {
  try {
    storage.setItem(`${GROUP_CACHE_KEY}:${accountId}`, JSON.stringify(data));
  } catch {
    // private mode or quota: the screen just has no offline copy
  }
}

/**
 * Removes every account's cached group (member names and phones of F1 households) from this
 * device. Called on sign-out so a shared phone keeps nothing of the group.
 */
export function clearGroupCaches(given?: Pick<Storage, 'length' | 'key' | 'removeItem'>): void {
  try {
    const storage = given ?? localStorage;
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key !== null && key.startsWith(`${GROUP_CACHE_KEY}:`)) keys.push(key);
    }
    for (const key of keys) storage.removeItem(key);
  } catch {
    // Storage may be blocked; nothing was cached then.
  }
}

/** Ids of cheers the user already closed on Hôm nay (localStorage; empty when unreadable). */
export function readDismissedCheers(storage: Pick<Storage, 'getItem'> = localStorage): ReadonlySet<string> {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(DISMISSED_KEY) ?? '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

/** Remembers closed cheer ids so they never show again (newest {@link DISMISSED_MAX} kept). */
export function dismissCheers(ids: readonly string[], storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage): void {
  try {
    const merged = [...readDismissedCheers(storage), ...ids];
    storage.setItem(DISMISSED_KEY, JSON.stringify(merged.slice(-DISMISSED_MAX)));
  } catch {
    // not persisted: the card may show again on the next open
  }
}

/**
 * The newest cheer my household received that was not dismissed, plus the ids of all received
 * cheers (what a dismiss should remember). Null on any read error or when there is none.
 */
export async function loadUnseenCheer(
  client: SupabaseClient,
  accountId: string,
  dismissed: ReadonlySet<string> = readDismissedCheers(),
): Promise<{ readonly cheer: ReceivedCheer; readonly allIds: readonly string[] } | null> {
  const own = await client.from('household_members').select('household_id').eq('user_id', accountId).is('left_at', null).maybeSingle();
  const household = (own.data as { household_id?: string } | null)?.household_id;
  if (own.error || household === undefined) return null;
  const cheers = await loadReceivedCheers(client, household, 20, accountId);
  const unseen = cheers?.find((c) => !dismissed.has(c.id));
  return cheers === null || unseen === undefined ? null : { cheer: unseen, allIds: cheers.map((c) => c.id) };
}
