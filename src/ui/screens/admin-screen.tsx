import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizePhone } from '../../../supabase/functions/_shared/phone';
import { generateTempPassword } from '../../data/account-service';
import { loadAdminHouseholds, resetPassword, searchHouseholds, setHouseholdCode } from '../../data/admin-service';
import type { AdminHousehold, AdminMember, AdminQuery } from '../../data/admin-service';
import { validateAmwayCode, validatePhone } from '../../domain/people';
import { COUNTRY_CODES, PEOPLE_CONFIG } from '../people-config';
import { adminCancelledLabel, adminCancelReason, adminResetAria, STRINGS } from '../strings';
import { TempPasswordView } from './temp-password-view';

/** Props for {@link AdminScreen}. */
export interface AdminScreenProps {
  /** Lazy Supabase client (from `getSupabaseClient`). */
  readonly clientPromise: Promise<SupabaseClient>;
  /** Back to Cài đặt. */
  readonly onBack: () => void;
}

const DEFAULT_COUNTRY = COUNTRY_CODES[0]?.code ?? '+84';

/** Online flag that follows the browser's `online` and `offline` events. */
function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}

/** Temporary password of a reset; lives only in {@link AdminScreen} state until "Xong". */
interface ResetDone {
  readonly phone: string;
  readonly password: string;
}

interface HouseholdCardProps {
  readonly household: AdminHousehold;
  readonly clientPromise: Promise<SupabaseClient>;
  readonly online: boolean;
  /** Replaces this household with its refreshed copy. */
  readonly onRefreshed: (household: AdminHousehold) => void;
  /** Shows the once-only temporary password view. */
  readonly onResetDone: (done: ResetDone) => void;
}

/** One household: members with "Đặt lại mật khẩu", active and cancelled codes, "Đặt mã số". */
function HouseholdCard({ household, clientPromise, online, onRefreshed, onResetDone }: HouseholdCardProps) {
  const [busy, setBusy] = useState<'reset' | 'code' | null>(null);
  const [resetUser, setResetUser] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [codeMessage, setCodeMessage] = useState<{ readonly text: string; readonly error: boolean } | null>(null);

  const onReset = async (member: AdminMember) => {
    if (busy !== null) return;
    setBusy('reset');
    setResetUser(member.userId);
    setResetError(null);
    const password = generateTempPassword();
    try {
      const result = await resetPassword(await clientPromise, { userId: member.userId, password });
      if (!result.ok) {
        setResetError(STRINGS.adminResetErrors[result.error]);
      } else {
        onResetDone({ phone: member.phone ?? '', password });
        return;
      }
    } catch {
      setResetError(STRINGS.adminResetErrors.network);
    }
    setBusy(null);
  };

  const onSetCode = async (e: FormEvent) => {
    e.preventDefault();
    if (busy !== null) return;
    const checked = validateAmwayCode(code, PEOPLE_CONFIG);
    if (!checked.ok || checked.code === null) {
      setCodeMessage({ text: STRINGS.adminSetCodeErrors.invalid_code, error: true });
      return;
    }
    setBusy('code');
    setCodeMessage(null);
    try {
      const client = await clientPromise;
      const result = await setHouseholdCode(client, household.householdId, checked.code);
      if (!result.ok) {
        setCodeMessage({ text: STRINGS.adminSetCodeErrors[result.error], error: true });
      } else {
        setCode('');
        setCodeMessage({ text: STRINGS.adminSetCodeDone, error: false });
        const refreshed = await loadAdminHouseholds(client, [household.householdId]);
        const next = refreshed.ok ? refreshed.households[0] : undefined;
        if (next !== undefined) onRefreshed(next);
      }
    } catch {
      setCodeMessage({ text: STRINGS.adminSetCodeErrors.network, error: true });
    }
    setBusy(null);
  };

  return (
    <section className="card form admin-result" aria-label={household.activeCode ?? STRINGS.adminNoCode}>
      <h2 className="card__title">{STRINGS.adminActiveCodeLabel}</h2>
      <p className="account-name">{household.activeCode ?? STRINGS.adminNoCode}</p>
      {household.cancelledCodes.length > 0 && (
        <>
          <h3 className="form__label">{STRINGS.adminCancelledHeading}</h3>
          <ul className="member-list">
            {household.cancelledCodes.map((c) => (
              <li key={`${c.code}-${c.cancelledAt}`} className="member-list__item admin-code-cancelled">
                {c.code} · {adminCancelledLabel(c.cancelledAt)}
                {c.reason !== null && ` (${adminCancelReason(c.reason)})`}
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className="form__label">{STRINGS.adminMembersHeading}</h3>
      {household.members.length === 0 ? (
        <p className="message">{STRINGS.adminNoMembers}</p>
      ) : (
        <ul className="member-list">
          {household.members.map((m) => {
            const name = m.displayName ?? m.phone ?? STRINGS.householdMemberUnnamed;
            return (
              <li key={m.userId} className="member-list__item admin-member">
                <span className="account-name">{name}</span>
                {m.displayName !== null && m.phone !== null && <span className="card__body">{m.phone}</span>}
                <button
                  type="button"
                  className="button button--secondary"
                  aria-label={adminResetAria(name)}
                  onClick={() => void onReset(m)}
                  disabled={!online || busy !== null}
                >
                  {busy === 'reset' && resetUser === m.userId ? STRINGS.adminResetting : STRINGS.adminResetButton}
                </button>
                {!online && <p className="message">{STRINGS.adminResetOfflineReason}</p>}
                {resetError !== null && resetUser === m.userId && (
                  <p className="message message--error" role="alert">
                    {resetError}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <form className="form" onSubmit={(e) => void onSetCode(e)} noValidate>
        <h3 className="form__label">{STRINGS.adminSetCodeHeading}</h3>
        <label className="form__field">
          <span className="form__label">{STRINGS.adminSetCodeLabel}</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            className="note__input form__input"
            placeholder={STRINGS.amwayCodePlaceholder}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={busy !== null}
          />
        </label>
        {codeMessage !== null && (
          <p className={codeMessage.error ? 'message message--error' : 'message'} role={codeMessage.error ? 'alert' : 'status'}>
            {codeMessage.text}
          </p>
        )}
        <button type="submit" className="button button--primary" disabled={!online || busy !== null}>
          {busy === 'code' ? STRINGS.adminSetCodeSaving : STRINGS.adminSetCodeButton}
        </button>
        {!online && <p className="message">{STRINGS.adminSetCodeOfflineReason}</p>}
      </form>
    </section>
  );
}

/** Search state: `done` holds the households found (possibly none). */
type SearchState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'busy' }
  | { readonly kind: 'error'; readonly text: string }
  | { readonly kind: 'done'; readonly households: readonly AdminHousehold[] };

/**
 * Màn "Quản trị" (story 029, no tab bar, admin only; the server enforces the role): finds a
 * household by member phone (country picker + number) or by Amway code, and shows its members,
 * active code and cancelled codes ("Đã huỷ" with the date). Per member "Đặt lại mật khẩu" (the app
 * generates the temporary password, shows it once, and never stores or logs it) and per household
 * "Đặt mã số". Never reads or shows a contact book. Offline: buttons are locked with a reason.
 *
 * @example
 * <AdminScreen clientPromise={client} onBack={back} />
 */
export function AdminScreen({ clientPromise, onBack }: AdminScreenProps) {
  const online = useOnline();
  const [mode, setMode] = useState<'phone' | 'code'>('phone');
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [number, setNumber] = useState('');
  const [codeQuery, setCodeQuery] = useState('');
  const [search, setSearch] = useState<SearchState>({ kind: 'idle' });
  const [resetDone, setResetDone] = useState<ResetDone | null>(null);

  const onSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (search.kind === 'busy') return;
    let query: AdminQuery;
    if (mode === 'phone') {
      const checked = validatePhone(country, number, PEOPLE_CONFIG);
      if (!checked.ok) {
        setSearch({ kind: 'error', text: checked.reason === 'unknown_country' ? STRINGS.phoneUnknownCountry : checked.reason === 'not_digits' ? STRINGS.phoneNotDigits : STRINGS.phoneBadLength });
        return;
      }
      if (checked.phone === null) {
        setSearch({ kind: 'error', text: STRINGS.adminSearchPhoneRequired });
        return;
      }
      const phone = normalizePhone(`${checked.phone.country}${checked.phone.number}`);
      if (phone === null) {
        setSearch({ kind: 'error', text: STRINGS.addMemberErrors.invalid_phone });
        return;
      }
      query = { kind: 'phone', phone };
    } else {
      const checked = validateAmwayCode(codeQuery, PEOPLE_CONFIG);
      if (!checked.ok || checked.code === null) {
        setSearch({ kind: 'error', text: STRINGS.adminSearchCodeInvalid });
        return;
      }
      query = { kind: 'code', code: checked.code };
    }
    setSearch({ kind: 'busy' });
    try {
      const result = await searchHouseholds(await clientPromise, query);
      setSearch(result.ok ? { kind: 'done', households: result.households } : { kind: 'error', text: STRINGS.adminSearchErrors[result.error] });
    } catch {
      setSearch({ kind: 'error', text: STRINGS.adminSearchErrors.network });
    }
  };

  if (resetDone !== null) {
    return <TempPasswordView title={STRINGS.adminResetDone} phone={resetDone.phone} password={resetDone.password} onFinish={() => setResetDone(null)} />;
  }

  const searching = search.kind === 'busy';
  return (
    <main className="screen">
      <header className="screen__header">
        <button type="button" className="back-button" onClick={onBack}>
          {STRINGS.back}
        </button>
        <h1 className="screen__title">{STRINGS.adminTitle}</h1>
        <p className="screen__prompt">{STRINGS.adminPrompt}</p>
      </header>

      <form className="card form" onSubmit={(e) => void onSearch(e)} noValidate>
        <div className="admin-tabs" role="group">
          <button type="button" className={mode === 'phone' ? 'button button--primary' : 'button button--secondary'} aria-pressed={mode === 'phone'} onClick={() => setMode('phone')}>
            {STRINGS.adminSearchByPhone}
          </button>
          <button type="button" className={mode === 'code' ? 'button button--primary' : 'button button--secondary'} aria-pressed={mode === 'code'} onClick={() => setMode('code')}>
            {STRINGS.adminSearchByCode}
          </button>
        </div>
        {mode === 'phone' ? (
          <div className="form__row">
            <label className="form__field">
              <span className="form__label">{STRINGS.loginCountryLabel}</span>
              <span className="select-code">
                <span className="select-code__value" aria-hidden="true">
                  {country}
                </span>
                <select value={country} onChange={(e) => setCountry(e.target.value)} disabled={searching}>
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
              <input type="tel" inputMode="tel" autoComplete="off" className="note__input form__input" value={number} onChange={(e) => setNumber(e.target.value)} disabled={searching} />
            </label>
          </div>
        ) : (
          <label className="form__field">
            <span className="form__label">{STRINGS.adminSearchCodeLabel}</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className="note__input form__input"
              placeholder={STRINGS.amwayCodePlaceholder}
              value={codeQuery}
              onChange={(e) => setCodeQuery(e.target.value)}
              disabled={searching}
            />
          </label>
        )}
        {search.kind === 'error' && (
          <p className="message message--error" role="alert">
            {search.text}
          </p>
        )}
        <button type="submit" className="button button--primary" disabled={!online || searching}>
          {searching ? STRINGS.adminSearching : STRINGS.adminSearchButton}
        </button>
        {!online && <p className="message">{STRINGS.adminSearchOfflineReason}</p>}
      </form>

      {search.kind === 'done' && search.households.length === 0 && <p className="message">{STRINGS.adminNotFound}</p>}
      {search.kind === 'done' &&
        search.households.map((h) => (
          <HouseholdCard
            key={h.householdId}
            household={h}
            clientPromise={clientPromise}
            online={online}
            onResetDone={setResetDone}
            onRefreshed={(next) =>
              setSearch((s) => (s.kind === 'done' ? { kind: 'done', households: s.households.map((x) => (x.householdId === next.householdId ? next : x)) } : s))
            }
          />
        ))}
    </main>
  );
}
