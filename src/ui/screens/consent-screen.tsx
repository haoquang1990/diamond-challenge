import { useState } from 'react';
import type { SyncFailure } from '../../data/contact-sync';
import { STRINGS, syncFailureText } from '../strings';

/** Props for {@link ConsentScreen}. */
export interface ConsentScreenProps {
  /** "Đồng ý": records consent on the server; resolves to null on success, else the failure. */
  readonly onAgree: () => Promise<SyncFailure | null>;
  /** "Đăng xuất": leaves without agreeing (the account's data stays on this device). */
  readonly onSignOut: () => void;
  /**
   * True when the server consent state could not be read (offline): shows "Cần có mạng để
   * xác nhận đồng ý." with "Thử lại" instead of the agree button.
   */
  readonly needsNetwork?: boolean;
  /** "Thử lại" in the needs-network state. */
  readonly onRetry?: () => void;
}

/**
 * Required consent to store the contact book on the server (story 023, crm.md rule 18,
 * story 030). Shown without the tab bar after login (after the password step) until the
 * account agrees. Exactly two buttons: "Đồng ý và tiếp tục" and "Đăng xuất".
 */
export function ConsentScreen({ onAgree, onSignOut, needsNetwork = false, onRetry }: ConsentScreenProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const agree = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const failure = await onAgree();
      if (failure === null) return;
      setError(syncFailureText(failure));
    } catch (e) {
      console.error('[consent] could not record consent', e);
      setError(syncFailureText('server'));
    }
    setBusy(false);
  };

  return (
    <main className="screen">
      <header className="screen__header">
        <h1 className="screen__title">{STRINGS.consentTitle}</h1>
      </header>
      <section className="card">
        <p className="card__body">{STRINGS.consentIntro}</p>
        <ul className="consent-list">
          <li>{STRINGS.consentMembersOnly}</li>
          <li>{STRINGS.consentAdmins}</li>
        </ul>
        <p className="card__body">{STRINGS.consentRequiredNote}</p>
      </section>
      {needsNetwork && (
        <p className="message message--error" role="alert">
          {STRINGS.consentNeedsNetwork}
        </p>
      )}
      {error !== null && (
        <p className="message message--error" role="alert">
          {error}
        </p>
      )}
      <div className="consent-actions">
        {needsNetwork ? (
          <button type="button" className="button button--primary" onClick={onRetry}>
            {STRINGS.consentRetry}
          </button>
        ) : (
          <button type="button" className="button button--primary" onClick={() => void agree()} disabled={busy}>
            {busy ? STRINGS.saving : STRINGS.consentAgree}
          </button>
        )}
        <button type="button" className="button button--secondary" onClick={onSignOut} disabled={busy}>
          {STRINGS.consentSignOut}
        </button>
      </div>
    </main>
  );
}
