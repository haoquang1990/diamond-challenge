import { useState } from 'react';
import type { FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { claimHouseholdCode } from '../../data/account-service';
import { STRINGS } from '../strings';

/** Props for {@link CodeRequiredScreen}. */
export interface CodeRequiredScreenProps {
  readonly clientPromise: Promise<SupabaseClient>;
  /** The household now has its code (also when a spouse set it meanwhile). */
  readonly onSaved: () => void;
  /** A claim waits for the admin; the app is usable meanwhile. */
  readonly onPending: () => void;
  readonly onSignOut: () => void;
}

/**
 * "Mã số Amway của bạn" (story 068): shown once after sign-in when my household has no active
 * code. A free code is saved; one that another account holds becomes a claim for the admin.
 */
export function CodeRequiredScreen({ clientPromise, onSaved, onPending, onSignOut }: CodeRequiredScreenProps) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<'edit' | 'taken' | 'sent'>('edit');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = await claimHouseholdCode(await clientPromise, code);
    setBusy(false);
    if (r === 'saved' || r === 'already_set') onSaved();
    else if (r === 'taken') setState('taken');
    else if (r === 'invalid') setError(STRINGS.amwayCodeInvalid);
    else if (r === 'no_household') onSaved();
    else setError(STRINGS.codeRequiredError);
  };

  return (
    <main className="screen">
      <header className="screen__header">
        <h1 className="screen__title">{STRINGS.codeRequiredTitle}</h1>
      </header>
      {state === 'sent' ? (
        <section className="card form">
          <p className="code-required__sent" role="status">
            {STRINGS.codeRequiredSent}
          </p>
          <button type="button" className="button button--primary" onClick={onPending}>
            {STRINGS.codeRequiredContinue}
          </button>
        </section>
      ) : (
        <form className="card form" onSubmit={(e) => void onSubmit(e)} noValidate>
          <p className="card__body">{STRINGS.codeRequiredBody}</p>
          <label className="form__field">
            <span className="form__label">{STRINGS.codeRequiredLabel}</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className={state === 'taken' || error !== null ? 'note__input form__input code-required__input code-required__input--error' : 'note__input form__input code-required__input'}
              placeholder={STRINGS.amwayCodePlaceholder}
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setError(null);
                if (state === 'taken') setState('edit');
              }}
              disabled={busy}
            />
          </label>
          {state === 'taken' && (
            <p className="message message--error" role="alert">
              {STRINGS.codeRequiredTaken}
            </p>
          )}
          {error !== null && (
            <p className="message message--error" role="alert">
              {error}
            </p>
          )}
          {state === 'taken' ? (
            <>
              <button type="button" className="button button--primary" onClick={() => setState('sent')}>
                {STRINGS.codeRequiredSendAdmin}
              </button>
              <button type="button" className="button button--secondary" onClick={() => setState('edit')}>
                {STRINGS.codeRequiredRetry}
              </button>
            </>
          ) : (
            <button type="submit" className="button button--primary" disabled={busy || code.trim() === ''}>
              {STRINGS.codeRequiredSave}
            </button>
          )}
          <p className="message">{STRINGS.codeRequiredCouple}</p>
          <button type="button" className="button button--secondary" onClick={onSignOut} disabled={busy}>
            {STRINGS.accountSignOut}
          </button>
        </form>
      )}
    </main>
  );
}
