/**
 * Household 30x30 aggregate (story 027; design/gdd/crm.md Formulas, accounts.md rule 5).
 * Pure functions: the numbers the household shares with the server, and the "send only when
 * changed" decision. The network part lives in `src/data/aggregates-sync.ts`.
 */
import type { LogEvent } from '../data/event-store';
import { pendingDuplicates } from './duplicates';
import { computePeopleStats, derivePeople } from './people';
import type { PeopleConfig } from './people';

/** The household row as the app writes it to `household_aggregates` (server-only columns omitted). */
export interface AggregatePayload {
  readonly customers: number;
  readonly f1: number;
  readonly contacts: number;
  readonly achieved_30x30: boolean;
  readonly pending_duplicates: number;
}

/**
 * Builds the aggregate payload from the household book (the local log holds the household's
 * events once synced). Archived and merged-away contacts are not counted; a merged pair counts once.
 *
 * @example
 * const payload = buildAggregatePayload(await store.list(), PEOPLE_CONFIG); // { customers: 1, f1: 1, ... }
 */
export function buildAggregatePayload(events: readonly LogEvent[], config: PeopleConfig): AggregatePayload {
  const people = derivePeople(events, config);
  const stats = computePeopleStats(people, config);
  return {
    customers: stats.customers,
    f1: stats.f1,
    contacts: stats.contacts,
    achieved_30x30: stats.achieved,
    pending_duplicates: pendingDuplicates(people, events, config),
  };
}

/** True when `next` must be sent: nothing was sent yet, or any field differs from `last`. */
export function aggregatesChanged(last: AggregatePayload | null, next: AggregatePayload): boolean {
  return (
    last === null ||
    last.customers !== next.customers ||
    last.f1 !== next.f1 ||
    last.contacts !== next.contacts ||
    last.achieved_30x30 !== next.achieved_30x30 ||
    last.pending_duplicates !== next.pending_duplicates
  );
}

/** Reads a persisted payload back; null unless every field has the right type. */
export function parseAggregatePayload(raw: unknown): AggregatePayload | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;
  if (!isCount(r.customers) || !isCount(r.f1) || !isCount(r.contacts) || !isCount(r.pending_duplicates) || typeof r.achieved_30x30 !== 'boolean') return null;
  return { customers: r.customers, f1: r.f1, contacts: r.contacts, achieved_30x30: r.achieved_30x30, pending_duplicates: r.pending_duplicates };
}
