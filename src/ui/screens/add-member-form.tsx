import { useState } from 'react';
import type { FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizePhone } from '../../../supabase/functions/_shared/phone';
import { addHouseholdMember, generateTempPassword } from '../../data/account-service';
import { validateDisplayName } from '../../data/auth-service';
import { validatePhone } from '../../domain/people';
import { COUNTRY_CODES, PEOPLE_CONFIG } from '../people-config';
import { STRINGS } from '../strings';
import { TempPasswordView } from './temp-password-view';

/** Props for {@link AddMemberForm}. */
export interface AddMemberFormProps {
  /** Lazy Supabase client (from `getSupabaseClient`). */
  readonly clientPromise: Promise<SupabaseClient>;
  /** Target household passed to the Edge Function; omitted = the caller's own household (story 028 passes an F1 household). */
  readonly householdId?: string;
  /** Called once after the member was added (refresh the member list). */
  readonly onAdded: () => void;
  /** Leaves the form (back to the household screen). */
  readonly onClose: () => void;
}

/** What the success view shows. Lives only in this component's state. */
interface Added {
  readonly phone: string;
  readonly password: string;
}

const DEFAULT_COUNTRY = COUNTRY_CODES[0]?.code ?? '+84';

/**
 * "Thêm vợ/chồng" form (story 025, no tab bar): phone (country picker, default +84) and an optional
 * display name. The temporary password is generated here, sent to `add-household-member` and shown
 * once after success; it lives only in this component's state. Errors write no event; the submit
 * is disabled in flight.
 *
 * @example
 * <AddMemberForm clientPromise={client} onAdded={reload} onClose={back} />
 */
export function AddMemberForm({ clientPromise, householdId, onAdded, onClose }: AddMemberFormProps) {
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [number, setNumber] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<Added | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const checked = validatePhone(country, number, PEOPLE_CONFIG);
    if (!checked.ok) {
      setError(checked.reason === 'unknown_country' ? STRINGS.phoneUnknownCountry : checked.reason === 'not_digits' ? STRINGS.phoneNotDigits : STRINGS.phoneBadLength);
      return;
    }
    if (checked.phone === null) {
      setError(STRINGS.createAccountPhoneRequired);
      return;
    }
    const e164 = normalizePhone(`${checked.phone.country}${checked.phone.number}`);
    if (e164 === null) {
      setError(STRINGS.addMemberErrors.invalid_phone);
      return;
    }
    const name = displayName.trim() === '' ? undefined : validateDisplayName(displayName);
    if (name === null) {
      setError(STRINGS.createAccountNameInvalid);
      return;
    }
    setBusy(true);
    setError(null);
    const password = generateTempPassword();
    try {
      const result = await addHouseholdMember(await clientPromise, {
        phone: e164,
        password,
        ...(householdId === undefined ? {} : { householdId }),
        ...(name === undefined ? {} : { displayName: name }),
      });
      if (!result.ok) {
        setError(STRINGS.addMemberErrors[result.error]);
        setBusy(false);
        return;
      }
      setAdded({ phone: result.phone, password });
      onAdded();
    } catch (err) {
      console.error('[add-member] request failed', err);
      setError(STRINGS.addMemberErrors.network);
    }
    setBusy(false);
  };

  if (added !== null) {
    return <TempPasswordView title={STRINGS.addMemberDone} phone={added.phone} password={added.password} onFinish={onClose} />;
  }

  return (
    <main className="screen">
      <header className="screen__header">
        <button type="button" className="back-button" onClick={onClose} disabled={busy}>
          {STRINGS.back}
        </button>
        <h1 className="screen__title">{STRINGS.addMemberTitle}</h1>
        <p className="screen__prompt">{STRINGS.addMemberPrompt}</p>
      </header>
      <form className="card form" onSubmit={(e) => void onSubmit(e)} noValidate>
        <div className="form__row">
          <label className="form__field">
            <span className="form__label">{STRINGS.loginCountryLabel}</span>
            <span className="select-code">
              <span className="select-code__value" aria-hidden="true">
                {country}
              </span>
              <select value={country} onChange={(e) => setCountry(e.target.value)} disabled={busy}>
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} {c.name}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <label className="form__field">
            <span className="form__label">{STRINGS.loginPhoneLabel}</span>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="off"
              className="note__input form__input"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              disabled={busy}
            />
          </label>
        </div>
        <label className="form__field">
          <span className="form__label">{STRINGS.displayNameLabel}</span>
          <input
            type="text"
            autoComplete="off"
            className="note__input form__input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={busy}
          />
        </label>
        {error !== null && (
          <p className="message message--error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="button button--primary" disabled={busy}>
          {busy ? STRINGS.addMemberSubmitting : STRINGS.addMemberSubmit}
        </button>
      </form>
    </main>
  );
}
