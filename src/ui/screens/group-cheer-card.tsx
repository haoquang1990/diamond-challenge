import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import gameConfig from '../../config/game-config.json';
import { CHEER_MAX_LENGTH, cleanCheerMessage, loadGroup, parseGroupConfig, readGroupCache, sendCheer, writeGroupCache } from '../../data/group-service';
import type { GroupData } from '../../data/group-service';
import type { EventStore } from '../../data/event-store';
import { derivePeople } from '../../domain/people';
import { cheerCandidates, codeContactNames, householdActivityNote, householdNames, linkedContactNames } from '../group-helpers';
import { PEOPLE_CONFIG } from '../people-config';
import { STRINGS, groupCheerAria, noteCounterLabel } from '../strings';
import { Dialog } from './person-form';

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
  const [codeNames, setCodeNames] = useState<ReadonlyMap<string, string>>(() => new Map());
  /** Who the open "Gửi lời cổ vũ" popup is for (story 049). */
  const [picking, setPicking] = useState<{ readonly toHouseholdId: string; readonly toUserId?: string; readonly name: string } | null>(null);
  const [choice, setChoice] = useState(0);
  const [custom, setCustom] = useState('');
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
        if (cancelled) return;
        const people = derivePeople(events, PEOPLE_CONFIG);
        setContactNames(linkedContactNames(people));
        setCodeNames(codeContactNames(people));
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
  const spouses = (data.group.spouses ?? []).filter((m) => !m.cheeredToday);
  if (candidates.length === 0 && spouses.length === 0 && notice === null) return null;
  const myId = data.group.myHouseholdId;
  const canCheer = online && !data.stale && GROUP_CONFIG.cheerMessages.length > 0;
  const options = GROUP_CONFIG.cheerMessages;
  const typed = custom.trim() === '' ? null : cleanCheerMessage(custom);
  const chosen = custom.trim() !== '' ? typed : (options[choice] ?? null);

  const open = (target: { readonly toHouseholdId: string; readonly toUserId?: string; readonly name: string }) => {
    setChoice(0);
    setCustom('');
    setNotice(null);
    setPicking(target);
  };

  const send = async () => {
    if (picking === null || chosen === null || cheering !== null) return;
    const target = picking;
    setCheering(target.toUserId ?? target.toHouseholdId);
    setNotice(null);
    try {
      const result = await sendCheer(await clientPromise, {
        fromHouseholdId: myId,
        toHouseholdId: target.toHouseholdId,
        ...(target.toUserId === undefined ? {} : { toUserId: target.toUserId }),
        message: chosen,
        messages: options,
      });
      setNotice(result.ok ? { text: STRINGS.groupCheerSent, error: false } : { text: STRINGS.groupCheerErrors[result.error], error: true });
      if (result.ok || result.error === 'already') {
        setPicking(null);
        reload();
      }
    } catch (error) {
      console.error('[cheer-card] cheer failed', error);
      setNotice({ text: STRINGS.groupCheerErrors.network, error: true });
    }
    setCheering(null);
  };

  const row = (key: string, names: string, note: string | null, onCheer: () => void) => (
    <li key={key} className="cheer-group__row">
      <span className="cheer-group__who">
        <span className="cheer-group__name">{names}</span>
        {note !== null && <span className="cheer-group__note">{note}</span>}
      </span>
      <button type="button" className="button button--primary cheer-group__button" aria-label={groupCheerAria(names)} disabled={!canCheer || cheering !== null} onClick={onCheer}>
        {STRINGS.groupCheerButton}
      </button>
    </li>
  );

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
      {(spouses.length > 0 || candidates.length > 0) && (
        <ul className="cheer-group__list">
          {spouses.map((m) => {
            const name = m.displayName ?? contactNames.get(m.userId) ?? m.phone ?? STRINGS.groupMemberUnnamed;
            return row(`spouse-${m.userId}`, name, STRINGS.cheerSpouseNote, () => open({ toHouseholdId: myId, toUserId: m.userId, name }));
          })}
          {candidates.map((h) => {
            const names = householdNames(h, contactNames, codeNames);
            return row(h.householdId, names, householdActivityNote(h, now(), GROUP_CONFIG.inactiveDays), () => open({ toHouseholdId: h.householdId, name: names }));
          })}
        </ul>
      )}
      {!canCheer && (spouses.length > 0 || candidates.length > 0) && <p className="message">{STRINGS.groupCheerOfflineReason}</p>}

      {picking !== null && (
        <Dialog title={STRINGS.cheerPickTitle} onClose={() => setPicking(null)}>
          <p className="popup__body">
            <strong>{picking.name}</strong>
          </p>
          <fieldset className="cheer-pick" disabled={custom.trim() !== '' || cheering !== null}>
            <legend className="note__label">{STRINGS.cheerPickLabel}</legend>
            {options.map((text, i) => (
              <label key={text} className={i === choice && custom.trim() === '' ? 'cheer-pick__option cheer-pick__option--on' : 'cheer-pick__option'}>
                <input type="radio" name="cheer-pick" checked={i === choice} onChange={() => setChoice(i)} />
                <span>{text}</span>
              </label>
            ))}
          </fieldset>
          <label className="note popup__field">
            <span className="note__label">{STRINGS.cheerCustomLabel}</span>
            <textarea className="note__input" rows={2} maxLength={CHEER_MAX_LENGTH} value={custom} onChange={(e) => setCustom(e.target.value)} disabled={cheering !== null} />
            <span className="popup__counter">{noteCounterLabel(custom.length, CHEER_MAX_LENGTH)}</span>
          </label>
          {notice !== null && notice.error && (
            <p className="message message--error" role="alert">
              {notice.text}
            </p>
          )}
          <div className="button-row popup__actions">
            <button type="button" className="button button--secondary" onClick={() => setPicking(null)} disabled={cheering !== null}>
              {STRINGS.cheerCancel}
            </button>
            <button type="button" className="button button--primary" onClick={() => void send()} disabled={chosen === null || cheering !== null || !canCheer}>
              {STRINGS.cheerSend}
            </button>
          </div>
        </Dialog>
      )}
    </section>
  );
}
