import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { friendInviteUrl, loadFriendToken, loadFriends, removeFriend, requestFriendByCode, respondFriend, splitFriends } from '../../data/friends-service';
import type { Friend } from '../../data/friends-service';
import { STRINGS } from '../strings';
import { Dialog } from './person-form';
import { NhomFamilySections, RankingSection, pageRow, sharedLine, useNhom } from './nhom-panel';
import type { NhomProps } from './nhom-panel';

/** Props for {@link GroupScreen}. */
export interface GroupScreenProps {
  readonly clientPromise: Promise<SupabaseClient>;
  readonly onBack: () => void;
  /** Shown above the lists once, e.g. after opening an invite link. */
  readonly notice?: string | null;
  /** Story 070: my Nhóm (vợ/chồng, tuyến trên, tuyến dưới and friends' numbers, cheering). */
  readonly nhom: NhomProps;
  /** The app address the invite link starts with. */
  readonly appUrl?: string;
}

/** First letter of a name for the round avatar. */
function initial(name: string | null): string {
  return (name ?? '?').trim().split(/\s+/).pop()?.charAt(0).toUpperCase() ?? '?';
}

/**
 * Trang "Nhóm" (story 069): invitations to answer, my friends, requests I sent, and "+ Kết bạn"
 * (by Amway code or by sharing my invite link).
 */
export function GroupScreen({ clientPromise, onBack, notice = null, nhom, appUrl = window.location.href }: GroupScreenProps) {
  const n = useNhom(nhom);
  const [list, setList] = useState<Friend[] | null | 'error'>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [open, setOpen] = useState<Friend | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(notice);

  const reload = useCallback(async () => {
    const found = await loadFriends(await clientPromise);
    setList(found ?? 'error');
  }, [clientPromise]);
  useEffect(() => {
    void reload();
  }, [reload]);

  const answer = async (f: Friend, accept: boolean) => {
    setBusy(true);
    const r = await respondFriend(await clientPromise, f.id, accept);
    setBusy(false);
    setMessage(r === 'limit' ? STRINGS.friendLimit : r === 'failed' ? STRINGS.friendError : null);
    await reload();
  };
  const remove = async (f: Friend) => {
    setBusy(true);
    const ok = await removeFriend(await clientPromise, f.id);
    setBusy(false);
    setOpen(null);
    if (!ok) setMessage(STRINGS.friendError);
    await reload();
  };

  const parts = Array.isArray(list) ? splitFriends(list) : null;
  return (
    <main className="screen">
      <header className="screen__header">
        <button type="button" className="back-button" onClick={onBack}>
          ‹ {STRINGS.back}
        </button>
        <div className="today-header">
          <h1 className="screen__title">{STRINGS.groupPageTitle}</h1>
          <button type="button" className="button button--primary group-add" onClick={() => setAddOpen(true)}>
            {STRINGS.friendAdd}
          </button>
        </div>
      </header>

      {message !== null && (
        <p className="message group-notice" role="status">
          {message}
        </p>
      )}
      {list === null && <p className="message">{STRINGS.loading}</p>}
      {list === 'error' && <p className="message message--error">{STRINGS.friendLoadError}</p>}

      {parts !== null && parts.invites.length > 0 && (
        <section aria-labelledby="group-invites">
          <h2 id="group-invites" className="settings-group">
            {STRINGS.friendInvites(parts.invites.length)}
          </h2>
          <div className="card group-list">
            {parts.invites.map((f) => (
              <div key={f.id} className="group-invite">
                <div className="group-row">
                  <span className="group-avatar group-avatar--muted" aria-hidden="true">
                    {initial(f.name)}
                  </span>
                  <span className="group-row__who">
                    <b>{f.name ?? STRINGS.friendNoName}</b>
                    {f.code !== null && <small>{STRINGS.friendCode(f.code)}</small>}
                  </span>
                </div>
                <div className="button-row">
                  <button type="button" className="button button--secondary" onClick={() => void answer(f, false)} disabled={busy}>
                    {STRINGS.friendDecline}
                  </button>
                  <button type="button" className="button button--primary" onClick={() => void answer(f, true)} disabled={busy}>
                    {STRINGS.friendAccept}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <NhomFamilySections n={n} />

      {parts !== null && (
        <section aria-labelledby="group-friends">
          <h2 id="group-friends" className="settings-group">
            {STRINGS.friendSection(parts.friends.length)}
          </h2>
          {parts.friends.length === 0 ? (
            <p className="message group-empty">{STRINGS.friendNone}</p>
          ) : (
            <ul className="card group-list">
              {parts.friends.map((f) => {
                // Story 070: a friend with shared numbers shows them and 👏; tap the name to manage.
                const person = n.people?.find((p) => p.userId === f.id && p.relation === 'friend');
                return (
                  <li key={f.id} className="group-friend">
                    {person !== undefined ? (
                      <div className="group-friend__row">
                        <button type="button" className="group-friend__open" onClick={() => setOpen(f)} aria-label={STRINGS.friendManageAria(f.name ?? STRINGS.friendNoName)} />
                        {pageRow(n, person)}
                        {sharedLine(person) !== null && <p className="group-friend__shared">{sharedLine(person)}</p>}
                      </div>
                    ) : (
                      <button type="button" className="group-row group-row--button" onClick={() => setOpen(f)}>
                        <span className="group-avatar group-avatar--friend" aria-hidden="true">
                          {initial(f.name)}
                        </span>
                        <span className="group-row__who">
                          <b>{f.name ?? STRINGS.friendNoName}</b>
                          {f.code !== null && <small>{STRINGS.friendCode(f.code)}</small>}
                        </span>
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {parts.sent.length > 0 && <p className="message group-sent">{STRINGS.friendSent(parts.sent.length)}</p>}
        </section>
      )}

      <RankingSection n={n} />

      {addOpen && (
        <AddFriendDialog
          clientPromise={clientPromise}
          appUrl={appUrl}
          onClose={() => {
            setAddOpen(false);
            void reload();
          }}
        />
      )}

      {n.picker}

      {open !== null && (
        <Dialog title={open.name ?? STRINGS.friendNoName} onClose={() => setOpen(null)} variant="sheet">
          {open.code !== null && <p className="message">{STRINGS.friendCode(open.code)}</p>}
          <button type="button" className="button button--danger" onClick={() => void remove(open)} disabled={busy}>
            {STRINGS.friendRemove}
          </button>
          <button type="button" className="button button--secondary" onClick={() => setOpen(null)} disabled={busy}>
            {STRINGS.friendClose}
          </button>
        </Dialog>
      )}
    </main>
  );
}

/** "Kết bạn" sheet: a request by Amway code, or my invite link to share. */
function AddFriendDialog({ clientPromise, appUrl, onClose }: { readonly clientPromise: Promise<SupabaseClient>; readonly appUrl: string; readonly onClose: () => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ readonly text: string; readonly ok: boolean } | null>(null);

  const send = async () => {
    setBusy(true);
    const r = await requestFriendByCode(await clientPromise, code);
    setBusy(false);
    if (r === 'sent') {
      setCode('');
      setResult({ text: STRINGS.friendRequestSent, ok: true });
    } else setResult({ text: r === 'invalid' ? STRINGS.amwayCodeInvalid : r === 'limit' ? STRINGS.friendLimit : STRINGS.friendError, ok: false });
  };
  const share = async () => {
    setBusy(true);
    const token = await loadFriendToken(await clientPromise);
    setBusy(false);
    if (token === null) {
      setResult({ text: STRINGS.friendError, ok: false });
      return;
    }
    const url = friendInviteUrl(appUrl, token);
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: STRINGS.friendShareTitle, text: STRINGS.friendShareText, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setResult({ text: STRINGS.friendLinkCopied, ok: true });
    } catch {
      // Share sheet closed: nothing to say.
    }
  };

  return (
    <Dialog title={STRINGS.friendAddTitle} onClose={onClose} variant="sheet">
      <label className="popup__field">
        <span className="form__label">{STRINGS.friendCodeLabel}</span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          className="note__input form__input code-required__input"
          placeholder={STRINGS.amwayCodePlaceholder}
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setResult(null);
          }}
          disabled={busy}
        />
      </label>
      <button type="button" className="button button--primary" onClick={() => void send()} disabled={busy || code.trim() === ''}>
        {STRINGS.friendSend}
      </button>
      {result !== null && (
        <p className={result.ok ? 'group-ok' : 'message message--error'} role={result.ok ? 'status' : 'alert'}>
          {result.text}
        </p>
      )}
      <p className="group-or">{STRINGS.friendOr}</p>
      <button type="button" className="button button--secondary" onClick={() => void share()} disabled={busy}>
        {STRINGS.friendShareLink}
      </button>
      <p className="message">{STRINGS.friendShareHint}</p>
    </Dialog>
  );
}
