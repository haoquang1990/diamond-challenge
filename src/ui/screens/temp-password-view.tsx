import { useState } from 'react';
import { STRINGS, createAccountShareText } from '../strings';

/** Props for {@link TempPasswordView}. */
export interface TempPasswordViewProps {
  /** Title of the success view, e.g. "Đã tạo tài khoản". */
  readonly title: string;
  /** Phone of the new account (as returned by the server). */
  readonly phone: string;
  /** The temporary password; shown once, kept only in the caller's state. */
  readonly password: string;
  /** Optional warning shown under the password (e.g. the link could not be saved). */
  readonly warning?: string;
  /** "Xong": leaves the view (the password is gone). */
  readonly onFinish: () => void;
}

/**
 * Once-only view of a new account's phone and temporary password with "Sao chép" and share
 * (stories 024 and 025). The password is never stored or logged here.
 *
 * @example
 * <TempPasswordView title="Đã tạo tài khoản" phone={p} password={pw} onFinish={back} />
 */
export function TempPasswordView({ title, phone, password, warning, onFinish }: TempPasswordViewProps) {
  const [copyNote, setCopyNote] = useState<string | null>(null);
  const text = createAccountShareText(phone, password);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyNote(STRINGS.createAccountCopied);
    } catch {
      setCopyNote(STRINGS.createAccountCopyFailed);
    }
  };

  return (
    <main className="screen">
      <header className="screen__header">
        <h1 className="screen__title">{title}</h1>
        <p className="screen__prompt">{STRINGS.createAccountOnce}</p>
      </header>
      <section className="card form">
        <p className="message">
          {STRINGS.createAccountPhoneLine}: <strong>{phone}</strong>
        </p>
        <p className="message">
          {STRINGS.createAccountPasswordLine}: <strong className="temp-password">{password}</strong>
        </p>
        <p className="message">{STRINGS.createAccountShareHint}</p>
        {warning !== undefined && (
          <p className="message message--warn" role="alert">
            {warning}
          </p>
        )}
        <div className="button-row">
          <button type="button" className="button button--secondary" onClick={() => void copy()}>
            {STRINGS.createAccountCopy}
          </button>
          {typeof navigator.share === 'function' && (
            <button type="button" className="button button--secondary" onClick={() => navigator.share({ text }).catch(() => undefined)}>
              {STRINGS.createAccountShare}
            </button>
          )}
        </div>
        {copyNote !== null && (
          <p className="message" role="status">
            {copyNote}
          </p>
        )}
        <button type="button" className="button button--primary" onClick={onFinish}>
          {STRINGS.createAccountFinish}
        </button>
      </section>
    </main>
  );
}
