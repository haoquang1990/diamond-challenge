import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { STRINGS } from '../strings';

/** Props for {@link FriendShareCard}. */
export interface FriendShareCardProps {
  readonly clientPromise: Promise<SupabaseClient>;
  readonly accountId: string;
}

type Share = { readonly tasks: boolean; readonly counts: boolean };

/**
 * Cài đặt "Chia sẻ với bạn bè" (story 071): what friends always see, two switches (tasks of 7
 * days; KH and NPP counts), off by default, and what is never shared. Saved on the server
 * (`friend_share`, owner-only), so it follows the account.
 */
export function FriendShareCard({ clientPromise, accountId }: FriendShareCardProps) {
  const [share, setShare] = useState<Share | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void clientPromise
      .then((c) => c.from('friend_share').select('tasks, counts').eq('user_id', accountId).maybeSingle())
      .then(({ data, error: e }) => {
        if (cancelled) return;
        const row = data as { tasks?: unknown; counts?: unknown } | null;
        setShare(e === null ? { tasks: row?.tasks === true, counts: row?.counts === true } : null);
      });
    return () => {
      cancelled = true;
    };
  }, [clientPromise, accountId]);

  const toggle = async (key: keyof Share) => {
    if (share === null) return;
    const next = { ...share, [key]: !share[key] };
    setShare(next);
    setError(false);
    const { error: e } = await (await clientPromise).from('friend_share').upsert({ user_id: accountId, ...next, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (e !== null) {
      setShare(share);
      setError(true);
    }
  };

  const row = (key: keyof Share, label: string, hint: string) => (
    <div className="notify-row">
      <span className="notify-row__text">
        <span id={`share-${key}`} className="setting-row__label">
          {label}
        </span>
        <span className="notify-row__hint">{hint}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={share?.[key] === true}
        aria-labelledby={`share-${key}`}
        className={share?.[key] === true ? 'switch switch--on' : 'switch'}
        onClick={() => void toggle(key)}
        disabled={share === null || !navigator.onLine}
      >
        <span className="switch__thumb" aria-hidden="true" />
      </button>
    </div>
  );

  return (
    <section className="card form friend-share" aria-label={STRINGS.friendShareTitle2}>
      <p className="friend-share__lock">{STRINGS.friendShareAlways}</p>
      {row('tasks', STRINGS.friendShareTasks, STRINGS.friendShareTasksHint)}
      {row('counts', STRINGS.friendShareCounts, STRINGS.friendShareCountsHint)}
      <p className="friend-share__lock">{STRINGS.friendShareNever}</p>
      {error && (
        <p className="message message--error" role="alert">
          {STRINGS.friendShareError}
        </p>
      )}
    </section>
  );
}
