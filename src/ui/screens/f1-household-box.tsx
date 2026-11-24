import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import gameConfig from '../../config/game-config.json';
import { loadGroup, parseGroupConfig, readGroupCache, writeGroupCache } from '../../data/group-service';
import type { GroupData } from '../../data/group-service';
import { f1TotalsLabel, findF1Household, householdActivityNote } from '../group-helpers';
import { STRINGS, groupUpdatedLabel } from '../strings';

const GROUP_CONFIG = parseGroupConfig(gameConfig);

/** Props for {@link F1HouseholdBox}. */
export interface F1HouseholdBoxProps {
  readonly clientPromise: Promise<SupabaseClient>;
  readonly accountId: string;
  /** The contact's Amway code; the box shows only when an F1 household has it. */
  readonly amwayCode: string;
  /** Clock; defaults to the real one. */
  readonly now?: () => Date;
}

function realNow(): Date {
  return new Date();
}

/**
 * "Hộ F1" on an NPP contact's detail page (story 042): the totals of the F1 household with the
 * contact's code ("KH x · NPP y", no target), "N ngày chưa hoạt động" when inactive, and when the
 * numbers were updated. Uses the cached group first and refreshes online; shows nothing when no F1
 * household matches or nothing could be loaded.
 */
export function F1HouseholdBox({ clientPromise, accountId, amwayCode, now = realNow }: F1HouseholdBoxProps) {
  const [group, setGroup] = useState<GroupData | null>(() => readGroupCache(accountId));
  const [stale, setStale] = useState(true);

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
  return (
    <section className="card person-section f1-box" aria-labelledby="f1-box-title">
      <h2 id="f1-box-title" className="person-section__heading">
        {STRINGS.f1BoxTitle}
      </h2>
      {household.numbers === null ? (
        <p className="message">{STRINGS.groupNoNumbers}</p>
      ) : (
        <p className="f1-box__totals">{f1TotalsLabel(household.numbers.customers, household.numbers.f1)}</p>
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
    </section>
  );
}
