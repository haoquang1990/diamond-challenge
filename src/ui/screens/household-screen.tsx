import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import gameConfig from '../../config/game-config.json';
import { loadHousehold } from '../../data/account-service';
import type { HouseholdInfo } from '../../data/account-service';
import { STRINGS, householdCountLabel, householdFullNote } from '../strings';
import { AddMemberForm } from './add-member-form';

/** Props for {@link HouseholdScreen}. */
export interface HouseholdScreenProps {
  /** Lazy Supabase client (from `getSupabaseClient`). */
  readonly clientPromise: Promise<SupabaseClient>;
  /** Signed-in account id (the household is looked up through it). */
  readonly accountId: string;
  /** Back to Cài đặt. */
  readonly onBack: () => void;
}

/** Load state: `offline` and `error` show a short message instead of the household. */
type LoadState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'offline' }
  | { readonly kind: 'error' }
  | { readonly kind: 'ready'; readonly info: HouseholdInfo };

/**
 * Màn "Hộ của tôi" (story 025, no tab bar): the household's active Amway code ("Chưa có mã" when
 * none), the members (display name, else phone) with "x/max thành viên", and "Thêm vợ/chồng" while
 * there is room (a note when full; locked with a reason offline). Reads need the network.
 *
 * @example
 * <HouseholdScreen clientPromise={client} accountId={id} onBack={back} />
 */
export function HouseholdScreen({ clientPromise, accountId, onBack }: HouseholdScreenProps) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [online, setOnline] = useState(() => navigator.onLine);
  const [adding, setAdding] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
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
    if (!online) {
      setState({ kind: 'offline' });
      return;
    }
    let cancelled = false;
    clientPromise
      .then((client) => loadHousehold(client, accountId, gameConfig.maxHouseholdMembers))
      .then((info) => {
        if (!cancelled) setState(info === null ? { kind: 'error' } : { kind: 'ready', info });
      })
      .catch((error: unknown) => {
        console.error('[household] could not read the household', error);
        if (!cancelled) setState({ kind: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [clientPromise, accountId, online, reloadKey]);

  if (adding) {
    const householdId = state.kind === 'ready' ? state.info.householdId : null;
    return (
      <AddMemberForm
        clientPromise={clientPromise}
        {...(householdId === null ? {} : { householdId })}
        onAdded={reload}
        onClose={() => setAdding(false)}
      />
    );
  }

  return (
    <main className="screen">
      <header className="screen__header">
        <button type="button" className="back-button" onClick={onBack}>
          {STRINGS.back}
        </button>
        <h1 className="screen__title">{STRINGS.householdTitle}</h1>
        <p className="screen__prompt">{STRINGS.householdPrompt}</p>
      </header>

      {state.kind === 'loading' && (
        <p className="message" role="status">
          {STRINGS.loading}
        </p>
      )}
      {state.kind === 'offline' && (
        <section className="card form">
          <p className="message" role="status">
            {STRINGS.householdOffline}
          </p>
          <button type="button" className="button button--primary" disabled>
            {STRINGS.addMemberButton}
          </button>
          <p className="message">{STRINGS.addMemberOfflineReason}</p>
        </section>
      )}
      {state.kind === 'error' && (
        <div className="card">
          <p className="message message--error" role="alert">
            {STRINGS.householdLoadError}
          </p>
          <button type="button" className="button button--secondary" onClick={reload}>
            {STRINGS.retry}
          </button>
        </div>
      )}
      {state.kind === 'ready' && (
        <>
          {state.info.householdId === null ? (
            <p className="message">{STRINGS.householdNoHousehold}</p>
          ) : (
            <>
              <section className="card form" aria-labelledby="household-code-title">
                <h2 id="household-code-title" className="card__title">
                  {STRINGS.householdCodeLabel}
                </h2>
                <p className="account-name">{state.info.code ?? STRINGS.householdNoCode}</p>
              </section>
              <section className="card form" aria-labelledby="household-members-title">
                <h2 id="household-members-title" className="card__title">
                  {STRINGS.householdMembersHeading}
                </h2>
                <p className="card__body">{householdCountLabel(state.info.members.length, state.info.maxMembers)}</p>
                <ul className="member-list">
                  {state.info.members.map((m) => (
                    <li key={m.userId} className="member-list__item">
                      {m.displayName ?? m.phone ?? STRINGS.householdMemberUnnamed}
                    </li>
                  ))}
                </ul>
                {state.info.members.length < state.info.maxMembers ? (
                  <>
                    <button type="button" className="button button--primary" onClick={() => setAdding(true)} disabled={!online}>
                      {STRINGS.addMemberButton}
                    </button>
                    {!online && <p className="message">{STRINGS.addMemberOfflineReason}</p>}
                  </>
                ) : (
                  <p className="message">{householdFullNote(state.info.maxMembers)}</p>
                )}
              </section>
            </>
          )}
        </>
      )}
    </main>
  );
}
