import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import gameConfig from '../../config/game-config.json';
import { loadGroup, parseGroupConfig, readGroupCache, sendCheer, writeGroupCache } from '../../data/group-service';
import type { GroupData } from '../../data/group-service';
import type { EventStore } from '../../data/event-store';
import { derivePeople } from '../../domain/people';
import { cheerCandidates, householdActivityNote, householdNames, linkedContactNames } from '../group-helpers';
import { PEOPLE_CONFIG } from '../people-config';
import { STRINGS, groupCheerAria } from '../strings';

const GROUP_CONFIG = parseGroupConfig(gameConfig);

/** Props for {@link GroupCheerCard}. */
export interface GroupCheerCardProps {
  /** Lazy Supabase client (from `getSupabaseClient`). */
  readonly clientPromise: Promise<SupabaseClient>;
  /** Signed-in account id (my household is looked up through it). */
  readonly accountId: string;
  /** My own event log, read only for the names I gave the contacts linked to F1 accounts. */
  readonly eventStore?: EventStore;
  /** Clock; defaults to the real one. */
  readonly now?: () => Date;
}

function realNow(): Date {
  return new Date();
}

/**
 * Hôm nay "Cổ vũ nhóm" (story 041): my F1 households not cheered today, inactive ones first with
 * "N ngày chưa hoạt động", one "Cổ vũ" button each. A cheered household leaves the list; the card
 * hides when nobody is left or I have no F1. Offline it shows the last loaded list with the buttons
 * locked; nothing is shown while loading or when nothing was ever loaded.
 */
export function GroupCheerCard({ clientPromise, accountId, eventStore, now = realNow }: GroupCheerCardProps) {
  const [data, setData] = useState<{ readonly group: GroupData; readonly stale: boolean } | null>(null);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [reloadKey, setReloadKey] = useState(0);
  const [cheering, setCheering] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ readonly text: string; readonly error: boolean } | null>(null);
  const [contactNames, setContactNames] = useState<ReadonlyMap<string, string>>(() => new Map());
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  useEffect(() => {
    if (eventStore === undefined) return undefined;
    let cancelled = false;
    eventStore
      .list()
      .then((events) => {
        if (!cancelled) setContactNames(linkedContactNames(derivePeople(events, PEOPLE_CONFIG)));
      })
      .catch((error: unknown) => console.error('[cheer-card] could not read contact names', error));
    return () => {
      cancelled = true;
    };
  }, [eventStore]);

  useEffect(() => {
    const cached = readGroupCache(accountId);
    if (!online) {
      setData(cached === null ? null : { group: cached, stale: true });
      return undefined;
    }
    let cancelled = false;
    clientPromise
      .then((client) => loadGroup(client, accountId, gameConfig.maxHouseholdMembers, GROUP_CONFIG.cheersPerDay, now()))
      .then((group) => {
        if (cancelled) return;
        if (group === null) {
          setData(cached === null ? null : { group: cached, stale: true });
          return;
        }
        writeGroupCache(accountId, group);
        setData({ group, stale: false });
      })
      .catch((error: unknown) => {
        console.error('[cheer-card] could not read the group', error);
        if (!cancelled) setData(cached === null ? null : { group: cached, stale: true });
      });
    return () => {
      cancelled = true;
    };
  }, [clientPromise, accountId, online, reloadKey, now]);

  if (data === null || data.group.myHouseholdId === null) return null;
  const candidates = cheerCandidates(data.group.households, now(), GROUP_CONFIG.inactiveDays);
  if (candidates.length === 0 && notice === null) return null;
  const myId = data.group.myHouseholdId;
  const canCheer = online && !data.stale && GROUP_CONFIG.cheerMessages.length > 0;

  const cheer = async (toHouseholdId: string) => {
    if (cheering !== null) return;
    setCheering(toHouseholdId);
    setNotice(null);
    try {
      const result = await sendCheer(await clientPromise, { fromHouseholdId: myId, toHouseholdId, messages: GROUP_CONFIG.cheerMessages });
      setNotice(result.ok ? { text: STRINGS.groupCheerSent, error: false } : { text: STRINGS.groupCheerErrors[result.error], error: true });
      if (result.ok || result.error === 'already') reload();
    } catch (error) {
      console.error('[cheer-card] cheer failed', error);
      setNotice({ text: STRINGS.groupCheerErrors.network, error: true });
    }
    setCheering(null);
  };

  return (
    <section className="card cheer-group" aria-labelledby="cheer-group-title">
      <h2 id="cheer-group-title" className="card__title">
        {STRINGS.cheerGroupTitle}
      </h2>
      {notice !== null && (
        <p className={notice.error ? 'message message--error' : 'message'} role={notice.error ? 'alert' : 'status'}>
          {notice.text}
        </p>
      )}
      {candidates.length > 0 && (
        <ul className="cheer-group__list">
          {candidates.map((h) => {
            const names = householdNames(h, contactNames);
            const activity = householdActivityNote(h, now(), GROUP_CONFIG.inactiveDays);
            return (
              <li key={h.householdId} className="cheer-group__row">
                <span className="cheer-group__who">
                  <span className="cheer-group__name">{names}</span>
                  {activity !== null && <span className="cheer-group__note">{activity}</span>}
                </span>
                <button
                  type="button"
                  className="button button--primary cheer-group__button"
                  aria-label={groupCheerAria(names)}
                  disabled={!canCheer || cheering !== null}
                  onClick={() => void cheer(h.householdId)}
                >
                  {STRINGS.groupCheerButton}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {!canCheer && candidates.length > 0 && <p className="message">{STRINGS.groupCheerOfflineReason}</p>}
    </section>
  );
}
