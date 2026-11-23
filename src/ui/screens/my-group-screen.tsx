import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import gameConfig from '../../config/game-config.json';
import { activityStatus, loadGroup, parseGroupConfig, readGroupCache, sendCheer, sortGroup, writeGroupCache } from '../../data/group-service';
import type { GroupData, GroupHousehold, GroupMember } from '../../data/group-service';
import type { EventStore } from '../../data/event-store';
import { derivePeople } from '../../domain/people';
import type { Person } from '../../domain/people';
import { PEOPLE_CONFIG } from '../people-config';
import {
  STRINGS,
  groupCheerAria,
  groupCustomersLabel,
  groupF1Label,
  groupInactiveLabel,
  groupUpdatedLabel,
} from '../strings';
import { AddMemberForm } from './add-member-form';

const GROUP_CONFIG = parseGroupConfig(gameConfig);

/** Props for {@link MyGroupScreen}. */
export interface MyGroupScreenProps {
  /** Lazy Supabase client (from `getSupabaseClient`). */
  readonly clientPromise: Promise<SupabaseClient>;
  /** Signed-in account id (my household is looked up through it). */
  readonly accountId: string;
  /** Back to Con đường. */
  readonly onBack: () => void;
  /** Clock; defaults to the real one. Injected for screenshots. */
  readonly now?: () => Date;
  /**
   * My own event log, read only for the names I gave the contacts I created accounts for
   * (`linkedUserId`), so a member without a display name still shows who it is. Optional.
   */
  readonly eventStore?: EventStore;
}

type LoadState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error' }
  /** Offline and nothing cached. */
  | { readonly kind: 'offline-empty' }
  | { readonly kind: 'ready'; readonly data: GroupData; readonly stale: boolean };

function realNow(): Date {
  return new Date();
}

/**
 * Account id → the name I saved in my own Danh bạ for the contact linked to that account
 * (`linkedUserId`, set by "Tạo tài khoản"). Archived contacts are included: still that person.
 */
export function linkedContactNames(people: readonly Person[]): ReadonlyMap<string, string> {
  const names = new Map<string, string>();
  for (const p of people) if (p.linkedUserId != null && p.linkedUserId !== '' && !names.has(p.linkedUserId)) names.set(p.linkedUserId, p.name);
  return names;
}

/** A member's name: the display name they set, else my contact name for that account, else phone, else a placeholder. */
export function groupMemberName(member: Pick<GroupMember, 'userId' | 'displayName' | 'phone'>, contactNames: ReadonlyMap<string, string>): string {
  return member.displayName ?? contactNames.get(member.userId) ?? member.phone ?? STRINGS.groupMemberUnnamed;
}

/** Member names of a household, joined; a placeholder when it has none. */
function memberNames(h: GroupHousehold, contactNames: ReadonlyMap<string, string>): string {
  const names = h.members.map((m) => groupMemberName(m, contactNames));
  return names.length === 0 ? STRINGS.groupMemberUnnamed : names.join(', ');
}

/** Member phones shown under the names, only those not already used as the name. */
function memberPhones(h: GroupHousehold, contactNames: ReadonlyMap<string, string>): string | null {
  const phones = h.members.filter((m) => m.phone !== null && groupMemberName(m, contactNames) !== m.phone).map((m) => m.phone as string);
  return phones.length === 0 ? null : phones.join(', ');
}

/**
 * Màn "Nhóm của tôi" (story 028, no tab bar): only my direct F1 households, inactive ones first,
 * each with members, code, KH / NPP F1 x/30, the 30x30 badge, "cập nhật lúc…", a "Cổ vũ" button
 * (locked after today's cheer and offline) and "Thêm vợ/chồng" while the household has room.
 * Reads my own contact book only for names (see `eventStore`); never the F1's. Offline it shows the last loaded copy with the cheer button locked.
 *
 * @example
 * <MyGroupScreen clientPromise={client} accountId={id} onBack={back} />
 */
export function MyGroupScreen({ clientPromise, accountId, onBack, now = realNow, eventStore }: MyGroupScreenProps) {
  const [contactNames, setContactNames] = useState<ReadonlyMap<string, string>>(() => new Map());
  useEffect(() => {
    if (eventStore === undefined) return;
    let cancelled = false;
    eventStore
      .list()
      .then((events) => {
        if (!cancelled) setContactNames(linkedContactNames(derivePeople(events, PEOPLE_CONFIG)));
      })
      .catch((error: unknown) => console.error('[group] could not read contact names', error));
    return () => {
      cancelled = true;
    };
  }, [eventStore]);
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [online, setOnline] = useState(() => navigator.onLine);
  const [reloadKey, setReloadKey] = useState(0);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [cheering, setCheering] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ readonly text: string; readonly error: boolean } | null>(null);
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
    const cached = readGroupCache(accountId);
    if (!online) {
      setState(cached === null ? { kind: 'offline-empty' } : { kind: 'ready', data: cached, stale: true });
      return;
    }
    let cancelled = false;
    clientPromise
      .then((client) => loadGroup(client, accountId, gameConfig.maxHouseholdMembers, GROUP_CONFIG.cheersPerDay, now()))
      .then((data) => {
        if (cancelled) return;
        if (data === null) {
          setState(cached === null ? { kind: 'error' } : { kind: 'ready', data: cached, stale: true });
          return;
        }
        writeGroupCache(accountId, data);
        setState({ kind: 'ready', data, stale: false });
      })
      .catch((error: unknown) => {
        console.error('[group] could not read the group', error);
        if (!cancelled) setState(cached === null ? { kind: 'error' } : { kind: 'ready', data: cached, stale: true });
      });
    return () => {
      cancelled = true;
    };
  }, [clientPromise, accountId, online, reloadKey, now]);

  const sorted = useMemo(
    () => (state.kind === 'ready' ? sortGroup(state.data.households, now(), GROUP_CONFIG.inactiveDays) : []),
    [state, now],
  );

  const cheer = async (toHouseholdId: string, fromHouseholdId: string) => {
    if (cheering !== null) return;
    setCheering(toHouseholdId);
    setNotice(null);
    try {
      const result = await sendCheer(await clientPromise, { fromHouseholdId, toHouseholdId, messages: GROUP_CONFIG.cheerMessages });
      if (result.ok) setNotice({ text: STRINGS.groupCheerSent, error: false });
      else setNotice({ text: STRINGS.groupCheerErrors[result.error], error: true });
      if (result.ok || result.error === 'already') reload();
    } catch (error) {
      console.error('[group] cheer failed', error);
      setNotice({ text: STRINGS.groupCheerErrors.network, error: true });
    }
    setCheering(null);
  };

  if (addingTo !== null) {
    return <AddMemberForm clientPromise={clientPromise} householdId={addingTo} onAdded={reload} onClose={() => setAddingTo(null)} />;
  }

  const { customersTarget, f1Target } = PEOPLE_CONFIG.targets;
  const canCheer = online && state.kind === 'ready' && !state.stale;

  return (
    <main className="screen">
      <header className="screen__header">
        <button type="button" className="back-button" onClick={onBack}>
          {STRINGS.back}
        </button>
        <h1 className="screen__title">{STRINGS.groupTitle}</h1>
        <p className="screen__prompt">{STRINGS.groupPrompt}</p>
      </header>

      {state.kind === 'loading' && (
        <p className="message" role="status">
          {STRINGS.loading}
        </p>
      )}
      {state.kind === 'offline-empty' && (
        <p className="message" role="status">
          {STRINGS.groupOfflineNoData}
        </p>
      )}
      {state.kind === 'error' && (
        <div className="card">
          <p className="message message--error" role="alert">
            {STRINGS.groupLoadError}
          </p>
          <button type="button" className="button button--secondary" onClick={reload}>
            {STRINGS.retry}
          </button>
        </div>
      )}

      {notice !== null && (
        <p className={notice.error ? 'message message--error' : 'message'} role={notice.error ? 'alert' : 'status'}>
          {notice.text}
        </p>
      )}

      {state.kind === 'ready' && (
        <>
          {(state.stale || !online) && (
            <p className="message" role="status">
              {STRINGS.groupOfflineNote} {groupUpdatedLabel(state.data.loadedAt)}
            </p>
          )}
          {state.data.myHouseholdId === null && <p className="message">{STRINGS.groupNoHousehold}</p>}
          {state.data.myHouseholdId !== null && sorted.length === 0 && (
            <section className="card card--welcome">
              <h2 className="card__title">{STRINGS.groupEmptyTitle}</h2>
              <p className="card__body">{STRINGS.groupEmptyHint}</p>
            </section>
          )}
          {state.data.myHouseholdId !== null &&
            sorted.map((h) => {
              const status = activityStatus(h.lastActivityAt, now(), GROUP_CONFIG.inactiveDays);
              const names = memberNames(h, contactNames);
              const phones = memberPhones(h, contactNames);
              const myId = state.data.myHouseholdId as string;
              return (
                <section key={h.householdId} className={status.kind === 'active' ? 'card group-house' : 'card group-house group-house--inactive'} aria-label={names}>
                  <h2 className="card__title">{names}</h2>
                  {phones !== null && <p className="group-house__code">{phones}</p>}
                  <p className="group-house__code">
                    {STRINGS.groupCodeLabel}: {h.code ?? STRINGS.groupNoCode}
                  </p>
                  {status.kind !== 'active' && (
                    <p className="message message--warn" role="status">
                      {status.kind === 'never' ? STRINGS.groupNeverActive : groupInactiveLabel(status.days)}
                    </p>
                  )}
                  {h.numbers === null ? (
                    <p className="message">{STRINGS.groupNoNumbers}</p>
                  ) : (
                    <>
                      <p className="group-house__numbers">
                        <span>{groupCustomersLabel(h.numbers.customers, customersTarget)}</span>
                        <span>{groupF1Label(h.numbers.f1, f1Target)}</span>
                      </p>
                      {h.numbers.achieved30x30 && (
                        <p className="board-badge board-badge--achieved" role="status">
                          ◆ {STRINGS.groupAchieved}
                        </p>
                      )}
                      <p className="group-house__updated">{groupUpdatedLabel(h.numbers.updatedAt)}</p>
                    </>
                  )}
                  <div className="group-house__actions">
                    <button
                      type="button"
                      className="button button--primary"
                      aria-label={h.cheeredToday ? STRINGS.groupCheeredToday : groupCheerAria(names)}
                      disabled={!canCheer || h.cheeredToday || cheering !== null || GROUP_CONFIG.cheerMessages.length === 0}
                      onClick={() => void cheer(h.householdId, myId)}
                    >
                      {h.cheeredToday ? STRINGS.groupCheeredToday : STRINGS.groupCheerButton}
                    </button>
                    {!canCheer && !h.cheeredToday && <p className="message">{STRINGS.groupCheerOfflineReason}</p>}
                    {h.memberCount < state.data.maxMembers && (
                      <>
                        <button type="button" className="button button--secondary" disabled={!online} onClick={() => setAddingTo(h.householdId)}>
                          {STRINGS.addMemberButton}
                        </button>
                        {!online && <p className="message">{STRINGS.addMemberOfflineReason}</p>}
                      </>
                    )}
                  </div>
                </section>
              );
            })}
        </>
      )}
    </main>
  );
}
