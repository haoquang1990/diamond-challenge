import { useState } from 'react';
import type { FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import gameConfig from '../../config/game-config.json';
import { signInWithPhone } from '../../data/auth-service';
import type { AccountInfo } from '../../data/auth-service';
import { authFailureText, STRINGS } from '../strings';

/** Props for {@link LoginScreen}. */
export interface LoginScreenProps {
  /** Lazy Supabase client (from `getSupabaseClient`). */
  readonly clientPromise: Promise<SupabaseClient>;
  /** "Quay lại": back to Cài đặt without signing in. */
  readonly onBack: () => void;
  /** Called after a successful sign-in with the account and the password typed (kept in memory only, to compare with the new one). */
  readonly onSignedIn: (account: AccountInfo, password: string) => void;
}

const DEFAULT_COUNTRY = '+84';

/**
 * Màn Đăng nhập: country code (`countryCodes` in game-config.json) + phone + password.
 * The submit button is disabled while a request is in flight. Failures show one
 * Vietnamese message that does not reveal whether the phone exists.
 *
 * @example
 * <LoginScreen clientPromise={client} onBack={back} onSignedIn={handleSignedIn} />
 */
export function LoginScreen({ clientPromise, onBack, onSignedIn }: LoginScreenProps) {
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (password === '') {
      setError(STRINGS.loginPasswordRequired);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await signInWithPhone(await clientPromise, { countryCode: country, number: phone, password });
      if (result.ok) {
        onSignedIn(result.account, password);
        return;
      }
      setError(authFailureText(result.reason));
    } catch (err) {
      console.error('[login] sign-in failed', err);
      setError(authFailureText('network'));
    }
    setBusy(false);
  };

  return (
    <main className="screen">
      <header className="screen__header">
        <button type="button" className="back-button" onClick={onBack}>
          {STRINGS.back}
        </button>
        <h1 className="screen__title">{STRINGS.loginTitle}</h1>
        <p className="screen__prompt">{STRINGS.loginPrompt}</p>
      </header>

      <form className="card form" onSubmit={(e) => void onSubmit(e)} noValidate>
        <div className="form__row">
          <label className="form__field">
            <span className="form__label">{STRINGS.loginCountryLabel}</span>
            <select className="select" value={country} onChange={(e) => setCountry(e.target.value)} disabled={busy}>
              {gameConfig.countryCodes.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form__field">
            <span className="form__label">{STRINGS.loginPhoneLabel}</span>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              className="note__input form__input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={busy}
            />
          </label>
        </div>
        <label className="form__field">
          <span className="form__label">{STRINGS.loginPasswordLabel}</span>
          <input
            type="password"
            autoComplete="current-password"
            className="note__input form__input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
          />
        </label>
        {error !== null && (
          <p className="message message--error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="button button--primary" disabled={busy}>
          {busy ? STRINGS.loginSubmitting : STRINGS.loginSubmit}
        </button>
      </form>
    </main>
  );
}
