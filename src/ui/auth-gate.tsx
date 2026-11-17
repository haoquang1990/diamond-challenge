import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { App } from '../app';
import { SUPABASE_CONFIG, getSupabaseClient } from '../config/supabase';
import { clearDeviceAccount, deleteAccountStore, prepareAccountStore, readDeviceAccount, updateDeviceAccount, LEGACY_DB_NAME } from '../data/account-stores';
import { loadAccount } from '../data/auth-service';
import type { AccountInfo } from '../data/auth-service';
import { IndexedDbEventStore } from '../data/indexeddb-event-store';
import { LoginScreen } from './screens/login-screen';
import { STRINGS } from './strings';

/**
 * localStorage key under which supabase-js persists its session (`sb-<project ref>-auth-token`).
 * Present means the refresh token is still stored: supabase-js removes it on sign-out and on a
 * refresh the server rejected, and keeps it when a refresh only failed for lack of network.
 */
function hasStoredSupabaseSession(): boolean {
  try {
    if (SUPABASE_CONFIG === null) return false;
    const ref = new URL(SUPABASE_CONFIG.url).hostname.split('.')[0];
    return localStorage.getItem(`sb-${ref}-auth-token`) !== null;
  } catch {
    return false;
  }
}

/**
 * Finds the signed-in account at start. Online (or with a still-valid token) supabase-js
 * returns the session. A refresh that fails for lack of network returns no session although
 * the stored session survives, so when there is none we fall back to the cached last account
 * if supabase-js still holds its stored session: the user is NOT logged out by being offline.
 */
async function restoreAccount(client: SupabaseClient): Promise<AccountInfo | null> {
  const cached = readDeviceAccount();
  let account: AccountInfo | null = null;
  try {
    account = await loadAccount(client);
  } catch (error) {
    console.error('[auth] could not read the session', error);
  }
  if (account !== null) {
    if (account.displayName === null && cached?.accountId === account.accountId && !navigator.onLine) {
      return { ...account, displayName: cached.displayName };
    }
    return account;
  }
  if (cached !== null && hasStoredSupabaseSession()) {
    return { accountId: cached.accountId, phone: cached.phone, displayName: cached.displayName, mustChangePassword: false };
  }
  return null;
}

type Phase =
  | { readonly kind: 'restoring' }
  | { readonly kind: 'signed-out' }
  | { readonly kind: 'opening'; readonly account: AccountInfo; readonly temporaryPassword: string | null; readonly attempt: number }
  | { readonly kind: 'open-error'; readonly account: AccountInfo; readonly temporaryPassword: string | null }
  | { readonly kind: 'ready'; readonly account: AccountInfo; readonly temporaryPassword: string | null; readonly store: IndexedDbEventStore };

function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

function GateMessage({ text, retry }: { readonly text: string; readonly retry?: () => void }) {
  return (
    <div className="app-shell">
      <main className="screen gate-screen">
        <p className="message" role="status">
          {text}
        </p>
        {retry !== undefined && (
          <button type="button" className="button button--primary" onClick={retry}>
            {STRINGS.retry}
          </button>
        )}
      </main>
    </div>
  );
}

/**
 * Login gate (story 030). With Supabase configured the app shows ONLY the Login screen until
 * there is a session; then it opens that account's own store (migrating the legacy shared
 * store once) and renders {@link App} keyed by the account, so no state leaks between accounts.
 * Without Supabase config (dev/tests) it renders App on the legacy store, as before.
 */
export function AuthGate() {
  const clientPromise = useMemo(() => getSupabaseClient(), []);
  const legacyStore = useMemo(() => (clientPromise === null ? new IndexedDbEventStore(LEGACY_DB_NAME) : null), [clientPromise]);
  const [phase, setPhase] = useState<Phase>({ kind: 'restoring' });
  const online = useOnline();

  // Restore the session, and return to the Login screen if it ends (sign-out, revoked refresh token).
  useEffect(() => {
    if (clientPromise === null) return;
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    void clientPromise
      .then(async (client) => {
        const account = await restoreAccount(client);
        if (cancelled) return;
        setPhase(account === null ? { kind: 'signed-out' } : { kind: 'opening', account, temporaryPassword: null, attempt: 0 });
        const { data } = client.auth.onAuthStateChange((event) => {
          if (event === 'SIGNED_OUT') setPhase({ kind: 'signed-out' });
        });
        unsubscribe = () => data.subscription.unsubscribe();
        if (cancelled) unsubscribe();
      })
      .catch((error: unknown) => {
        console.error('[auth] could not restore the session', error);
        if (!cancelled) setPhase({ kind: 'signed-out' });
      });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [clientPromise]);

  const openingAccount = phase.kind === 'opening' ? phase.account : null;
  const attempt = phase.kind === 'opening' ? phase.attempt : 0;
  useEffect(() => {
    if (openingAccount === null) return;
    let cancelled = false;
    updateDeviceAccount(openingAccount.accountId, {
      phone: openingAccount.phone,
      ...(openingAccount.displayName === null ? {} : { displayName: openingAccount.displayName }),
    });
    prepareAccountStore(openingAccount.accountId)
      .then(({ store }) => {
        if (!cancelled) setPhase((p) => (p.kind === 'opening' ? { kind: 'ready', account: p.account, temporaryPassword: p.temporaryPassword, store } : p));
      })
      .catch((error: unknown) => {
        console.error('[account-stores] could not open the account store', error);
        if (!cancelled) setPhase((p) => (p.kind === 'opening' ? { kind: 'open-error', account: p.account, temporaryPassword: p.temporaryPassword } : p));
      });
    return () => {
      cancelled = true;
    };
  }, [openingAccount, attempt]);

  const onSignedOut = useCallback(() => setPhase({ kind: 'signed-out' }), []);
  const onEraseDevice = useCallback(async (accountId: string): Promise<boolean> => {
    try {
      await deleteAccountStore(accountId);
      clearDeviceAccount();
      return true;
    } catch (error) {
      console.error('[account-stores] could not erase the account store', error);
      return false;
    }
  }, []);

  if (clientPromise === null) {
    return legacyStore === null ? null : <App eventStore={legacyStore} />;
  }
  switch (phase.kind) {
    case 'restoring':
      return <GateMessage text={STRINGS.sessionRestoring} />;
    case 'signed-out':
      return (
        <div className="app-shell">
          <LoginScreen
            clientPromise={clientPromise}
            needsNetwork={!online && readDeviceAccount() === null}
            onSignedIn={(account, password) =>
              setPhase({ kind: 'opening', account, temporaryPassword: account.mustChangePassword ? password : null, attempt: 0 })
            }
          />
        </div>
      );
    case 'opening':
      return <GateMessage text={STRINGS.storeOpening} />;
    case 'open-error':
      return (
        <GateMessage
          text={STRINGS.storeOpenError}
          retry={() => setPhase({ kind: 'opening', account: phase.account, temporaryPassword: phase.temporaryPassword, attempt: Date.now() })}
        />
      );
    case 'ready':
      return (
        <App
          key={phase.account.accountId}
          eventStore={phase.store}
          session={{ account: phase.account, temporaryPassword: phase.temporaryPassword, onSignedOut, onEraseDevice }}
        />
      );
  }
}
