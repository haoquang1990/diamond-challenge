import { useCallback, useEffect, useState } from 'react';
import type { HouseholdMember } from '../../data/contact-sync';
import type { EventStore, LogEvent } from '../../data/event-store';
import {
  buildMergeEvent,
  buildNotDuplicateEvent,
  findDuplicatePairs,
  personAddedBy,
  planMerge,
  planMergeAll,
} from '../../domain/duplicates';
import type { DuplicatePair, DuplicateReason } from '../../domain/duplicates';
import { derivePeople } from '../../domain/people';
import type { Person } from '../../domain/people';
import { otherMemberIds } from '../../domain/progress';
import { PEOPLE_CONFIG } from '../people-config';
import { formatPhone, historyAuthorLabel } from '../people-helpers';
import { STRINGS, keepCodeLabel, mergedCountLabel } from '../strings';
import { LabelBadge } from './person-form';

/** Props for {@link DuplicatesScreen}. */
export interface DuplicatesScreenProps {
  readonly eventStore: EventStore;
  /** Account ids of household members persisted on the device (story 023). */
  readonly memberIds?: ReadonlySet<string>;
  /** Household members, or null when the contact book is not synced: "who added" then names no one. */
  readonly members?: ReadonlyMap<string, HouseholdMember> | null;
  /** Bumped by the app when a sync pulled new events; the log is re-read. */
  readonly dataVersion?: number;
  readonly onBack: () => void;
}

const NO_MEMBERS: ReadonlySet<string> = new Set();

const REASON_TEXT: Record<DuplicateReason, string> = {
  amway_code: STRINGS.dupReasonCode,
  phone: STRINGS.dupReasonPhone,
  same_name: STRINGS.dupReasonName,
  near_name: STRINGS.dupReasonNearName,
};

interface SideProps {
  readonly person: Person;
  readonly addedBy: string;
}

/** One contact of a pair: name, phones, code, label, tasks done, who added it. */
function Side({ person, addedBy }: SideProps) {
  const phones = [person.phone, ...(person.phones ?? [])].filter((p) => p != null).map((p) => formatPhone(p));
  return (
    <div className="dup-side">
      <p className="dup-side__name">{person.name}</p>
      <dl className="dup-side__facts">
        <dt>{STRINGS.dupPhone}</dt>
        <dd>{phones.length === 0 ? STRINGS.dupNoPhone : phones.join(', ')}</dd>
        <dt>{STRINGS.dupCode}</dt>
        <dd>{person.amwayCode ?? STRINGS.dupNoCode}</dd>
        <dt>{STRINGS.dupLabel}</dt>
        <dd>{person.label == null ? STRINGS.dupNoLabel : <LabelBadge label={person.label} />}</dd>
        <dt>{STRINGS.dupTasksDone}</dt>
        <dd>{(person.doneTaskIds ?? []).length}</dd>
        <dt>{STRINGS.dupAddedBy}</dt>
        <dd>{addedBy}</dd>
      </dl>
    </div>
  );
}

/**
 * Screen "Kiểm tra liên hệ trùng" (story 026, crm.md rules 19-20). Lists every unresolved pair side
 * by side with "Gộp" and "Không phải cùng người"; "Gộp tất cả" merges only certain pairs without a
 * code conflict or two different linked accounts. Pairs are derived from the log on every read;
 * this screen only writes `person_merged` / `person_not_duplicate` events.
 */
export function DuplicatesScreen({ eventStore, memberIds = NO_MEMBERS, members = null, dataVersion = 0, onBack }: DuplicatesScreenProps) {
  const [events, setEvents] = useState<readonly LogEvent[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  /** Key of the pair waiting for the user to pick which code to keep. */
  const [choosing, setChoosing] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    try {
      setEvents(await eventStore.list());
      setLoadError(false);
    } catch (e) {
      console.error('[duplicates] load failed', e);
      setLoadError(true);
    }
  }, [eventStore]);

  useEffect(() => {
    void reload();
  }, [reload, dataVersion]);

  async function write(action: () => Promise<void>): Promise<void> {
    setBusy(true);
    setError(false);
    setInfo(null);
    try {
      await action();
    } catch (e) {
      console.error('[duplicates] write failed', e);
      setError(true);
    } finally {
      setChoosing(null);
      await reload();
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <main className="screen">
        <p className="message message--error" role="alert">
          {STRINGS.peopleLoadError}
        </p>
        <button type="button" className="button button--primary" onClick={() => void reload()}>
          {STRINGS.retry}
        </button>
      </main>
    );
  }
  if (events === null) {
    return (
      <main className="screen">
        <p className="message" role="status">
          {STRINGS.loading}
        </p>
      </main>
    );
  }

  const others = otherMemberIds(events, memberIds);
  const people = derivePeople(events, PEOPLE_CONFIG);
  // Certain pairs first (stable sort keeps detection order inside each group).
  const pairs = findDuplicatePairs(people, events, PEOPLE_CONFIG).sort((a, b) => Number(a.strength !== 'certain') - Number(b.strength !== 'certain'));
  const mergeable = planMergeAll(pairs);
  const addedByLabel = (person: Person): string => {
    const userId = personAddedBy(events, person.personId);
    return (userId === null ? null : historyAuthorLabel(userId, others, members)) ?? STRINGS.dupAddedByMe;
  };

  const merge = (pair: DuplicatePair, chosenCode?: string) =>
    write(async () => {
      const plan = planMerge(pair.first, pair.second);
      if (!plan.ok) return;
      const built = buildMergeEvent(plan, chosenCode);
      if (built.ok) await eventStore.append(built.event);
    });

  const mergeAll = () =>
    write(async () => {
      for (const { plan } of mergeable) {
        const built = buildMergeEvent(plan);
        if (built.ok) await eventStore.append(built.event);
      }
      setInfo(mergedCountLabel(mergeable.length));
    });

  const notSame = (pair: DuplicatePair) =>
    write(async () => {
      await eventStore.append(buildNotDuplicateEvent(pair.first.personId, pair.second.personId));
    });

  return (
    <main className="screen">
      <header className="screen__header">
        <button type="button" className="back-button" onClick={onBack} disabled={busy}>
          ‹ {STRINGS.dupBack}
        </button>
        <h1 className="screen__title">{STRINGS.dupTitle}</h1>
        <p className="screen__prompt">{STRINGS.dupPrompt}</p>
      </header>

      {mergeable.length > 0 && (
        <section className="card person-section">
          <button type="button" className="button button--primary" onClick={() => void mergeAll()} disabled={busy}>
            {STRINGS.dupMergeAll}
          </button>
          <p className="message">{STRINGS.dupMergeAllHint}</p>
        </section>
      )}
      {info !== null && (
        <p className="message" role="status">
          {info}
        </p>
      )}
      {error && (
        <p className="message message--error" role="alert">
          {STRINGS.dupError}
        </p>
      )}
      {pairs.length === 0 && (
        <section className="card card--welcome">
          <p className="message">{STRINGS.dupNone}</p>
        </section>
      )}

      <ul className="people-list">
        {pairs.map((pair) => {
          const plan = planMerge(pair.first, pair.second);
          return (
            <li key={pair.key} className="card dup-pair">
              <p className="dup-pair__head">
                <span className={pair.strength === 'certain' ? 'badge badge--npp dup-pair__badge' : 'badge badge--kh dup-pair__badge'}>
                  {pair.strength === 'certain' ? STRINGS.dupCertain : STRINGS.dupPossible}
                </span>
                <span className="dup-pair__reasons">{pair.reasons.map((r) => REASON_TEXT[r]).join(' · ')}</span>
              </p>
              <div className="dup-pair__sides">
                <Side person={pair.first} addedBy={addedByLabel(pair.first)} />
                <Side person={pair.second} addedBy={addedByLabel(pair.second)} />
              </div>
              {!plan.ok && (
                <p className="message message--warn" role="status">
                  {STRINGS.dupLinkedConflict}
                </p>
              )}
              {plan.ok && choosing === pair.key ? (
                <div className="dup-pair__choose" role="group" aria-label={STRINGS.dupPickCodeTitle}>
                  <p className="message">{STRINGS.dupPickCodeTitle}</p>
                  {plan.codes.map((code) => (
                    <button key={code} type="button" className="button button--primary" onClick={() => void merge(pair, code)} disabled={busy}>
                      {keepCodeLabel(code)}
                    </button>
                  ))}
                  <button type="button" className="button button--secondary" onClick={() => setChoosing(null)} disabled={busy}>
                    {STRINGS.dupCancel}
                  </button>
                </div>
              ) : (
                <div className="button-row dup-pair__actions">
                  <button
                    type="button"
                    className="button button--primary"
                    onClick={() => (plan.ok && plan.needsCodeChoice ? setChoosing(pair.key) : void merge(pair))}
                    disabled={busy || !plan.ok}
                  >
                    {STRINGS.dupMerge}
                  </button>
                  <button type="button" className="button button--secondary" onClick={() => void notSame(pair)} disabled={busy}>
                    {STRINGS.dupNotSame}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
