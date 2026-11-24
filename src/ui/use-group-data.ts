/**
 * The F1 group (households, members, shared numbers) for screens outside the old Nhóm screen
 * (story 044): the cached copy first, refreshed from the server when online. Null when signed
 * out, never loaded, or the load failed with nothing cached.
 */
import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import gameConfig from '../config/game-config.json';
import { loadGroup, parseGroupConfig, readGroupCache, writeGroupCache } from '../data/group-service';
import type { GroupData } from '../data/group-service';

const GROUP_CONFIG = parseGroupConfig(gameConfig);

/**
 * @example
 * const group = useGroupData(clientPromise, account?.accountId ?? null, reloadKey);
 */
export function useGroupData(clientPromise: Promise<SupabaseClient> | null, accountId: string | null, reloadKey = 0): GroupData | null {
  const [group, setGroup] = useState<GroupData | null>(() => (accountId === null ? null : readGroupCache(accountId)));
  useEffect(() => {
    if (clientPromise === null || accountId === null) {
      setGroup(null);
      return undefined;
    }
    setGroup((current) => current ?? readGroupCache(accountId));
    if (!navigator.onLine) return undefined;
    let cancelled = false;
    clientPromise
      .then((client) => loadGroup(client, accountId, gameConfig.maxHouseholdMembers, GROUP_CONFIG.cheersPerDay, new Date()))
      .then((data) => {
        if (cancelled || data === null) return;
        writeGroupCache(accountId, data);
        setGroup(data);
      })
      .catch((error: unknown) => console.error('[group] could not read the group', error));
    return () => {
      cancelled = true;
    };
  }, [clientPromise, accountId, reloadKey]);
  return group;
}
