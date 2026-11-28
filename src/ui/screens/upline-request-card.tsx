import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cancelUplineRequest, loadHasSponsor, loadMyUplineRequest, requestUplineByCode } from '../../data/upline-service';
import type { MyUplineRequest } from '../../data/upline-service';
import { STRINGS } from '../strings';

/** Props for {@link UplineRequestCard}. */
export interface UplineRequestCardProps {
  readonly clientPromise: Promise<SupabaseClient>;
  readonly accountId: string;
}

/**
 * Cài đặt › Mã số của tôi "Mã số tuyến trên" (story 073), only while my household has no tuyến
 * trên: send a request by code, then "Đang chờ tuyến trên đồng ý" with "Huỷ lời mời". The answer
 * is the same whether the code exists or not.
 */
export function UplineRequestCard({ clientPromise, accountId }: UplineRequestCardProps) {
  const [hasSponsor, setHasSponsor] = useState<boolean | null>(null);
  const [pending, setPending] = useState<MyUplineRequest | null | undefined>(undefined);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const client = await clientPromise;
    const [has, mine] = await Promise.all([loadHasSponsor(client, accountId), loadMyUplineRequest(client)]);
    setHasSponsor(has);
    setPending(mine);
  }, [clientPromise, accountId]);
  useEffect(() => {
    void reload();
  }, [reload]);

  if (hasSponsor !== false || pending === undefined) return null;

  const send = async () => {
    setBusy(true);
    setError(null);
    const r = await requestUplineByCode(await clientPromise, code);
    setBusy(false);
    if (r === 'sent') {
      setCode('');
      await reload();
    } else setError(r === 'invalid' ? STRINGS.amwayCodeInvalid : r === 'has_upline' ? STRINGS.uplineHasOne : STRINGS.uplineError);
  };
  const cancel = async () => {
    setBusy(true);
    const r = await cancelUplineRequest(await clientPromise);
    setBusy(false);
    if (r !== 'ok') setError(STRINGS.uplineError);
    await reload();
  };

  return (
    <section className="card form" aria-label={STRINGS.uplineField}>
      {pending !== null ? (
        <>
          <p className="upline-pending" role="status">
            {STRINGS.uplinePending(pending.code)}
          </p>
          <button type="button" className="button button--secondary" onClick={() => void cancel()} disabled={busy || !navigator.onLine}>
            {STRINGS.uplineCancel}
          </button>
        </>
      ) : (
        <>
          <label className="form__field">
            <span className="form__label">{STRINGS.uplineField}</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className="note__input form__input"
              placeholder={STRINGS.amwayCodePlaceholder}
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setError(null);
              }}
              disabled={busy}
            />
          </label>
          <button type="button" className="button button--primary" onClick={() => void send()} disabled={busy || code.trim() === '' || !navigator.onLine}>
            {STRINGS.uplineSend}
          </button>
          <p className="message">{STRINGS.uplineHint}</p>
        </>
      )}
      {error !== null && (
        <p className="message message--error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
