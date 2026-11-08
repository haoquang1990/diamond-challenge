import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizePhone } from '../../../supabase/functions/_shared/phone';
import { createF1Account, generateTempPassword } from '../../data/account-service';
import { validateDisplayName } from '../../data/auth-service';
import type { EventStore } from '../../data/event-store';
import { derivePeople, validatePhone } from '../../domain/people';
import type { Person } from '../../domain/people';
import { COUNTRY_CODES, PEOPLE_CONFIG } from '../people-config';
import { STRINGS, createAccountShareText } from '../strings';

/** Props for {@link CreateAccountScreen}. */
export interface CreateAccountScreenProps {
  /** Lazy Supabase client (from `getSupabaseClient`). */
  readonly clientPromise: Promise<SupabaseClient>;
  /** Event log: the person is read from it and `person_updated { linkedUserId }` is appended on success. */
  readonly eventStore: EventStore;
  /** The contact to create an account for. */
  readonly personId: string;
  /** Leaves the screen (back to the person detail). */
  readonly onBack: () => void;
}

/** What the success view shows. Lives only in this component's state. */
interface Created {
  readonly phone: string;
  readonly password: string;
  readonly saveFailed: boolean;
}

const DEFAULT_COUNTRY = COUNTRY_CODES[0]?.code ?? '+84';

/**
 * Màn Tạo tài khoản (story 024, no tab bar): phone (country picker, prefilled from the person's
 * phone) and an optional display name. The temporary password is generated here, sent to the
 * Edge Function and shown once after success; it is kept only in this component's state (never in
 * the event log, storage or console). Errors write no event; the submit is disabled in flight.
 *
 * @example
 * <CreateAccountScreen clientPromise={client} eventStore={store} personId={id} onBack={back} />
 */
export function CreateAccountScreen({ clientPromise, eventStore, personId, onBack }: CreateAccountScreenProps) {
  const [person, setPerson] = useState<Person | null | undefined>(undefined);
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [number, setNumber] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const [copyNote, setCopyNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    eventStore
      .list()
      .then((events) => {
        if (cancelled) return;
        const found = derivePeople(events, PEOPLE_CONFIG).find((p) => p.personId === personId) ?? null;
        setPerson(found);
        if (found?.phone != null) {
          setCountry(found.phone.country);
          setNumber(found.phone.number);
        }
      })
      .catch((e: unknown) => {
        console.error('[create-account] could not read the person', e);
        if (!cancelled) setPerson(null);
      });
    return () => {
      cancelled = true;
    };
  }, [eventStore, personId]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || person == null || person.amwayCode == null) return;
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
      setError(STRINGS.createAccountErrors.invalid_phone);
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
      const result = await createF1Account(await clientPromise, {
        phone: e164,
        password,
        amwayCode: person.amwayCode,
        ...(name === undefined ? {} : { displayName: name }),
      });
      if (!result.ok) {
        setError(STRINGS.createAccountErrors[result.error]);
        setBusy(false);
        return;
      }
      let saveFailed = false;
      try {
        await eventStore.append({ type: 'person_updated', payload: { personId, linkedUserId: result.userId } });
      } catch (err) {
        console.error('[create-account] could not save the link', err);
        saveFailed = true;
      }
      setCreated({ phone: result.phone, password, saveFailed });
    } catch (err) {
      console.error('[create-account] request failed', err);
      setError(STRINGS.createAccountErrors.network);
    }
    setBusy(false);
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyNote(STRINGS.createAccountCopied);
    } catch {
      setCopyNote(STRINGS.createAccountCopyFailed);
    }
  };

  const share = (text: string) => {
    navigator.share({ text }).catch(() => undefined);
  };

  if (created !== null) {
    const text = createAccountShareText(created.phone, created.password);
    return (
      <main className="screen">
        <header className="screen__header">
          <h1 className="screen__title">{STRINGS.createAccountDone}</h1>
          <p className="screen__prompt">{STRINGS.createAccountOnce}</p>
        </header>
        <section className="card form">
          <p className="message">
            {STRINGS.createAccountPhoneLine}: <strong>{created.phone}</strong>
          </p>
          <p className="message">
            {STRINGS.createAccountPasswordLine}: <strong className="temp-password">{created.password}</strong>
          </p>
          <p className="message">{STRINGS.createAccountShareHint}</p>
          {created.saveFailed && (
            <p className="message message--warn" role="alert">
              {STRINGS.createAccountSaveWarning}
            </p>
          )}
          <div className="button-row">
            <button type="button" className="button button--secondary" onClick={() => void copy(text)}>
              {STRINGS.createAccountCopy}
            </button>
            {typeof navigator.share === 'function' && (
              <button type="button" className="button button--secondary" onClick={() => share(text)}>
                {STRINGS.createAccountShare}
              </button>
            )}
          </div>
          {copyNote !== null && (
            <p className="message" role="status">
              {copyNote}
            </p>
          )}
          <button type="button" className="button button--primary" onClick={onBack}>
            {STRINGS.createAccountFinish}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="screen">
      <header className="screen__header">
        <button type="button" className="back-button" onClick={onBack} disabled={busy}>
          {STRINGS.back}
        </button>
        <h1 className="screen__title">{STRINGS.createAccountTitle}</h1>
        <p className="screen__prompt">{STRINGS.createAccountPrompt}</p>
      </header>

      {person === undefined ? (
        <p className="message" role="status">
          {STRINGS.loading}
        </p>
      ) : person === null || person.amwayCode == null ? (
        <p className="message message--error" role="alert">
          {STRINGS.createAccountNeedsCode}
        </p>
      ) : (
        <form className="card form" onSubmit={(e) => void onSubmit(e)} noValidate>
          <p className="message">
            <strong>{person.name}</strong> · {STRINGS.createAccountCodeLine}: <strong>{person.amwayCode}</strong>
          </p>
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
            {busy ? STRINGS.createAccountSubmitting : STRINGS.createAccountSubmit}
          </button>
        </form>
      )}
    </main>
  );
}
