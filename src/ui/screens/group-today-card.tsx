import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadFriends, splitFriends } from '../../data/friends-service';
import { STRINGS } from '../strings';

/** Props for {@link GroupTodayCard}. */
export interface GroupTodayCardProps {
  readonly clientPromise: Promise<SupabaseClient>;
  readonly onOpen: () => void;
  /** Bumped after a sync, so new invitations show. */
  readonly dataVersion?: number;
  /** What the card shows under its header (story 070). */
  readonly children?: ReactNode;
}

/**
 * Hôm nay "Nhóm" (story 069): header with "Xem tất cả ›" to the Nhóm page and a one-line note when
 * a friend request waits (no names on Hôm nay: they show in Nhóm).
 */
export function GroupTodayCard({ clientPromise, onOpen, dataVersion = 0, children }: GroupTodayCardProps) {
  const [invites, setInvites] = useState(0);
  useEffect(() => {
    if (!navigator.onLine) return undefined;
    let cancelled = false;
    void clientPromise.then(loadFriends).then((list) => {
      if (!cancelled && list !== null) setInvites(splitFriends(list).invites.length);
    });
    return () => {
      cancelled = true;
    };
  }, [clientPromise, dataVersion]);
  return (
    <section className="card group-card" aria-labelledby="group-card-title">
      <div className="group-card__head">
        <h2 id="group-card-title" className="card__title">
          {STRINGS.groupPageTitle}
        </h2>
        <button type="button" className="group-card__more" onClick={onOpen}>
          {STRINGS.groupSeeAll}
        </button>
      </div>
      {invites > 0 && (
        <p className="group-card__invite" role="status">
          {STRINGS.groupInviteStrip}
        </p>
      )}
      {children}
    </section>
  );
}
