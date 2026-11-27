import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import gameConfig from '../../config/game-config.json';
import { loadHousehold } from '../../data/account-service';
import type { HouseholdInfo } from '../../data/account-service';
import { STRINGS, householdCountLabel, householdFullNote, streakDaysLabel } from '../strings';
import { formatE164 } from '../../domain/people';
import { AddMemberForm } from './add-member-form';
import { loadMemberProgress } from '../../data/group-service';
import type { GroupHousehold, MemberProgress } from '../../data/group-service';
import { agoLabel, householdInsight, householdProgressLabel, localDayKey, tasks7dLabel } from '../group-helpers';

/** Props for {@link HouseholdScreen}. */
export interface HouseholdScreenProps {
  /** Lazy Supabase client (from `getSupabaseClient`). */
  readonly clientPromise: Promise<SupabaseClient>;
  /** Signed-in account id (the household is looked up through it). */
  readonly accountId: string;
  /** Back to Cài đặt. */
  readonly onBack: () => void;
  /** Opens straight on "Thêm người đứng chung"; closing it goes back (story 055). */
  readonly startAdding?: boolean;
}

/** Load state: `offline` and `error` show a short message instead of the household. */
type LoadState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'offline' }
  | { readonly kind: 'error' }
  | { readonly kind: 'ready'; readonly info: HouseholdInfo };

/**
 * Màn "Hộ của tôi" (story 025, no tab bar): the household's active Amway code ("Chưa có mã" when
 * none), the members (display name, else phone) with "x/max thành viên", and "Thêm vợ/chồng" while
 * there is room (a note when full; locked with a reason offline). Reads need the network.
 *
 * @example
 * <HouseholdScreen clientPromise={client} accountId={id} onBack={back} />
 */
export function HouseholdScreen({ clientPromise, accountId, onBack, startAdding = false }: HouseholdScreenProps) {
  const { state, online, reload } = useHousehold(clientPromise, accountId);
  const [adding, setAdding] = useState(startAdding);
  if (adding) {
    const householdId = state.kind === 'ready' ? state.info.householdId : null;
    return (
      <AddMemberForm
        clientPromise={clientPromise}
        {...(householdId === null ? {} : { householdId })}
        onAdded={reload}
        onClose={() => (startAdding ? onBack() : setAdding(false))}
      />
    );
  }

  return (
    <main className="screen">
      <header className="screen__header">
        <button type="button" className="back-button" onClick={onBack}>
          ‹ {STRINGS.back}
        </button>
        <h1 className="screen__title">{STRINGS.householdTitle}</h1>
        <p className="screen__prompt">{STRINGS.householdPrompt}</p>
      </header>

      {state.kind === 'loading' && (
        <p className="message" role="status">
          {STRINGS.loading}
        </p>
      )}
      {state.kind === 'offline' && (
        <section className="card form">
          <p className="message" role="status">
            {STRINGS.householdOffline}
          </p>
          <button type="button" className="button button--primary" disabled>
            {STRINGS.addMemberButton}
          </button>
          <p className="message">{STRINGS.addMemberOfflineReason}</p>
        </section>
      )}
      {state.kind === 'error' && (
        <div className="card">
          <p className="message message--error" role="alert">
            {STRINGS.householdLoadError}
          </p>
          <button type="button" className="button button--secondary" onClick={reload}>
            {STRINGS.retry}
          </button>
        </div>
      )}
      {state.kind === 'ready' && (
        <>
          {state.info.householdId === null ? (
            <p className="message">{STRINGS.householdNoHousehold}</p>
          ) : (
            <>
              <section className="card form" aria-labelledby="household-code-title">
                <h2 id="household-code-title" className="card__title">
                  {STRINGS.householdCodeLabel}
                </h2>
                <p className="account-name">{state.info.code ?? STRINGS.householdNoCode}</p>
              </section>
              <section className="card form" aria-labelledby="household-members-title">
                <h2 id="household-members-title" className="card__title">
                  {STRINGS.householdMembersHeading}
                </h2>
                <p className="card__body">{householdCountLabel(state.info.members.length, state.info.maxMembers)}</p>
                <ul className="member-list">
                  {state.info.members.map((m) => (
                    <li key={m.userId} className="member-list__item">
                      {m.displayName ?? (m.phone === null ? null : formatE164(m.phone)) ?? STRINGS.householdMemberUnnamed}
                    </li>
                  ))}
                </ul>
                {state.info.members.length < state.info.maxMembers ? (
                  <>
                    <button type="button" className="button button--primary" onClick={() => setAdding(true)} disabled={!online}>
                      {STRINGS.addMemberButton}
                    </button>
                    {!online && <p className="message">{STRINGS.addMemberOfflineReason}</p>}
                  </>
                ) : (
                  <p className="message">{householdFullNote(state.info.maxMembers)}</p>
                )}
              </section>
            </>
          )}
        </>
      )}
    </main>
  );
}

/** Loads my household (code, members) when online; reload on demand (story 025, 055). */
function useHousehold(clientPromise: Promise<SupabaseClient>, accountId: string) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [online, setOnline] = useState(() => navigator.onLine);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  useEffect(() => {
    if (!online) {
      setState({ kind: 'offline' });
      return;
    }
    let cancelled = false;
    clientPromise
      .then((client) => loadHousehold(client, accountId, gameConfig.maxHouseholdMembers))
      .then((info) => {
        if (!cancelled) setState(info === null ? { kind: 'error' } : { kind: 'ready', info });
      })
      .catch((error: unknown) => {
        console.error('[household] could not read the household', error);
        if (!cancelled) setState({ kind: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [clientPromise, accountId, online, reloadKey]);

  return { state, online, reload };
}

/** Props for {@link HouseholdCard}. */
export interface HouseholdCardProps {
  readonly clientPromise: Promise<SupabaseClient>;
  readonly accountId: string;
  /** Opens "Thêm người đứng chung (mã số kép)". */
  readonly onAddMember: () => void;
}

/**
 * Cài đặt "Mã số của tôi" (story 055): the Amway code and the people on it (me marked "Bạn",
 * others by name and phone), a note on the shared code, and "Thêm người đứng chung" while there is
 * room (locked with a reason offline). Needs the network to read.
 */
export function HouseholdCard({ clientPromise, accountId, onAddMember }: HouseholdCardProps) {
  const { state, online, reload } = useHousehold(clientPromise, accountId);
  // Story 061: the other member's shared numbers, shown when their row is opened.
  const [progress, setProgress] = useState<ReadonlyMap<string, MemberProgress>>(() => new Map());
  const memberKey = state.kind === 'ready' ? state.info.members.map((m) => m.userId).join(',') : '';
  useEffect(() => {
    if (memberKey === '' || !navigator.onLine) return undefined;
    let cancelled = false;
    void clientPromise
      .then((client) => loadMemberProgress(client, memberKey.split(',').filter((id) => id !== accountId)))
      .then((map) => {
        if (!cancelled) setProgress(map);
      })
      .catch((error: unknown) => console.warn('[household] spouse numbers not loaded', error));
    return () => {
      cancelled = true;
    };
  }, [clientPromise, accountId, memberKey]);
  return (
    <section className="card form household-card" aria-label={STRINGS.householdTitle}>
      {state.kind === 'loading' && (
        <p className="message" role="status">
          {STRINGS.loading}
        </p>
      )}
      {state.kind === 'offline' && <p className="message">{STRINGS.householdOffline}</p>}
      {state.kind === 'error' && (
        <>
          <p className="message message--error" role="alert">
            {STRINGS.householdLoadError}
          </p>
          <button type="button" className="button button--secondary" onClick={reload}>
            {STRINGS.retry}
          </button>
        </>
      )}
      {state.kind === 'ready' &&
        (state.info.householdId === null ? (
          <p className="message">{STRINGS.householdNoHousehold}</p>
        ) : (
          <>
            <div className="household-card__row">
              <span className="household-card__key">{STRINGS.householdCodeLabel}</span>
              <span className="household-card__value">{state.info.code ?? STRINGS.householdNoCode}</span>
            </div>
            <p className="household-card__key">{STRINGS.householdMembersHeading}</p>
            <ul className="household-card__members">
              {state.info.members.map((m) => {
                const name = m.displayName ?? (m.phone === null ? STRINGS.householdMemberUnnamed : formatE164(m.phone));
                const p = progress.get(m.userId);
                if (m.userId === accountId || p === undefined) {
                  return (
                    <li key={m.userId} className="household-card__member">
                      <strong>{name}</strong>
                      <span>{m.userId === accountId ? STRINGS.householdMe : m.phone === null ? '' : formatE164(m.phone)}</span>
                    </li>
                  );
                }
                return (
                  <li key={m.userId} className="household-card__member household-card__member--open">
                    <details className="household-card__details">
                      <summary className="household-card__summary">
                        <strong>{name} ▾</strong>
                        <span>{m.phone === null ? '' : formatE164(m.phone)}</span>
                      </summary>
                      <MemberNumbers progress={p} />
                    </details>
                  </li>
                );
              })}
            </ul>
            <p className="message">{state.info.members.length < state.info.maxMembers ? STRINGS.householdSingleHint : STRINGS.householdSharedHint}</p>
            {state.info.members.length < state.info.maxMembers && (
              <>
                <button type="button" className="button button--secondary" onClick={onAddMember} disabled={!online}>
                  {STRINGS.addMemberButton}
                </button>
                {!online && <p className="message">{STRINGS.addMemberOfflineReason}</p>}
              </>
            )}
          </>
        ))}
    </section>
  );
}

/** One member's shared numbers (story 061), laid out like the NPP F1 box. */
function MemberNumbers({ progress }: { readonly progress: MemberProgress }) {
  const now = new Date();
  const insight = householdInsight({ members: [{ userId: '', displayName: null, phone: null, progress, activated: true }] } as unknown as GroupHousehold, localDayKey(now));
  return (
    <div className="member-numbers">
      <div className="f1-box__today">
        <span className={insight?.goalToday === true ? 'f1-box__pill f1-box__pill--ok' : 'f1-box__pill'} aria-label={insight?.goalToday === true ? STRINGS.f1InsightGoalMet : STRINGS.f1InsightGoalNot}>
          <span className={insight?.goalToday === true ? 'goal-dot goal-dot--ok' : 'goal-dot'} aria-hidden="true">
            {insight?.goalToday === true ? '✓' : ''}
          </span>
          <span aria-hidden="true">{STRINGS.f1RowToday}</span>
        </span>
        <span className={progress.streak > 0 ? 'f1-box__pill f1-box__pill--fire' : 'f1-box__pill'}>{streakDaysLabel(progress.streak)}</span>
      </div>
      {insight !== null && insight.lastSeenAt !== null ? (
        <ul className="f1-box__insight">
          <li className="f1-box__fact">
            {STRINGS.f1InsightActiveDays} <strong>{insight.activeDays7d}/7</strong> ngày · {progress.xp7d.toLocaleString('vi-VN')} XP
          </li>
          <li className="f1-box__fact">
            {STRINGS.f1InsightTasks}: {tasks7dLabel(insight.tasks7d)}
          </li>
          <li className="f1-box__fact">
            {STRINGS.f1InsightLessons} <strong>{insight.lessonsDistinct}</strong> bài · {STRINGS.f1InsightBadges}: {insight.badges7d}
          </li>
          <li className="f1-box__fact">
            {insight.goalXp != null ? `Mục tiêu ${insight.goalXp} XP/ngày · ` : ''}
            {STRINGS.f1InsightSeen}: {agoLabel(insight.lastSeenAt, now)}
          </li>
        </ul>
      ) : (
        <p className="message">{householdProgressLabel({ xpTotal: progress.xpTotal, xp7d: progress.xp7d, streak: progress.streak })}</p>
      )}
    </div>
  );
}
