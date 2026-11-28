import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import gameConfig from '../../config/game-config.json';
import type { EventStore } from '../../data/event-store';
import { CHEER_MAX_LENGTH, cleanCheerMessage, notifyCheer, parseGroupConfig, sendCheer } from '../../data/group-service';
import { loadNhomPeople, metToday, nhomSummary, weeklyRanking } from '../../data/nhom-service';
import type { NhomPerson, NhomRelation } from '../../data/nhom-service';
import { CHEER_XP, buildCheerXpEvent } from '../../domain/cheer-xp';
import { derivePeople } from '../../domain/people';
import { computeShareProgress, otherMemberIds, weekStartKey } from '../../domain/progress';
import { linkedContactNames, localDayKey } from '../group-helpers';
import { PEOPLE_CONFIG } from '../people-config';
import { STRINGS, noteCounterLabel } from '../strings';
import { Dialog } from './person-form';

const GROUP_CONFIG = parseGroupConfig(gameConfig);
const CARD = gameConfig.nhomCard;

/** Inputs shared by the Hôm nay card and the Nhóm page. */
export interface NhomProps {
  readonly clientPromise: Promise<SupabaseClient>;
  /** Signed-in account: its household sends the cheers. */
  readonly accountId: string;
  readonly eventStore: EventStore;
  /** My household members' ids, so my spouse's cheers do not count against my XP cheers. */
  readonly memberIds: ReadonlySet<string>;
  readonly dataVersion?: number;
  readonly now?: () => Date;
  readonly timeZone?: string;
  /** A cheer earned XP (Hôm nay reads its goal again). */
  readonly onXp?: () => void;
}

/** Loads my Nhóm and handles a cheer: picker, send, push, +XP. */
export function useNhom({ clientPromise, accountId, eventStore, memberIds, onXp, dataVersion = 0, now = () => new Date(), timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone }: NhomProps) {
  const [people, setPeople] = useState<NhomPerson[] | null>(null);
  const [names, setNames] = useState<ReadonlyMap<string, string>>(() => new Map());
  const [myXpWeek, setMyXpWeek] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [picking, setPicking] = useState<NhomPerson | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ readonly text: string; readonly error: boolean } | null>(null);

  useEffect(() => {
    if (!navigator.onLine) return undefined;
    let cancelled = false;
    void clientPromise.then(loadNhomPeople).then((list) => {
      if (!cancelled && list !== null) setPeople(list);
    });
    return () => {
      cancelled = true;
    };
  }, [clientPromise, dataVersion, reloadKey]);
  useEffect(() => {
    let cancelled = false;
    eventStore
      .list()
      .then((events) => {
        if (cancelled) return;
        setNames(linkedContactNames(derivePeople(events, PEOPLE_CONFIG)));
        setMyXpWeek(computeShareProgress(events, now(), { dailyXpGoal: gameConfig.dailyXpGoal }, timeZone, otherMemberIds(events, memberIds)).xpWeek);
      })
      .catch((error: unknown) => console.error('[nhom] could not read contact names', error));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventStore, dataVersion, reloadKey]);

  const nameOf = (p: NhomPerson) => names.get(p.userId) ?? p.name ?? STRINGS.groupMemberUnnamed;

  const send = async (person: NhomPerson, message: string) => {
    setBusy(true);
    setNotice(null);
    const target = { toHouseholdId: person.householdId, ...(person.relation === 'spouse' || person.relation === 'friend' ? { toUserId: person.userId } : {}) };
    try {
      const client = await clientPromise;
      const own = await client.from('household_members').select('household_id').eq('user_id', accountId).is('left_at', null).maybeSingle();
      const fromHouseholdId = (own.data as { household_id?: string } | null)?.household_id;
      if (own.error || fromHouseholdId === undefined) throw new Error('no household');
      const result = await sendCheer(client, { fromHouseholdId, ...target, message, messages: GROUP_CONFIG.cheerMessages });
      if (result.ok) {
        void notifyCheer(client, target);
        const events = await eventStore.list();
        const xpEvent = buildCheerXpEvent(events, now(), timeZone, otherMemberIds(events, memberIds), target);
        if (xpEvent !== null) {
          await eventStore.append(xpEvent);
          onXp?.();
        }
        setNotice({ text: xpEvent === null ? STRINGS.groupCheerSent : STRINGS.nhomCheerSentXp(CHEER_XP.xp), error: false });
        setPicking(null);
        setReloadKey((k) => k + 1);
      } else {
        setNotice({ text: STRINGS.groupCheerErrors[result.error], error: true });
        if (result.error === 'already') {
          setPicking(null);
          setReloadKey((k) => k + 1);
        }
      }
    } catch (error) {
      console.error('[nhom] cheer failed', error);
      setNotice({ text: STRINGS.groupCheerErrors.network, error: true });
    }
    setBusy(false);
  };

  const picker =
    picking === null ? null : (
      <CheerPicker name={nameOf(picking)} busy={busy} error={notice?.error === true ? notice.text : null} onCancel={() => setPicking(null)} onSend={(m) => void send(picking, m)} />
    );
  return { people, nameOf, picker, notice, busy, open: (p: NhomPerson) => {
    setNotice(null);
    setPicking(p);
  }, today: localDayKey(now()), now, ranking: people === null ? null : weeklyRanking(people, myXpWeek, weekStartKey(now(), timeZone)), weekStart: weekStartKey(now(), timeZone) };
}

/** "Gửi lời cổ vũ": a standard line or my own words. */
function CheerPicker({ name, busy, error, onSend, onCancel }: { readonly name: string; readonly busy: boolean; readonly error: string | null; readonly onSend: (message: string) => void; readonly onCancel: () => void }) {
  const [choice, setChoice] = useState(0);
  const [custom, setCustom] = useState('');
  const options = GROUP_CONFIG.cheerMessages;
  const chosen = custom.trim() !== '' ? cleanCheerMessage(custom) : (options[choice] ?? null);
  return (
    <Dialog title={STRINGS.cheerPickTitle} onClose={onCancel}>
      <p className="popup__body">
        <strong>{name}</strong>
      </p>
      <fieldset className="cheer-pick" disabled={custom.trim() !== '' || busy}>
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
        <textarea className="note__input" rows={2} maxLength={CHEER_MAX_LENGTH} value={custom} onChange={(e) => setCustom(e.target.value)} disabled={busy} />
        <span className="popup__counter">{noteCounterLabel(custom.length, CHEER_MAX_LENGTH)}</span>
      </label>
      <p className="message">{STRINGS.nhomCheerXpHint(CHEER_XP.xp, CHEER_XP.maxPerDay)}</p>
      {error !== null && (
        <p className="message message--error" role="alert">
          {error}
        </p>
      )}
      <div className="button-row popup__actions">
        <button type="button" className="button button--secondary" onClick={onCancel} disabled={busy}>
          {STRINGS.cheerCancel}
        </button>
        <button type="button" className="button button--primary" onClick={() => chosen !== null && onSend(chosen)} disabled={chosen === null || busy || !navigator.onLine}>
          {STRINGS.cheerSend}
        </button>
      </div>
    </Dialog>
  );
}

/** Initial for the round avatar: the last word of the name. */
function initial(name: string): string {
  return name.trim().split(/\s+/).pop()?.charAt(0).toUpperCase() ?? '?';
}

/** Round avatar coloured by relation; a green ring when today's goal is met. */
function Avatar({ person, name, ok }: { readonly person: NhomPerson; readonly name: string; readonly ok: boolean }) {
  return (
    <span className={`nhom-avatar nhom-avatar--${person.relation}${ok ? ' nhom-avatar--ok' : ''}`} aria-hidden="true">
      {initial(name)}
    </span>
  );
}

const TAGS: Record<NhomRelation, string> = { spouse: STRINGS.nhomTagSpouse, upline: STRINGS.nhomTagUpline, downline: STRINGS.nhomTagDownline, friend: STRINGS.nhomTagFriend };

/** One person: avatar, name, tag + streak + why, and 👏 (✓ once cheered). */
export function PersonRow({ person, name, reason, onCheer, disabled, showTag = true, extra, met }: {
  readonly person: NhomPerson;
  readonly name: string;
  readonly reason: string | null;
  readonly onCheer: () => void;
  readonly disabled: boolean;
  readonly showTag?: boolean;
  readonly extra?: string | null;
  /** Page rows: a green ✓ when today's goal is met (an empty ring when not). */
  readonly met?: boolean;
}) {
  return (
    <div className="nhom-row">
      <Avatar person={person} name={name} ok={false} />
      <span className="nhom-row__who">
        <b>{name}</b>
        <small>
          {showTag && <span className="nhom-tag">{TAGS[person.relation]}</span>}
          {met !== undefined && (
            <span className={met ? 'goal-dot goal-dot--ok' : 'goal-dot'} role="img" aria-label={met ? STRINGS.nhomMetToday : STRINGS.nhomNotMetShort}>
              {met ? '✓' : ''}
            </span>
          )}
          {person.streak !== null && <span className={person.streak > 0 ? 'streak-mark' : 'streak-mark streak-mark--zero'}>🔥{person.streak}</span>}
          {reason !== null && <span>· {reason}</span>}
          {extra != null && <span>{person.streak === null ? extra : `· ${extra}`}</span>}
        </small>
      </span>
      {person.cheeredToday ? (
        <span className="nhom-cheer nhom-cheer--done" role="img" aria-label={STRINGS.nhomCheeredAria(name)}>
          ✓
        </span>
      ) : (
        <button type="button" className="nhom-cheer" aria-label={STRINGS.nhomCheerAria(name)} onClick={onCheer} disabled={disabled}>
          👏
        </button>
      )}
    </div>
  );
}

/**
 * Body of the Hôm nay "Nhóm" card (story 070): avatars and "x/y đã đạt mục tiêu hôm nay", up to
 * three people to cheer (about to lose a streak first) with 👏 +XP, or "cả nhóm đều đạt", or a
 * "+ Kết bạn" button when the Nhóm is empty.
 */
export function NhomCardBody(props: NhomProps & { readonly onAddFriend: () => void }) {
  const n = useNhom(props);
  if (n.people === null) return null;
  if (n.people.length === 0)
    return (
      <>
        <p className="card__body">{STRINGS.nhomEmpty}</p>
        <button type="button" className="button button--secondary" onClick={props.onAddFriend}>
          {STRINGS.friendAdd}
        </button>
      </>
    );
  const s = nhomSummary(n.people, n.today, n.now(), CARD.needsShown);
  const reason = (p: (typeof s.needs)[number]) => (p.daysAway !== null ? STRINGS.nhomDaysAway(p.daysAway) : (p.streak ?? 0) > 0 ? STRINGS.nhomStreakAtRisk : null);
  return (
    <>
      <div className="nhom-stack">
        <span className="nhom-avatars">
          {s.avatars.slice(0, CARD.avatarsShown).map((p) => (
            <Avatar key={p.userId} person={p} name={n.nameOf(p)} ok={metToday(p, n.today)} />
          ))}
        </span>
        <span className="nhom-sum">{STRINGS.nhomMetLine(s.met, s.total)}</span>
      </div>
      {s.needs.length === 0 ? (
        <p className="nhom-allgood">{STRINGS.nhomAllMet}</p>
      ) : (
        <>
          <p className="nhom-label">
            <span>{STRINGS.nhomNotMet}</span>
            <span className="nhom-label__xp">{STRINGS.nhomXpEach(CHEER_XP.xp)}</span>
          </p>
          {s.needs.map((p) => (
            <PersonRow key={p.userId} person={p} name={n.nameOf(p)} reason={reason(p)} onCheer={() => n.open(p)} disabled={n.busy || !navigator.onLine} />
          ))}
          <p className="nhom-note">{STRINGS.nhomXpLimit(CHEER_XP.maxPerDay)}</p>
        </>
      )}
      {n.notice !== null && !n.notice.error && (
        <p className="message" role="status">
          {n.notice.text}
        </p>
      )}
      <RankStrip n={n} />
      {n.picker}
    </>
  );
}

/** "#3 tuần này · còn 31 XP để vượt …" (story 071); hidden when nobody else is ranked. */
function RankStrip({ n }: { readonly n: NhomState }) {
  const r = n.ranking;
  if (r === null || r.rows.length < 2) return null;
  const ahead = r.ahead === null ? null : r.rows.find((x) => x.userId === r.ahead!.userId)?.person ?? null;
  return (
    <p className="nhom-rank">
      <b>#{r.myRank}</b>
      <span>{r.ahead !== null && ahead !== null ? STRINGS.nhomRankBehind(r.ahead.gap, n.nameOf(ahead)) : STRINGS.nhomRankLead(r.lead)}</span>
    </p>
  );
}

/** "Xếp hạng tuần này" of the Nhóm page (story 071). */
export function RankingSection({ n }: { readonly n: NhomState }) {
  const r = n.ranking;
  if (r === null || r.rows.length < 2) return null;
  const monday = new Date(`${n.weekStart}T00:00:00`);
  const sunday = new Date(monday.getTime() + 6 * 86_400_000);
  const dm = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`;
  return (
    <section className="group-section" aria-label={STRINGS.nhomRankTitle}>
      <h2 className="settings-group nhom-rank__head">
        <span>{STRINGS.nhomRankTitle}</span>
        <span className="nhom-rank__week">{STRINGS.nhomRankWeek(dm(monday), dm(sunday))}</span>
      </h2>
      <ol className="card nhom-rank__list">
        {r.rows.map((row, i) => (
          <li key={row.userId} className={row.userId === 'me' ? 'nhom-rank__row nhom-rank__row--me' : 'nhom-rank__row'}>
            <span className="nhom-rank__pos">{i + 1}</span>
            <span className="nhom-rank__name">{row.person === null ? STRINGS.nhomRankMe : n.nameOf(row.person)}</span>
            <b>{STRINGS.nhomRankXp(row.xp)}</b>
          </li>
        ))}
        <li className="message nhom-rank__note">{STRINGS.nhomRankNote}</li>
      </ol>
    </section>
  );
}

/** What a friend chose to share (story 071): "12 việc 7 ngày · KH 3 · NPP 1", or null. */
export function sharedLine(p: NhomPerson): string | null {
  const parts: string[] = [];
  if (p.tasks7d !== null) parts.push(STRINGS.nhomTasks7d(Object.values(p.tasks7d).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0)));
  if (p.customers !== null) parts.push(STRINGS.nhomKh(p.customers));
  if (p.f1 !== null) parts.push(STRINGS.nhomNpp(p.f1));
  return parts.length === 0 ? null : parts.join(' · ');
}

/** Result of {@link useNhom}. */
export type NhomState = ReturnType<typeof useNhom>;

/** A Nhóm page row: no tag (the section says it), "đạt hôm nay" and XP of 7 days. */
export function pageRow(n: NhomState, p: NhomPerson): ReactNode {
  return (
    <PersonRow
      key={p.userId}
      person={p}
      name={n.nameOf(p)}
      reason={null}
      met={p.streak === null ? undefined : metToday(p, n.today)}
      extra={p.xp7d === null ? STRINGS.spouseNoNumbers : STRINGS.nhomXp7d(p.xp7d)}
      showTag={false}
      onCheer={() => n.open(p)}
      disabled={n.busy || !navigator.onLine}
    />
  );
}

/** Nhóm page sections (story 070): Vợ/chồng, Tuyến trên, Tuyến dưới, each person with 👏. */
export function NhomFamilySections({ n }: { readonly n: NhomState }) {
  if (n.people === null) return null;
  const section = (relation: NhomRelation, title: string) => {
    const list = n.people!.filter((p) => p.relation === relation);
    if (list.length === 0) return null;
    return (
      <section key={relation} className="group-section" aria-label={title}>
        <h2 className="settings-group">{list.length > 1 ? `${title} (${list.length})` : title}</h2>
        <div className="card nhom-list">{list.map((p) => pageRow(n, p))}</div>
      </section>
    );
  };
  return (
    <>
      {n.notice !== null && (
        <p className={n.notice.error ? 'message message--error' : 'message group-notice'} role={n.notice.error ? 'alert' : 'status'}>
          {n.notice.text}
        </p>
      )}
      {section('spouse', STRINGS.nhomSectionSpouse)}
      {section('upline', STRINGS.nhomSectionUpline)}
      {section('downline', STRINGS.nhomSectionDownline)}
    </>
  );
}
