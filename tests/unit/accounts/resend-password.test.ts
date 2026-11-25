/**
 * Story 048: a sponsor re-sends a temporary password to a never-activated F1 account, and the
 * share text carries the app link (2026-11-25).
 */
import { describe, expect, it } from 'vitest';
import { resendF1Password } from '../../../src/data/account-service';
import { appLink, createAccountShareText } from '../../../src/ui/strings';

const httpError = (status: number, error: string) => ({ name: 'FunctionsHttpError', context: new Response(JSON.stringify({ error }), { status }) });
const client = (error: unknown) => {
  const calls: unknown[] = [];
  return { calls, functions: { invoke: async (name: string, opts: unknown) => { calls.push({ name, opts }); return { data: null, error }; } } };
};

describe('resendF1Password', () => {
  it('calls reset-password with the user id and the new password', async () => {
    const c = client(null);
    expect(await resendF1Password(c as never, 'u1', 'Abc12345')).toEqual({ ok: true });
    expect(c.calls[0]).toMatchObject({ name: 'reset-password', opts: { body: { userId: 'u1', password: 'Abc12345' } } });
  });

  it.each([
    [httpError(409, 'already_active'), 'already_active'],
    [httpError(403, 'not_allowed'), 'not_allowed'],
    [httpError(403, 'admin_only'), 'not_allowed'],
    [httpError(404, 'not_found'), 'not_found'],
    [httpError(500, 'reset_failed'), 'other'],
    [new Error('offline'), 'network'],
  ])('maps %o to %s', async (error, key) => {
    expect(await resendF1Password(client(error) as never, 'u1', 'Abc12345')).toEqual({ ok: false, error: key });
  });
});

describe('share text with the app link', () => {
  it('starts with the app address when given', () => {
    expect(createAccountShareText('+84900000444', 'Abc12345', 'https://example.test/app/')).toBe(
      'Ứng dụng: https://example.test/app/\nSố điện thoại: +84900000444\nMật khẩu tạm: Abc12345\nHãy đổi mật khẩu khi đăng nhập lần đầu.',
    );
    expect(createAccountShareText('+849', 'x')).not.toContain('Ứng dụng');
  });

  it('builds the link from origin and path without index.html', () => {
    expect(appLink({ origin: 'https://example.test', pathname: '/app/index.html' })).toBe('https://example.test/app/');
    expect(appLink({ origin: 'https://example.test', pathname: '/app/' })).toBe('https://example.test/app/');
  });
});
