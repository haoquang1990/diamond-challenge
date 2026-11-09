import { useState } from 'react';
import type { SyncFailure } from '../../data/contact-sync';
import { STRINGS, syncFailureText } from '../strings';

/** Props for {@link ConsentScreen}. */
export interface ConsentScreenProps {
  /** "Đồng ý": records consent on the server; resolves to null on success, else the failure. */
  readonly onAgree: () => Promise<SyncFailure | null>;
  /** "Không đồng ý": the app keeps the contact book on this device only. */
  readonly onDecline: () => void;
}

/**
 * Consent to store the contact book on the server (story 023, crm.md rule 18). Shown without
 * the tab bar after login (after the password and display-name steps) and from Cài đặt.
 */
export function ConsentScreen({ onAgree, onDecline }: ConsentScreenProps) {
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
        <p className="card__body">{STRINGS.consentDeclineNote}</p>
      </section>
      {error !== null && (
        <p className="message message--error" role="alert">
          {error}
        </p>
      )}
      <button type="button" className="button button--primary" onClick={() => void agree()} disabled={busy}>
        {busy ? STRINGS.saving : STRINGS.consentAgree}
      </button>
      <button type="button" className="button button--secondary" onClick={onDecline} disabled={busy}>
        {STRINGS.consentDecline}
      </button>
    </main>
  );
}
