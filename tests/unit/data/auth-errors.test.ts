// Auth error classification: a 400/401 means "wrong phone or password" only when signing in.
import { describe, expect, it } from 'vitest';
import { classifyAuthError } from '../../../src/data/auth-service';

describe('classifyAuthError while signing in', () => {
  it('maps invalid credentials and a plain 400/401 to bad-credentials', () => {
    expect(classifyAuthError({ status: 400, code: 'invalid_credentials' }, 'sign-in')).toBe('bad-credentials');
    expect(classifyAuthError({ status: 400 }, 'sign-in')).toBe('bad-credentials');
    expect(classifyAuthError({ status: 401 }, 'sign-in')).toBe('bad-credentials');
  });

  it('maps a 500 to server', () => {
    expect(classifyAuthError({ status: 500 }, 'sign-in')).toBe('server');
  });
});

describe('classifyAuthError while signed in (changing the password)', () => {
  it('never reports a wrong phone or password', () => {
    for (const error of [{ status: 400 }, { status: 401 }, { status: 403 }, { status: 400, code: 'invalid_credentials' }, { status: 422 }]) {
      expect(classifyAuthError(error, 'signed-in')).not.toBe('bad-credentials');
    }
  });

  it('maps a missing or expired session to session-expired', () => {
    expect(classifyAuthError({ name: 'AuthSessionMissingError', status: 400, message: 'Auth session missing!' }, 'signed-in')).toBe('session-expired');
    expect(classifyAuthError({ status: 403, code: 'session_not_found' }, 'signed-in')).toBe('session-expired');
    expect(classifyAuthError({ status: 401, code: 'bad_jwt' }, 'signed-in')).toBe('session-expired');
    expect(classifyAuthError({ status: 401, code: 'PGRST301' }, 'signed-in')).toBe('session-expired');
  });

  it('maps reauthentication and weak password to their own reasons', () => {
    expect(classifyAuthError({ status: 400, code: 'reauthentication_needed' }, 'signed-in')).toBe('reauthentication-needed');
    expect(classifyAuthError({ status: 400, code: 'reauthentication_not_valid' }, 'signed-in')).toBe('reauthentication-needed');
    expect(classifyAuthError({ status: 422, code: 'weak_password' }, 'signed-in')).toBe('weak-password');
  });

  it('keeps same-password and network', () => {
    expect(classifyAuthError({ status: 422, code: 'same_password' }, 'signed-in')).toBe('same-password');
    expect(classifyAuthError({ name: 'AuthRetryableFetchError', status: 0 }, 'signed-in')).toBe('network');
  });

  it('maps any other 400 to server, so the code can be shown', () => {
    expect(classifyAuthError({ status: 400, code: 'validation_failed' }, 'signed-in')).toBe('server');
  });
});
