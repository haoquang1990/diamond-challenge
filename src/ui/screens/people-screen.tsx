import { useCallback, useEffect, useState } from 'react';
import type { EventStore, LogEvent } from '../../data/event-store';
import { deriveActivityOwners, derivePeople } from '../../domain/people';
import type { Person } from '../../domain/people';
import { ACTIVITY_TYPES } from '../activity-types';
import type { ActivityType } from '../activity-types';
import { PEOPLE_CONFIG } from '../people-config';
import { groupPeopleByStage, listUnassignedActivities } from '../people-helpers';
import { playTing } from '../play-ting';
import { STRINGS, shortDateLabel, stageGroupLabel, xpLabel } from '../strings';
import { AddPersonForm, PersonDetail } from './person-form';

/** Props for {@link PeopleScreen}. */
export interface PeopleScreenProps {
  /** Event log everything is derived from (injected). */
  readonly eventStore: EventStore;
  /** Activity types, used for the add_name XP and legacy row names; defaults to game-config.json. */
  readonly activityTypes?: readonly ActivityType[];
}

type LoadState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error' }
  | { readonly kind: 'ready'; readonly events: readonly LogEvent[] };

/** Id of the activity type that gives XP for adding a person. */
const ADD_NAME_ACTIVITY_ID = 'add_name';

/**
 * Tab "Người": non-archived people grouped by stage, add form, person detail
 * and the section for activities not yet linked to a person. Re-reads the
 * event log on mount and after every write; keeps no copy of truth.
 */
export function PeopleScreen({ eventStore, activityTypes = ACTIVITY_TYPES }: PeopleScreenProps) {
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' });
  const [openId, setOpenId] = useState<string | null>(null);
  const [addedXp, setAddedXp] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  }, [reload]);

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
        config={PEOPLE_CONFIG}
        onChanged={reload}
        onBack={() => setOpenId(null)}
      />
    );
  }

  const addNameType = activityTypes.find((t) => t.id === ADD_NAME_ACTIVITY_ID);

  async function addPerson(name: string, note: string): Promise<void> {
    setError(null);
    const personId = crypto.randomUUID();
    await eventStore.append({ type: 'person_added', payload: { personId, name, ...(note === '' ? {} : { note }) } });
    if (addNameType !== undefined) {
      try {
        await eventStore.append({
          type: 'activity_logged',
          payload: { activityType: addNameType.id, xp: addNameType.xp, personId },
        });
        playTing();
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

  const groups = groupPeopleByStage(people, PEOPLE_CONFIG);
  const unassigned = listUnassignedActivities(events, deriveActivityOwners(events));

  return (
    <main className="screen screen--tabbed">
      <header className="screen__header">
        <h1 className="screen__title">{STRINGS.peopleTitle}</h1>
        <p className="screen__prompt">{STRINGS.peoplePrompt}</p>
      </header>

      <section className="card person-section" aria-label={STRINGS.addPersonTitle}>
        <h2 className="person-section__heading">{STRINGS.addPersonTitle}</h2>
        <AddPersonForm people={people} onSubmit={addPerson} />
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

      {people.length === 0 ? (
        <section className="card card--welcome">
          <h2 className="person-section__heading">{STRINGS.peopleEmptyTitle}</h2>
          <p className="message">{STRINGS.peopleEmptyBody}</p>
        </section>
      ) : (
        groups.map(({ stage, people: inStage }) => (
          <section key={stage.id} className="people-group" aria-label={stage.name}>
            <h2 className="people-group__heading">{stageGroupLabel(stage.name, inStage.length)}</h2>
            <ul className="people-list">
              {inStage.map((person) => (
                <li key={person.personId}>
                  <button type="button" className="person-row" onClick={() => setOpenId(person.personId)}>
                    <span className="person-row__name">{person.name}</span>
                    <span className="person-row__stage">{stage.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
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
