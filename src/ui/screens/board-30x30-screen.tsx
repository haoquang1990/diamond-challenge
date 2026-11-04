import { useCallback, useEffect, useState } from 'react';
import type { EventStore } from '../../data/event-store';
import { computePeopleStats, derivePeople } from '../../domain/people';
import type { PeopleStats } from '../../domain/people';
import { PEOPLE_CONFIG } from '../people-config';
import type { ContactsFilter } from '../people-helpers';
import { STRINGS, boardCountLabel, boardMissingLabel } from '../strings';

/** Props for {@link Board30x30Screen}. */
export interface Board30x30ScreenProps {
  /** Event log the board is derived from (read only, injected). */
  readonly eventStore: EventStore;
  /** Returns to the previous screen (Con đường). */
  readonly onBack: () => void;
  /** Opens the Người screen; the empty state shows a button only when provided. */
  readonly onOpenPeople?: () => void;
  /** Opens Danh bạ filtered to a label; the Khách hàng and NPP F1 rows are buttons only when provided. */
  readonly onOpenContacts?: (filter: ContactsFilter) => void;
}

type LoadState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error' }
  | { readonly kind: 'ready'; readonly stats: PeopleStats; readonly isEmpty: boolean };

/** Fill ratio in percent, clamped to 0..100; a non-positive target counts as 0. */
function percentOf(count: number, target: number): number {
  return target > 0 ? Math.round(Math.min(count / target, 1) * 100) : 0;
}

interface RowProps {
  readonly label: string;
  readonly count: number;
  readonly target: number;
  readonly met?: boolean;
  /** When set the row is a button (>=44px) with a chevron. */
  readonly onOpen?: () => void;
}

function ProgressRow({ label, count, target, met = false, onOpen }: RowProps) {
  const text = boardCountLabel(label, count, target);
  const percent = percentOf(count, target);
  const labelNode = (
    <>
      <span className="board-row__label">
        {text}
        {met && (
          <span className="board-row__check">
            {' '}
            ✓ {STRINGS.boardContactsMet}
          </span>
        )}
      </span>
    </>
  );
  return (
    <div className="board-row">
      {onOpen === undefined ? (
        <p className="board-row__label">{labelNode}</p>
      ) : (
        <button type="button" className="board-row__button" onClick={onOpen} aria-label={`${STRINGS.boardOpenContactsHint}: ${text}`}>
          {labelNode}
          <span className="board-row__chevron" aria-hidden="true">
            ›
          </span>
        </button>
      )}
      <div
        className="xp-bar"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={Math.min(count, target)}
        aria-valuetext={text}
      >
        <div className="xp-bar__fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

/**
 * Bảng 30x30: contacts, customers and NPP F1 against the configured targets.
 * Read only: re-derives from the event log on every mount and never appends.
 */
export function Board30x30Screen({ eventStore, onBack, onOpenPeople, onOpenContacts }: Board30x30ScreenProps) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const retry = useCallback(() => {
    setState({ kind: 'loading' });
    setReloadKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    eventStore
      .list()
      .then((events) => {
        if (cancelled) return;
        const people = derivePeople(events, PEOPLE_CONFIG);
        const stats = computePeopleStats(people, PEOPLE_CONFIG);
        setState({ kind: 'ready', stats, isEmpty: people.every((p) => p.archived) });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error('[board] failed to read the event log', error);
        setState({ kind: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [eventStore, reloadKey]);

  const { contactsTarget, customersTarget, f1Target } = PEOPLE_CONFIG.targets;

  return (
    <main className="screen">
      <header className="screen__header">
        <button type="button" className="back-button" onClick={onBack}>
          {STRINGS.back}
        </button>
        <h1 className="screen__title">{STRINGS.boardTitle}</h1>
        <p className="screen__prompt">{STRINGS.boardPrompt}</p>
      </header>

      {state.kind === 'loading' && (
        <p className="message" role="status">
          {STRINGS.loading}
        </p>
      )}
      {state.kind === 'error' && (
        <div className="card">
          <p className="message message--error" role="alert">
            {STRINGS.boardLoadError}
          </p>
          <button type="button" className="button button--secondary" onClick={retry}>
            {STRINGS.retry}
          </button>
        </div>
      )}

      {state.kind === 'ready' && (
        <>
          {state.isEmpty && (
            <section className="card card--welcome">
              <p className="message">{STRINGS.boardEmptyBody}</p>
              {onOpenPeople !== undefined && (
                <button type="button" className="button button--primary" onClick={onOpenPeople}>
                  {STRINGS.boardGoPeople}
                </button>
              )}
            </section>
          )}

          <section className="card">
            <ProgressRow label={STRINGS.boardContacts} count={state.stats.contacts} target={contactsTarget} met={state.stats.contactsMet} />
            <ProgressRow
              label={STRINGS.boardCustomers}
              count={state.stats.customers}
              target={customersTarget}
              onOpen={onOpenContacts === undefined ? undefined : () => onOpenContacts('kh')}
            />
            <ProgressRow
              label={STRINGS.boardF1}
              count={state.stats.f1}
              target={f1Target}
              onOpen={onOpenContacts === undefined ? undefined : () => onOpenContacts('npp')}
            />
          </section>

          {state.stats.achieved ? (
            <p className="board-badge board-badge--achieved" role="status">
              ◆ {STRINGS.boardAchieved}
            </p>
          ) : (
            <p className="board-badge">
              {boardMissingLabel(
                Math.max(customersTarget - state.stats.customers, 0),
                Math.max(f1Target - state.stats.f1, 0),
              )}
            </p>
          )}
        </>
      )}

      <p className="board-note">{STRINGS.boardDisclaimer}</p>
    </main>
  );
}
