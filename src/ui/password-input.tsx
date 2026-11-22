import { useState } from 'react';
import { STRINGS } from './strings';

/** Props for {@link PasswordInput}. */
export interface PasswordInputProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** `current-password` on sign-in, `new-password` when choosing one. */
  readonly autoComplete: 'current-password' | 'new-password';
  readonly disabled?: boolean;
}

/**
 * Password field with an eye button that shows or hides what was typed. The button is a
 * 44px tap target with an accessible name and `aria-pressed`; the text stays hidden by default
 * and the field is never logged.
 */
export function PasswordInput({ value, onChange, autoComplete, disabled = false }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="password-input">
      <input
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className="note__input form__input password-input__field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
      <button
        type="button"
        className="password-input__toggle"
        aria-label={visible ? STRINGS.passwordHide : STRINGS.passwordShow}
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
        disabled={disabled}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
          <path d="M1.5 12S5.5 4.5 12 4.5 22.5 12 22.5 12 18.5 19.5 12 19.5 1.5 12 1.5 12Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="3.5" fill="none" stroke="currentColor" strokeWidth="2" />
          {visible && <path d="M3 3 21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
        </svg>
      </button>
    </span>
  );
}
