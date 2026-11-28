import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizePhone } from '../../../supabase/functions/_shared/phone';
import { createF1Account, generateTempPassword } from '../../data/account-service';
import { adminHouseholdNames, searchHouseholds, setSponsorByCode } from '../../data/admin-service';
import type { AdminHousehold } from '../../data/admin-service';
import { validateAmwayCode, validatePhone } from '../../domain/people';
import { COUNTRY_CODES, PEOPLE_CONFIG } from '../people-config';
import { phoneProblemText } from '../people-helpers';
import { STRINGS } from '../strings';

const DEFAULT_COUNTRY = '+84';

/** What a typed sponsor code points at. */
type Preview = { readonly kind: 'empty' } | { readonly kind: 'loading' } | { readonly kind: 'found'; readonly names: string; readonly code: string } | { readonly kind: 'none' };

/**
 * Looks up the household holding an active Amway code as the admin types it (story 072), so the
 * admin sees whose tuyến trên it is before saving.
 */
function useSponsorPreview(clientPromise: Promise<SupabaseClient>, raw: string): Preview {
  const [preview, setPreview] = useState<Preview>({ kind: 'empty' });
  useEffect(() => {
    const checked = validateAmwayCode(raw, PEOPLE_CONFIG);
    if (raw.trim() === '' || !checked.ok || checked.code === null) {
      setPreview({ kind: 'empty' });
      return undefined;
    }
    const code = checked.code;
    setPreview({ kind: 'loading' });
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void clientPromise
        .then((c) => searchHouseholds(c, { kind: 'code', code }))
        .then((r) => {
          if (cancelled) return;
          const h = r.ok ? r.households.find((x: AdminHousehold) => x.activeCode === code) : undefined;
          setPreview(h === undefined ? { kind: 'none' } : { kind: 'found', names: adminHouseholdNames(h.members), code });
        });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [clientPromise, raw]);
  return preview;
}

function PreviewLine({ preview, emptyText }: { readonly preview: Preview; readonly emptyText?: string }) {
  if (preview.kind === 'found') return <p className="admin-sponsor-found">{STRINGS.adminSponsorFound(preview.names, preview.code)}</p>;
  if (preview.kind === 'none') return <p className="message message--error">{STRINGS.adminSponsorNotFound}</p>;
  if (preview.kind === 'empty' && emptyText !== undefined) return <p className="message">{emptyText}</p>;
  return null;
}

/** Props for {@link AdminCreateAccountCard}. */
export interface AdminCreateAccountCardProps {
  readonly clientPromise: Promise<SupabaseClient>;
  readonly online: boolean;
  /** The account was created: show its temporary password once. */
  readonly onCreated: (done: { readonly phone: string; readonly password: string }) => void;
}

/**
 * Quản trị "Tạo tài khoản" (story 072): phone, name, the person's Amway code and the tuyến trên's
 * code (empty: a root account). The app makes the temporary password.
 */
export function AdminCreateAccountCard({ clientPromise, online, onCreated }: AdminCreateAccountCardProps) {
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [sponsor, setSponsor] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = useSponsorPreview(clientPromise, sponsor);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const phone = validatePhone(country, number, PEOPLE_CONFIG);
    if (!phone.ok || phone.phone === null) {
      setError(phone.ok ? STRINGS.adminSearchPhoneRequired : phoneProblemText(phone.reason));
      return;
    }
    const e164 = normalizePhone(`${phone.phone.country}${phone.phone.number}`);
    const own = validateAmwayCode(code, PEOPLE_CONFIG);
    if (e164 === null || !own.ok || own.code === null) {
      setError(e164 === null ? STRINGS.createAccountErrors.invalid_phone : STRINGS.amwayCodeInvalid);
      return;
    }
    const sponsorCode = sponsor.trim();
    if (sponsorCode !== '' && preview.kind !== 'found') {
      setError(STRINGS.adminSponsorNotFound);
      return;
    }
    setBusy(true);
    setError(null);
    const password = generateTempPassword();
    try {
      const r = await createF1Account(await clientPromise, {
        phone: e164,
        password,
        amwayCode: own.code,
        ...(name.trim() === '' ? {} : { displayName: name.trim() }),
        ...(sponsorCode === '' ? { root: true } : { sponsorCode }),
      });
      if (r.ok) {
        onCreated({ phone: r.phone, password });
        return;
      }
      setError(STRINGS.createAccountErrors[r.error]);
    } catch {
      setError(STRINGS.createAccountErrors.network);
    }
    setBusy(false);
  };

  return (
    <form className="card form" onSubmit={(e) => void submit(e)} noValidate aria-label={STRINGS.adminCreateTitle}>
      <h2 className="card__title">{STRINGS.adminCreateTitle}</h2>
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
          <input type="tel" inputMode="tel" autoComplete="off" className="note__input form__input" value={number} onChange={(e) => setNumber(e.target.value)} disabled={busy} />
        </label>
      </div>
      <label className="form__field">
        <span className="form__label">{STRINGS.adminCreateName}</span>
        <input type="text" autoComplete="off" maxLength={60} className="note__input form__input" value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
      </label>
      <label className="form__field">
        <span className="form__label">{STRINGS.adminCreateCode}</span>
        <input type="text" inputMode="numeric" autoComplete="off" className="note__input form__input" placeholder={STRINGS.amwayCodePlaceholder} value={code} onChange={(e) => setCode(e.target.value)} disabled={busy} />
      </label>
      <label className="form__field">
        <span className="form__label">{STRINGS.adminCreateSponsor}</span>
        <input type="text" inputMode="numeric" autoComplete="off" className="note__input form__input" placeholder={STRINGS.amwayCodePlaceholder} value={sponsor} onChange={(e) => setSponsor(e.target.value)} disabled={busy} />
      </label>
      <PreviewLine preview={preview} emptyText={STRINGS.adminSponsorRoot} />
      {error !== null && (
        <p className="message message--error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="button button--primary" disabled={!online || busy || preview.kind === 'loading'}>
        {busy ? STRINGS.adminCreating : STRINGS.adminCreateButton}
      </button>
      <p className="message">{STRINGS.adminCreateHint}</p>
    </form>
  );
}

/** Props for {@link AdminSponsorForm}. */
export interface AdminSponsorFormProps {
  readonly clientPromise: Promise<SupabaseClient>;
  readonly household: AdminHousehold;
  readonly online: boolean;
  /** The sponsor changed: reload the household. */
  readonly onChanged: () => void;
}

/** Quản trị "Đổi tuyến trên" of a found household (story 072). An empty code clears the sponsor. */
export function AdminSponsorForm({ clientPromise, household, online, onChanged }: AdminSponsorFormProps) {
  const [sponsor, setSponsor] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ readonly text: string; readonly error: boolean } | null>(null);
  const preview = useSponsorPreview(clientPromise, sponsor);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);
    const r = await setSponsorByCode(await clientPromise, household.householdId, sponsor.trim());
    setBusy(false);
    setMessage({ text: STRINGS.adminSponsorResults[r], error: r !== 'ok' });
    if (r === 'ok') {
      setSponsor('');
      onChanged();
    }
  };

  return (
    <form className="form admin-sponsor" onSubmit={(e) => void submit(e)} noValidate>
      <h3 className="form__label">{STRINGS.adminSponsorButton}</h3>
      <p className="admin-sponsor__current">
        <span>{STRINGS.adminSponsorCurrent}</span>
        <b>{household.sponsorCode ?? STRINGS.adminSponsorNone}</b>
      </p>
      <label className="form__field">
        <span className="form__label">{STRINGS.adminSponsorNewLabel}</span>
        <input type="text" inputMode="numeric" autoComplete="off" className="note__input form__input" placeholder={STRINGS.amwayCodePlaceholder} value={sponsor} onChange={(e) => setSponsor(e.target.value)} disabled={busy} />
      </label>
      <PreviewLine preview={preview} />
      {message !== null && (
        <p className={message.error ? 'message message--error' : 'message'} role={message.error ? 'alert' : 'status'}>
          {message.text}
        </p>
      )}
      <button type="submit" className="button button--primary" disabled={!online || busy || preview.kind === 'loading' || preview.kind === 'none'}>
        {busy ? STRINGS.adminSponsorSaving : STRINGS.adminSponsorButton}
      </button>
    </form>
  );
}
