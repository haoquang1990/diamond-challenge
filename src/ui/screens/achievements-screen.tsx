import { useCallback, useEffect, useState } from 'react';
import gameConfig from '../../config/game-config.json';
import type { EventStore } from '../../data/event-store';
import type { AchievementsConfig } from '../../domain/achievements';
import { buildAchievementRows, formatEarnedDate } from '../achievements-helpers';
import type { AchievementRow } from '../achievements-helpers';
import { ACHIEVEMENTS_CONFIG } from '../achievements-overlay';
import { PEOPLE_CONFIG } from '../people-config';
import { STRINGS, achievementsEarnedOnLabel, achievementsSummaryLabel } from '../strings';
import { DEFAULT_STAGES } from './diamond-path-screen';

/** Props for {@link AchievementsScreen}. */
export interface AchievementsScreenProps {
  /** Event log the rows are derived from (read only, injected). */
  readonly eventStore: EventStore;
  /** "Quay lại": back to Con đường. */
  readonly onBack: () => void;
  /** Achievements config; defaults to game-config.json. */
  readonly config?: AchievementsConfig;
  /** Clock; defaults to the real one. */
  readonly now?: () => Date;
  /** IANA time zone; defaults to the device's. */
  readonly timeZone?: string;
}

type LoadState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error' }
  | { readonly kind: 'ready'; readonly rows: readonly AchievementRow[] };

function realNow(): Date {
  return new Date();
}

const DEVICE_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * Màn Thành tích: every config milestone in config order, earned ones with a
 * check and their date, the others greyed with how to earn them. Read only:
 * it lists the event log on mount and never appends.
 */
export function AchievementsScreen({
  eventStore,
  onBack,
  config = ACHIEVEMENTS_CONFIG,
  now = realNow,
  timeZone = DEVICE_ZONE,
}: AchievementsScreenProps) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const retry = useCallback(() => {
    setState({ kind: 'loading' });
    setReloadKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    eventStore
      .list()
      .then((events) => {
        if (cancelled) return;
        const deps = { stages: DEFAULT_STAGES, people: PEOPLE_CONFIG, progress: { dailyXpGoal: gameConfig.dailyXpGoal } };
        setState({ kind: 'ready', rows: buildAchievementRows(events, config, now(), timeZone, deps) });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error('[achievements] failed to read the event log', error);
        setState({ kind: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [eventStore, config, now, timeZone, reloadKey]);

  const earnedCount = state.kind === 'ready' ? state.rows.filter((r) => r.earned).length : 0;

  return (
    <main className="screen">
      <header className="screen__header">
        <button type="button" className="back-button" onClick={onBack}>
          {STRINGS.back}
        </button>
        <h1 className="screen__title">{STRINGS.achievementsTitle}</h1>
        {state.kind === 'ready' ? (
          <p className="screen__prompt">{achievementsSummaryLabel(earnedCount, state.rows.length)}</p>
        ) : (
          <p className="screen__prompt">{STRINGS.achievementsPrompt}</p>
        )}
      </header>

      {state.kind === 'loading' && (
        <p className="message" role="status">
          {STRINGS.loading}
        </p>
      )}
      {state.kind === 'error' && (
        <div className="card">
          <p className="message message--error" role="alert">
            {STRINGS.achievementsLoadError}
          </p>
          <button type="button" className="button button--secondary" onClick={retry}>
            {STRINGS.retry}
          </button>
        </div>
      )}
      {state.kind === 'ready' && state.rows.length === 0 && <p className="message">{STRINGS.achievementsEmpty}</p>}
      {state.kind === 'ready' && state.rows.length > 0 && (
        <ul className="achv-list">
          {state.rows.map((row) => (
            <li key={row.id} className={row.earned ? 'achv-item achv-item--earned' : 'achv-item'}>
              <span className="achv-item__mark" aria-hidden="true">
                {row.earned ? '✓' : '◇'}
              </span>
              <span className="achv-item__body">
                <span className="achv-item__name">
                  {row.name}
                  <span className="visually-hidden"> · {row.earned ? STRINGS.achievementsEarned : STRINGS.achievementsNotEarned}</span>
                </span>
                {row.earned && row.earnedAt === 'before' && <span className="achv-item__detail">{STRINGS.achievementsEarnedBefore}</span>}
                {row.earned && row.earnedAt !== null && row.earnedAt !== 'before' && (
                  <span className="achv-item__detail">{achievementsEarnedOnLabel(formatEarnedDate(row.earnedAt, timeZone))}</span>
                )}
                {row.progressText !== null && <span className="achv-item__detail">{row.progressText}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
