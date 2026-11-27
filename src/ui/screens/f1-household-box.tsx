import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import gameConfig from '../../config/game-config.json';
import { loadGroup, parseGroupConfig, readGroupCache, writeGroupCache } from '../../data/group-service';
import type { GroupData } from '../../data/group-service';
import { agoLabel, f1LoginName, localDayKey, f1TotalsLabel, findF1Household, householdActivityNote, householdInsight, householdProgress, householdProgressLabel, tasks7dLabel } from '../group-helpers';
import { generateTempPassword, resendF1Password } from '../../data/account-service';
import type { ResendPasswordError } from '../../data/account-service';
import { STRINGS, appLink, createAccountShareText, groupUpdatedLabel } from '../strings';
import { Dialog } from './person-form';
import { formatE164 } from '../../domain/people';

const GROUP_CONFIG = parseGroupConfig(gameConfig);
const NO_NAMES: ReadonlyMap<string, string> = new Map();

/** Props for {@link F1HouseholdBox}. */
export interface F1HouseholdBoxProps {
  readonly clientPromise: Promise<SupabaseClient>;
  readonly accountId: string;
  /** The contact's Amway code; the box shows only when an F1 household has it. */
  readonly amwayCode: string;
  /** Clock; defaults to the real one. */
  readonly now?: () => Date;
  /** My contact names by account id (story 059), for the login rows. */
  readonly contactNames?: ReadonlyMap<string, string>;
}

function realNow(): Date {
  return new Date();
}

/**
 * "Hộ F1" on an NPP contact's detail page (story 042): the totals of the F1 household with the
 * contact's code ("KH x · NPP y", no target), "N ngày chưa hoạt động" when inactive, and when the
 * numbers were updated. Uses the cached group first and refreshes online; shows nothing when no F1
 * household matches or nothing could be loaded. Story 048: each member's login (phone) with
 * "Cấp lại mật khẩu tạm" (server-checked: my direct F1, never activated) and a once-only popup
 * with the app link, phone and new password to copy or share.
 */
export function F1HouseholdBox({ clientPromise, accountId, amwayCode, now = realNow, contactNames = NO_NAMES }: F1HouseholdBoxProps) {
  const [group, setGroup] = useState<GroupData | null>(() => readGroupCache(accountId));
  const [stale, setStale] = useState(true);
  const [busyUser, setBusyUser] = useState<string | null>(null);
  const [resendError, setResendError] = useState<ResendPasswordError | null>(null);
  const [issued, setIssued] = useState<{
    readonly phone: string;
    readonly password: string;
  } | null>(null);
  const [copyNote, setCopyNote] = useState<string | null>(null);

  /** Story 048: a new temporary password for a never-activated member of this F1 household. */
  const resend = async (userId: string, phone: string) => {
    if (busyUser !== null) return;
    setBusyUser(userId);
    setResendError(null);
    try {
      const password = generateTempPassword();
      const r = await resendF1Password(await clientPromise, userId, password);
      if (r.ok) {
        setCopyNote(null);
        setIssued({ phone, password });
      } else setResendError(r.error);
    } catch (error) {
      console.error('[f1-box] resend failed', error);
      setResendError('network');
    }
    setBusyUser(null);
  };

  useEffect(() => {
    if (!navigator.onLine) return undefined;
    let cancelled = false;
    clientPromise
      .then((client) => loadGroup(client, accountId, gameConfig.maxHouseholdMembers, GROUP_CONFIG.cheersPerDay, now()))
      .then((data) => {
        if (cancelled || data === null) return;
        writeGroupCache(accountId, data);
        setGroup(data);
        setStale(false);
      })
      .catch((error: unknown) => console.error('[f1-box] could not read the group', error));
    return () => {
      cancelled = true;
    };
  }, [clientPromise, accountId, now]);

  const household = group === null ? null : findF1Household(group.households, amwayCode);
  if (group === null || household === null) return null;
  const activity = householdActivityNote(household, now(), GROUP_CONFIG.inactiveDays);
  const progress = householdProgress(household);
  const nowDate = now();
  const insight = householdInsight(household, localDayKey(nowDate));
  return (
    <section className="card person-section f1-box" aria-labelledby="f1-box-title">
      <h2 id="f1-box-title" className="person-section__heading">
        {STRINGS.f1BoxTitle}
      </h2>
      {household.numbers === null ? <p className="message">{STRINGS.groupNoNumbers}</p> : <p className="f1-box__totals">{f1TotalsLabel(household.numbers.customers, household.numbers.f1)}</p>}
      {progress !== null && <p className="f1-box__progress">{householdProgressLabel(progress)}</p>}
      {insight !== null && insight.lastSeenAt !== null && (
        <ul className="f1-box__insight" aria-label={STRINGS.f1InsightTasks}>
          <li className={insight.goalToday ? 'f1-box__fact f1-box__fact--ok' : 'f1-box__fact'}>{insight.goalToday ? STRINGS.f1InsightGoalMet : STRINGS.f1InsightGoalNot}
            {insight.goalXp != null ? ` (${insight.goalXp} XP)` : ''}</li>
          <li className="f1-box__fact">
            {STRINGS.f1InsightActiveDays} <strong>{insight.activeDays7d}/7</strong> ngày
          </li>
          <li className="f1-box__fact">
            {STRINGS.f1InsightTasks}: {tasks7dLabel(insight.tasks7d)}
          </li>
          <li className="f1-box__fact">
            {STRINGS.f1InsightLessons} <strong>{insight.lessonsDistinct}</strong> bài
            {insight.lastLessonAt !== null ? ` · gần nhất ${agoLabel(insight.lastLessonAt, nowDate)}` : ''}
            {` · ${STRINGS.f1InsightBadges}: ${insight.badges7d}`}
          </li>
          <li className="f1-box__fact">
            {STRINGS.f1InsightSeen}: {agoLabel(insight.lastSeenAt, nowDate)}
          </li>
        </ul>
      )}
      {activity !== null && (
        <p className="message message--warn" role="status">
          {activity}
        </p>
      )}
      <p className="group-house__updated">
        {household.numbers === null ? groupUpdatedLabel(group.loadedAt) : groupUpdatedLabel(household.numbers.updatedAt)}
        {stale && !navigator.onLine ? ` · ${STRINGS.f1BoxOffline}` : ''}
      </p>
      {household.members.some((m) => m.phone !== null) && (
        <ul className="f1-box__logins" aria-label={STRINGS.f1BoxLogin}>
          {household.members
            .filter((m) => m.phone !== null)
            .map((m) => (
              <li key={m.userId} className="f1-box__login">
                <span>
                  {(() => {
                    const name = f1LoginName(m, contactNames);
                    return name === null ? `${STRINGS.f1BoxLogin}: ${formatE164(m.phone ?? '')}` : `${name} · ${formatE164(m.phone ?? '')}`;
                  })()}
                  {m.activated === false && <span className="f1-box__badge">{STRINGS.f1NotActivated}</span>}
                </span>
                {m.activated !== true && (
                  <button type="button" className="button button--secondary" disabled={!navigator.onLine || busyUser !== null} onClick={() => void resend(m.userId, m.phone ?? '')}>
                    {STRINGS.f1ResendButton}
                  </button>
                )}
              </li>
            ))}
        </ul>
      )}
      {!navigator.onLine && <p className="message">{STRINGS.f1ResendOffline}</p>}
      {resendError !== null && (
        <p className="message message--error" role="alert">
          {STRINGS.f1ResendErrors[resendError]}
        </p>
      )}
      {issued !== null && (
        <Dialog title={STRINGS.f1ResendTitle} onClose={() => setIssued(null)}>
          {(() => {
            const link = appLink(window.location);
            const text = createAccountShareText(issued.phone, issued.password, link);
            return (
              <>
                <p className="popup__body">{STRINGS.createAccountOnce}</p>
                <p className="message">
                  {STRINGS.appLinkLine}: <strong className="temp-link">{link}</strong>
                </p>
                <p className="message">
                  {STRINGS.createAccountPhoneLine}: <strong>{formatE164(issued.phone)}</strong>
                </p>
                <p className="message">
                  {STRINGS.createAccountPasswordLine}: <strong className="temp-password">{issued.password}</strong>
                </p>
                <div className="button-row">
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(text)
                        .then(() => setCopyNote(STRINGS.createAccountCopied))
                        .catch(() => setCopyNote(STRINGS.createAccountCopyFailed))
                    }
                  >
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
                <button type="button" className="button button--primary" onClick={() => setIssued(null)}>
                  {STRINGS.createAccountFinish}
                </button>
              </>
            );
          })()}
        </Dialog>
      )}
    </section>
  );
}
