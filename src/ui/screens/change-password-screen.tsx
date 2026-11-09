import { useState } from 'react';
import type { FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { changePassword, saveDisplayName, validateDisplayName, validateNewPassword } from '../../data/auth-service';
import { authFailureText, passwordProblemText, STRINGS } from '../strings';

/** Props for {@link ChangePasswordScreen}. */
export interface ChangePasswordScreenProps {
  /** Lazy Supabase client (from `getSupabaseClient`). */
  readonly clientPromise: Promise<SupabaseClient>;
  /** Temporary password typed at sign-in, or null (e.g. after a reload). Memory only. */
  readonly temporaryPassword: string | null;
  /** Called once the password was changed and `mark_password_changed()` succeeded. */
  readonly onDone: () => void;
  /** Leaves without changing (signs out); this screen has no back button. */
  readonly onSignOut: () => void;
}

/**
 * Màn Đổi mật khẩu lần đầu: >= 8 characters, confirmation must match, must differ from
 * the temporary password. Shown to accounts with `must_change_password` before anything else.
 *
 * @example
 * <ChangePasswordScreen clientPromise={client} temporaryPassword={temp} onDone={next} onSignOut={out} />
 */
export function ChangePasswordScreen({ clientPromise, temporaryPassword, onDone, onSignOut }: ChangePasswordScreenProps) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const problem = validateNewPassword(password, confirmation, temporaryPassword);
    if (problem !== null) {
      setError(passwordProblemText(problem));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await changePassword(await clientPromise, password);
      if (result.ok) {
        onDone();
        return;
      }
      setError(authFailureText(result.reason));
    } catch (err) {
      console.error('[change-password] failed', err);
      setError(authFailureText('network'));
    }
    setBusy(false);
  };

  return (
    <main className="screen">
      <header className="screen__header">
        <h1 className="screen__title">{STRINGS.changePasswordTitle}</h1>
        <p className="screen__prompt">{STRINGS.changePasswordPrompt}</p>
      </header>

      <form className="card form" onSubmit={(e) => void onSubmit(e)} noValidate>
        <label className="form__field">
          <span className="form__label">{STRINGS.newPasswordLabel}</span>
          <input
            type="password"
            autoComplete="new-password"
            className="note__input form__input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
          />
        </label>
        <label className="form__field">
          <span className="form__label">{STRINGS.confirmPasswordLabel}</span>
          <input
            type="password"
            autoComplete="new-password"
            className="note__input form__input"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            disabled={busy}
          />
        </label>
        {error !== null && (
          <p className="message message--error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="button button--primary" disabled={busy}>
          {busy ? STRINGS.changePasswordSubmitting : STRINGS.changePasswordSubmit}
        </button>
        <button type="button" className="button button--secondary" onClick={onSignOut} disabled={busy}>
          {STRINGS.accountSignOut}
        </button>
      </form>
    </main>
  );
}

/** Props for {@link DisplayNameScreen}. */
export interface DisplayNameScreenProps {
  /** Lazy Supabase client (from `getSupabaseClient`). */
  readonly clientPromise: Promise<SupabaseClient>;
  /** Called after the name was saved, with the saved (trimmed) name. */
  readonly onSaved: (name: string) => void;
  /** "Để sau": skip without a name. */
  readonly onSkip: () => void;
}

/**
 * Hỏi tên hiển thị sau lần đổi mật khẩu đầu: 1-60 characters after trimming, skippable.
 *
 * @example
 * <DisplayNameScreen clientPromise={client} onSaved={setName} onSkip={skip} />
 */
export function DisplayNameScreen({ clientPromise, onSaved, onSkip }: DisplayNameScreenProps) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const valid = validateDisplayName(name);
    if (valid === null) {
      setError(STRINGS.displayNameInvalid);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await saveDisplayName(await clientPromise, valid);
      if (result.ok) {
        onSaved(valid);
        return;
      }
      setError(authFailureText(result.reason));
    } catch (err) {
      console.error('[display-name] failed', err);
      setError(authFailureText('network'));
    }
    setBusy(false);
  };

  return (
    <main className="screen">
      <header className="screen__header">
        <h1 className="screen__title">{STRINGS.displayNamePromptTitle}</h1>
        <p className="screen__prompt">{STRINGS.displayNamePromptBody}</p>
      </header>

      <form className="card form" onSubmit={(e) => void onSubmit(e)} noValidate>
        <label className="form__field">
          <span className="form__label">{STRINGS.displayNameLabel}</span>
          <input
            type="text"
            autoComplete="name"
            maxLength={120}
            className="note__input form__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
          />
          <span className="message">{STRINGS.displayNameHint}</span>
        </label>
        {error !== null && (
          <p className="message message--error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="button button--primary" disabled={busy}>
          {busy ? STRINGS.saving : STRINGS.save}
        </button>
        <button type="button" className="button button--secondary" onClick={onSkip} disabled={busy}>
          {STRINGS.displayNameSkip}
        </button>
      </form>
    </main>
  );
}
