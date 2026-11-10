import { useCallback, useEffect, useState } from 'react';
import type { HouseholdMember } from '../../data/contact-sync';
import type { EventStore, LogEvent } from '../../data/event-store';
import { otherMemberIds } from '../../domain/progress';
import { pendingDuplicates } from '../../domain/duplicates';
import { deriveActivityOwners, derivePeople } from '../../domain/people';
import type { Person, PersonPhone } from '../../domain/people';
import { ACTIVITY_TYPES } from '../activity-types';
import type { ActivityType } from '../activity-types';
import { PEOPLE_CONFIG } from '../people-config';
import {
  CONTACTS_FILTERS,
  countContacts,
  duplicateCodeNames,
  filterContacts,
  findDuplicateCodes,
  historyAuthorLabel,
  listUnassignedActivities,
  searchPeopleByName,
} from '../people-helpers';
import type { ContactsFilter } from '../people-helpers';
import { STRINGS, duplicateCodeWarning, duplicatesEntryLabel, filterChipLabel, lastContactLabel, nppSinceLabel, shortDateLabel, xpLabel } from '../strings';
import { AddPersonForm, LabelBadge, PersonDetail } from './person-form';

/** Props for {@link PeopleScreen}. */
export interface PeopleScreenProps {
  /** Account ids of household members persisted on the device (story 023); their events are not mine. */
  readonly memberIds?: ReadonlySet<string>;
  /** Event log everything is derived from (injected). */
  readonly eventStore: EventStore;
  /** Activity types, used for the add_name XP and legacy row names; defaults to game-config.json. */
  readonly activityTypes?: readonly ActivityType[];
  /** Filter chip selected on first render only (e.g. when opened from Bảng 30x30). */
  readonly initialFilter?: ContactsFilter;
  /** When provided, a "‹ Quay lại Bảng 30x30" control is shown at the top and calls this. */
  readonly onBack?: () => void;
  /** Household members (story 023), or null when the contact book is not synced: history then names no author. */
  readonly members?: ReadonlyMap<string, HouseholdMember> | null;
  /** Person detail opened on first render (returning from the account screen, story 024). */
  readonly initialOpenId?: string | null;
  /** Opens the account screen for a person (story 024); absent when signed out or the build has no account feature. */
  readonly onCreateAccount?: (personId: string) => void;
  /** Bumped by the app when a sync pulled new events; the log is re-read. */
  readonly dataVersion?: number;
  /** Opens the "Kiểm tra liên hệ trùng" screen (story 026); the entry shows only when pairs are pending. */
  readonly onOpenDuplicates?: () => void;
}

type LoadState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error' }
  | { readonly kind: 'ready'; readonly events: readonly LogEvent[] };

const NO_MEMBERS: ReadonlySet<string> = new Set();

/** Id of the activity type that gives XP for adding a person. */
const ADD_NAME_ACTIVITY_ID = 'add_name';

/**
 * Tab "Làm" (the person list, merged with the old Danh bạ in story 015):
 * add form, name search, filter chips (Tất cả / Khách hàng / NPP / Đã lưu trữ)
 * over one derived list, person detail (where tasks are completed), restore
 * of archived people and the section for activities not yet linked to a
 * person. The search narrows the rows of the active chip; chip counts stay
 * the per-filter totals and ignore the search. Re-reads the event log on
 * mount and after every write; keeps no copy of truth.
 */
export function PeopleScreen({ eventStore, activityTypes = ACTIVITY_TYPES, initialFilter = 'all', onBack, members = null, memberIds = NO_MEMBERS, dataVersion = 0, initialOpenId = null, onCreateAccount, onOpenDuplicates }: PeopleScreenProps) {
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' });
  const [openId, setOpenId] = useState<string | null>(initialOpenId);
  const [addedXp, setAddedXp] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ContactsFilter>(initialFilter);
  /** null = automatic: open while the list is empty, collapsed once there are people. */
  const [showAdd, setShowAdd] = useState<boolean | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  /** Name search text; kept while a person detail is open so the list returns as it was. */
  const [query, setQuery] = useState('');

  const reload = useCallback(async (): Promise<void> => {
    try {
      setLoad({ kind: 'ready', events: await eventStore.list() });
    } catch (e) {
      console.error('[people] load failed', e);
      setLoad({ kind: 'error' });
    }
  }, [eventStore]);

  useEffect(() => {
    void reload();
  }, [reload, dataVersion]);

  if (load.kind === 'loading') {
    return (
      <main className="screen screen--tabbed">
        <p className="message" role="status">
          {STRINGS.loading}
        </p>
      </main>
    );
  }
  if (load.kind === 'error') {
    return (
      <main className="screen screen--tabbed">
        <p className="message message--error" role="alert">
          {STRINGS.peopleLoadError}
        </p>
        <button type="button" className="button button--primary" onClick={() => void reload()}>
          {STRINGS.retry}
        </button>
      </main>
    );
  }

  const { events } = load;
  const others = otherMemberIds(events, memberIds);
  const allPeople = derivePeople(events, PEOPLE_CONFIG);
  const people = allPeople.filter((p) => !p.archived);
  const opened = openId === null ? undefined : people.find((p) => p.personId === openId);

  if (opened !== undefined) {
    return (
      <PersonDetail
        key={opened.personId}
        eventStore={eventStore}
        person={opened}
        people={people}
        events={events}
        activityTypes={activityTypes}
        config={PEOPLE_CONFIG}
        authorLabel={(userId) => historyAuthorLabel(userId, others, members)}
        {...(onCreateAccount === undefined ? {} : { createAccount: { onOpen: () => onCreateAccount(opened.personId) } })}
        onChanged={reload}
        onBack={() => setOpenId(null)}
      />
    );
  }

  const addOpen = showAdd ?? people.length === 0;
  const addNameType = activityTypes.find((t) => t.id === ADD_NAME_ACTIVITY_ID);

  async function addPerson(name: string, note: string, phone: PersonPhone | null, amwayCode: string | null): Promise<void> {
    setError(null);
    const personId = crypto.randomUUID();
    await eventStore.append({
      type: 'person_added',
      payload: {
        personId,
        name,
        ...(note === '' ? {} : { note }), ...(phone === null ? {} : { phone }),
        ...(amwayCode === null ? {} : { amwayCode }),
      },
    });
    if (addNameType !== undefined) {
      try {
        await eventStore.append({
          type: 'activity_logged',
          payload: { activityType: addNameType.id, xp: addNameType.xp, personId },
        });
        setAddedXp(addNameType.xp);
      } catch (e) {
        console.error('[people] add_name activity failed', e);
        setError(STRINGS.personSaveError);
      }
    } else {
      setAddedXp(null);
    }
    await reload();
  }

  async function restore(personId: string): Promise<void> {
    setError(null);
    setRestoringId(personId);
    try {
      await eventStore.append({ type: 'person_restored', payload: { personId } });
      await reload();
    } catch (e) {
      console.error('[people] restore failed', e);
      setError(STRINGS.restoreError);
    } finally {
      setRestoringId(null);
    }
  }

  const dupCodes = findDuplicateCodes(people);
  const counts = countContacts(allPeople);
  const inFilter = filterContacts(allPeople, filter);
  const shown = searchPeopleByName(inFilter, query);
  const filterNames: Record<ContactsFilter, string> = {
    all: STRINGS.filterAll,
    kh: STRINGS.filterKh,
    npp: STRINGS.filterNpp,
    archived: STRINGS.filterArchived,
  };
  const emptyText: Record<ContactsFilter, { title: string; body: string }> = {
    all: { title: STRINGS.emptyAllTitle, body: STRINGS.peopleEmptyBody },
    kh: { title: STRINGS.filterKh, body: STRINGS.emptyKhBody },
    npp: { title: STRINGS.filterNpp, body: STRINGS.emptyNppBody },
    archived: { title: STRINGS.filterArchived, body: STRINGS.emptyArchivedBody },
  };
  const pendingPairs = pendingDuplicates(allPeople, events, PEOPLE_CONFIG);
  const unassigned = listUnassignedActivities(events, deriveActivityOwners(events));

  return (
    <main className="screen screen--tabbed">
      <header className="screen__header">
        {onBack !== undefined && (
          <button type="button" className="back-button" onClick={onBack}>
            ‹ {STRINGS.boardBackFromContacts}
          </button>
        )}
        <div className="today-header">
          <h1 className="screen__title">{STRINGS.peopleTitle}</h1>
          {/* Small header toggle so the closed "Thêm người" takes no row of its own. */}
          <button type="button" className="reminder-button" aria-expanded={addOpen} onClick={() => setShowAdd(!addOpen)}>
            {addOpen ? STRINGS.addPersonToggleClose : `+ ${STRINGS.addPersonToggleOpen}`}
          </button>
        </div>
        <p className="screen__prompt">{STRINGS.peoplePrompt}</p>
      </header>

      {pendingPairs > 0 && onOpenDuplicates !== undefined && (
        <button type="button" className="button button--secondary dup-entry" onClick={onOpenDuplicates}>
          {duplicatesEntryLabel(pendingPairs)}
        </button>
      )}

      {(addOpen || addedXp !== null || error !== null) && (
        <section className="card person-section" aria-label={STRINGS.addPersonTitle}>
          {addOpen && (
            <>
              <h2 className="person-section__heading">{STRINGS.addPersonTitle}</h2>
              <AddPersonForm people={people} onSubmit={addPerson} />
            </>
          )}
          {addedXp !== null && (
            <p className="message" role="status">
              {STRINGS.personAddedXp} · {xpLabel(addedXp)}
            </p>
          )}
          {error !== null && (
            <p className="message message--error" role="alert">
              {error}
            </p>
          )}
        </section>
      )}

      {allPeople.length > 0 && (
        <div className="search-field" role="search">
          <input
            className="note__input search-field__input"
            type="search"
            enterKeyHint="search"
            value={query}
            placeholder={STRINGS.searchPlaceholder}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            aria-label={STRINGS.searchLabel}
          />
        </div>
      )}

      <div className="filter-bar" role="group" aria-label={STRINGS.filterBarLabel}>
        {CONTACTS_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={f === filter ? 'chip chip--selected' : 'chip'}
            aria-pressed={f === filter}
            onClick={() => setFilter(f)}
          >
            {filterChipLabel(filterNames[f], counts[f])}
          </button>
        ))}
      </div>

      {inFilter.length > 0 && shown.length === 0 ? (
        <p className="message" role="status">
          {STRINGS.searchNoMatch}
        </p>
      ) : shown.length === 0 ? (
        <section className="card card--welcome">
          <h2 className="person-section__heading">{emptyText[filter].title}</h2>
          <p className="message">{emptyText[filter].body}</p>
        </section>
      ) : (
        <ul className="people-list">
          {shown.map((person) =>
            filter === 'archived' ? (
              <li key={person.personId} className="person-row person-row--static">
                <span className="person-row__main">
                  <span className="person-row__name">{person.name}</span>
                </span>
                <button
                  type="button"
                  className="button button--secondary person-row__action"
                  onClick={() => void restore(person.personId)}
                  disabled={restoringId !== null}
                >
                  {STRINGS.restore}
                </button>
              </li>
            ) : (
              <li key={person.personId}>
                <button type="button" className="person-row" onClick={() => setOpenId(person.personId)}>
                  <span className="person-row__main">
                    <span className="person-row__name">{person.name}</span>
                    {dupCodes.has(person.personId) && (
                      <span className="person-row__warn">{duplicateCodeWarning(duplicateCodeNames(dupCodes.get(person.personId) ?? []))}</span>
                    )}
                    {filter === 'kh' && person.lastContactAt !== undefined && (
                      <span className="person-row__stage">{lastContactLabel(person.lastContactAt)}</span>
                    )}
                    {filter === 'npp' && person.nppAt != null && (
                      <span className="person-row__stage">{nppSinceLabel(person.nppAt)}</span>
                    )}
                  </span>
                  {person.label != null && <LabelBadge label={person.label} />}
                </button>
              </li>
            ),
          )}
        </ul>
      )}

      {unassigned.length > 0 && (
        <section className="card person-section" aria-label={STRINGS.legacyTitle}>
          <h2 className="person-section__heading">{STRINGS.legacyTitle}</h2>
          <p className="message">{people.length === 0 ? STRINGS.legacyNoPeople : STRINGS.legacyPrompt}</p>
          <ul className="people-list">
            {unassigned.map(({ event, unknownOwner }) => (
              <LegacyActivityRow
                key={event.id}
                event={event}
                unknownOwner={unknownOwner}
                activityTypes={activityTypes}
                people={people}
                eventStore={eventStore}
                onAssigned={reload}
              />
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

interface LegacyActivityRowProps {
  readonly event: LogEvent;
  readonly unknownOwner: boolean;
  readonly activityTypes: readonly ActivityType[];
  readonly people: readonly Person[];
  readonly eventStore: EventStore;
  readonly onAssigned: () => Promise<void>;
}

/** One activity without an owner (or with a missing one) plus a person picker; reassigning keeps XP. */
function LegacyActivityRow({ event, unknownOwner, activityTypes, people, eventStore, onAssigned }: LegacyActivityRowProps) {
  const [personId, setPersonId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const typeId = event.payload.activityType;
  const typeName = activityTypes.find((t) => t.id === typeId)?.name ?? STRINGS.legacyUnknownActivity;

  async function assign(): Promise<void> {
    if (personId === '') return;
    setBusy(true);
    setError(false);
    try {
      await eventStore.append({ type: 'activity_reassigned', payload: { activityId: event.id, personId } });
      await onAssigned();
    } catch (e) {
      console.error('[people] reassign failed', e);
      setError(true);
      setBusy(false);
    }
  }

  return (
    <li className="legacy-row">
      <p className="legacy-row__title">
        <strong>{typeName}</strong> · {shortDateLabel(event.timestamp)}
        {unknownOwner && <span className="legacy-row__unknown"> · {STRINGS.legacyUnknownPerson}</span>}
      </p>
      <div className="button-row">
        <select
          className="select"
          value={personId}
          onChange={(e) => setPersonId(e.target.value)}
          disabled={busy || people.length === 0}
          aria-label={STRINGS.legacyPickPerson}
        >
          <option value="">{STRINGS.legacyPickPerson}</option>
          {people.map((p) => (
            <option key={p.personId} value={p.personId}>
              {p.name}
            </option>
          ))}
        </select>
        <button type="button" className="button button--secondary" onClick={() => void assign()} disabled={busy || personId === ''}>
          {STRINGS.legacyAssign}
        </button>
      </div>
      {error && (
        <p className="message message--error" role="alert">
          {STRINGS.personSaveError}
        </p>
      )}
    </li>
  );
}
