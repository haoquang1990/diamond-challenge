import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { HouseholdMember } from '../../data/contact-sync';
import type { EventStore, LogEvent } from '../../data/event-store';
import { otherMemberIds } from '../../domain/progress';
import { pendingDuplicates } from '../../domain/duplicates';
import { deriveActivityOwners, derivePeople } from '../../domain/people';
import type { Person, PersonPhone } from '../../domain/people';
import { ACTIVITY_TYPES } from '../activity-types';
import type { ActivityType } from '../activity-types';
import { CONTACT_STALE_DAYS, PEOPLE_CONFIG } from '../people-config';
import {
  CONTACTS_FILTERS,
  CONTACT_SORTS,
  DEFAULT_CONTACT_SORT,
  NPP_ONLY_SORTS,
  calendarDaysSince,
  countContacts,
  readContactSort,
  sortContacts,
  duplicateCodeNames,
  filterContacts,
  findDuplicateCodes,
  historyAuthorLabel,
  listUnassignedActivities,
  searchPeopleByName,
} from '../people-helpers';
import type { ContactSort, ContactsFilter } from '../people-helpers';
import { STRINGS, contactDaysAria, contactSortAria, duplicateCodeWarning, duplicatesEntryLabel, f1RowAria, filterChipLabel, shortDateLabel, xpLabel } from '../strings';
import { AddPersonForm, Dialog, LabelBadge, PersonDetail } from './person-form';
import type { HouseholdProgress } from '../group-helpers';

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
  /** Extra section for an opened person (story 042: "Hộ F1" for an NPP contact); nothing when it returns null. */
  readonly renderPersonExtra?: (person: Person) => ReactNode;
  /** F1 household progress by Amway code (story 044); adds XP sorting and numbers to the NPP chip. */
  readonly nppProgress?: ReadonlyMap<string, HouseholdProgress>;
  /** The F1 account linked to a contact (story 059): name it set and login phone, null when unknown. */
  readonly linkedAccountFor?: (userId: string) => { readonly displayName: string | null; readonly phone: string | null } | null;
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
 * add form, name search, filter chips (Tất cả / Khách hàng / NPP; Lưu trữ removed in story 043)
 * over one derived list, person detail (where tasks are completed) and the section for
 * activities not yet linked to a person. The search narrows the rows of the active chip; chip counts stay
 * the per-filter totals and ignore the search. Re-reads the event log on
 * mount and after every write; keeps no copy of truth.
 */
export function PeopleScreen({ eventStore, activityTypes = ACTIVITY_TYPES, initialFilter = 'all', onBack, members = null, memberIds = NO_MEMBERS, dataVersion = 0, initialOpenId = null, onCreateAccount, onOpenDuplicates, renderPersonExtra, nppProgress, linkedAccountFor }: PeopleScreenProps) {
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' });
  const [openId, setOpenId] = useState<string | null>(initialOpenId);
  const [addedXp, setAddedXp] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ContactsFilter>(initialFilter);
  /** Story 052: the sort sheet is open. */
  const [sortOpen, setSortOpen] = useState(false);
  /** null = automatic: open while the list is empty, collapsed once there are people. */
  const [showAdd, setShowAdd] = useState<boolean | null>(null);
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
        extra={renderPersonExtra?.(opened) ?? null}
        linkedAccount={opened.linkedUserId == null ? null : (linkedAccountFor?.(opened.linkedUserId) ?? null)}
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
    // The person is saved: collapse "Thêm người" (crm rule 12, 2026-11-22). An empty book never
    // gets here with zero people, so it still opens automatically.
    setShowAdd(false);
  }

  const dupCodes = findDuplicateCodes(people);
  const counts = countContacts(allPeople);
  const listed = filterContacts(allPeople, filter);
  // Story 052: my chosen order (synced with my account); an NPP-only order outside NPP falls back.
  const chosenSort = readContactSort(events, others);
  const sortOptions = CONTACT_SORTS.filter((k) => filter === 'npp' || !NPP_ONLY_SORTS.includes(k)).filter((k) => nppProgress !== undefined || (k !== 'xpTotal' && k !== 'xp7d'));
  const activeSort: ContactSort = sortOptions.includes(chosenSort) ? chosenSort : DEFAULT_CONTACT_SORT;
  const inFilter = sortContacts(listed, allPeople, activeSort, nppProgress);
  const now = new Date();
  const chooseSort = async (key: ContactSort) => {
    setSortOpen(false);
    if (key === chosenSort) return;
    try {
      await eventStore.append({ type: 'settings_changed', payload: { contactSort: key } });
      await reload();
    } catch (e) {
      console.error('[people] could not save the sort', e);
      setError(STRINGS.personSaveError);
    }
  };
  const shown = searchPeopleByName(inFilter, query);
  const filterNames: Record<ContactsFilter, string> = {
    all: STRINGS.filterAll,
    kh: STRINGS.filterKh,
    npp: STRINGS.filterNpp,
  };
  const emptyText: Record<ContactsFilter, { title: string; body: string }> = {
    all: { title: STRINGS.emptyAllTitle, body: STRINGS.peopleEmptyBody },
    kh: { title: STRINGS.filterKh, body: STRINGS.emptyKhBody },
    npp: { title: STRINGS.filterNpp, body: STRINGS.emptyNppBody },
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
          {/* Filter as a dropdown in the header (2026-11-24): the list starts higher on the phone. */}
          <label className="filter-select">
            <span className="visually-hidden">{STRINGS.filterBarLabel}</span>
            <select value={filter} onChange={(e) => setFilter(e.target.value as ContactsFilter)} aria-label={STRINGS.filterBarLabel}>
              {CONTACTS_FILTERS.map((f) => (
                <option key={f} value={f}>
                  {filterChipLabel(filterNames[f], counts[f])}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {pendingPairs > 0 && onOpenDuplicates !== undefined && (
        <button type="button" className="button button--secondary dup-entry" onClick={onOpenDuplicates}>
          {duplicatesEntryLabel(pendingPairs)}
        </button>
      )}

      {/* "Đã thêm người · +XP" is not repeated here: the XP popup already shows it (2026-11-26). */}
      {(addOpen || error !== null) && (
        <section className="card person-section" aria-label={STRINGS.addPersonTitle}>
          {addOpen && (
            <>
              <h2 className="person-section__heading">{STRINGS.addPersonTitle}</h2>
              <AddPersonForm people={people} onSubmit={addPerson} />
            </>
          )}
          {error !== null && (
            <p className="message message--error" role="alert">
              {error}
            </p>
          )}
        </section>
      )}

      <div className="search-row">
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
        {allPeople.length > 0 && (
          <button
            type="button"
            className="icon-button"
            aria-haspopup="dialog"
            aria-label={contactSortAria(STRINGS.contactSortNames[activeSort])}
            title={contactSortAria(STRINGS.contactSortNames[activeSort])}
            onClick={() => setSortOpen(true)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4" />
            </svg>
          </button>
        )}
        <button
          type="button"
          className={addOpen ? 'icon-button icon-button--open' : 'icon-button'}
          aria-expanded={addOpen}
          aria-label={addOpen ? STRINGS.addPersonToggleClose : STRINGS.addPersonToggleOpen}
          title={addOpen ? STRINGS.addPersonToggleClose : STRINGS.addPersonToggleOpen}
          onClick={() => setShowAdd(!addOpen)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            {addOpen ? <path d="M6 6l12 12M18 6 6 18" /> : <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6" /><path d="M22 11h-6" /></>}
          </svg>
        </button>
      </div>

      {sortOpen && (
        <Dialog title={STRINGS.contactSortTitle} onClose={() => setSortOpen(false)} variant="sheet">
          <ul className="sort-options">
            {sortOptions.map((key, i) => (
              <li key={key}>
                {i > 0 && NPP_ONLY_SORTS.includes(key) && !NPP_ONLY_SORTS.includes(sortOptions[i - 1] as ContactSort) && <p className="sort-options__group">{STRINGS.contactSortNppGroup}</p>}
                <button type="button" className={key === activeSort ? 'sort-option sort-option--on' : 'sort-option'} aria-pressed={key === activeSort} onClick={() => void chooseSort(key)}>
                  <span className="sort-option__text">
                    <span className="sort-option__name">{STRINGS.contactSortNames[key]}</span>
                    {STRINGS.contactSortHints[key] !== '' && <span className="sort-option__hint">{STRINGS.contactSortHints[key]}</span>}
                  </span>
                  {key === activeSort && <span aria-hidden="true">✓</span>}
                </button>
              </li>
            ))}
          </ul>
        </Dialog>
      )}

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
              <li key={person.personId}>
                <button type="button" className="person-row" onClick={() => setOpenId(person.personId)}>
                  <span className="person-row__main">
                    <span className="person-row__name">{person.name}</span>
                    {dupCodes.has(person.personId) && (
                      <span className="person-row__warn">{duplicateCodeWarning(duplicateCodeNames(dupCodes.get(person.personId) ?? []))}</span>
                    )}
                    {(() => {
                      // Story 060: an F1 NPP shows today's goal and its streak under the name, in every filter.
                      const f1 = person.label === 'NPP' && person.amwayCode != null ? nppProgress?.get(person.amwayCode) : undefined;
                      if (f1 === undefined) return null;
                      return (
                        <span className="person-row__f1" aria-label={f1RowAria(f1.goalToday === true, f1.streak)}>
                          <span className={f1.goalToday === true ? 'goal-dot goal-dot--ok' : 'goal-dot'} aria-hidden="true">
                            {f1.goalToday === true ? '✓' : ''}
                          </span>
                          <span className={f1.streak > 0 ? 'streak-mark' : 'streak-mark streak-mark--zero'} aria-hidden="true">
                            🔥{f1.streak}
                          </span>
                        </span>
                      );
                    })()}
                  </span>
                  {person.label != null && <LabelBadge label={person.label} />}
                  {(() => {
                    const days = calendarDaysSince(person.lastContactAt ?? null, now);
                    const cls = days === null ? 'person-row__days person-row__days--none' : days >= CONTACT_STALE_DAYS ? 'person-row__days person-row__days--stale' : 'person-row__days';
                    return (
                      <span className={cls} aria-label={contactDaysAria(days)} title={contactDaysAria(days)}>
                        {days !== null && (
                          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                            <circle cx="12" cy="12" r="9" />
                            <path d="M12 7v5l3 2" />
                          </svg>
                        )}
                        <span aria-hidden="true">{days === null ? '—' : days}</span>
                      </span>
                    );
                  })()}
                </button>
              </li>
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
