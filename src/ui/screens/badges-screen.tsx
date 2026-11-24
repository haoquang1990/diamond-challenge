import { useEffect, useMemo, useState } from 'react';
import type { EventStore, LogEvent } from '../../data/event-store';
import { tierColor, tierLabel } from '../../domain/badges';
import type { BadgeRow } from '../../domain/badges';
import { BADGES, evaluateBadges } from '../badges-content';
import { resolveLessonIcon } from '../lesson-icons';
import { STRINGS, badgesSummaryLabel, badgeProgressLabel } from '../strings';
import { PathIcon } from './lesson-path';
import { Dialog } from './person-form';

/** Props for {@link BadgesScreen}. */
export interface BadgesScreenProps {
  readonly eventStore: EventStore;
  /** Household member ids (their events are not mine). */
  readonly memberIds: ReadonlySet<string>;
  /** Bumped when synced data changes, to re-read the log. */
  readonly dataVersion?: number;
  readonly now?: () => Date;
  readonly timeZone?: string;
}

type Filter = 'all' | 'done' | 'todo';
const FILTERS: readonly Filter[] = ['all', 'done', 'todo'];

/** Medal colour class of a badge card: the colour of its highest reached tier, grey when none. */
function medalClass(row: BadgeRow): string {
  return row.reached === 0 ? 'medal medal--t0' : `medal medal--t${tierColor(row.reached - 1, row.def.thresholds.length)}`;
}

/** Ids of the latest acknowledged badge tiers, newest first. */
function recentBadgeIds(events: readonly LogEvent[], limit: number): string[] {
  const out: string[] = [];
  for (let i = events.length - 1; i >= 0 && out.length < limit; i--) {
    const e = events[i];
    const id = e?.payload.achievementAcknowledged;
    if (e?.type === 'settings_changed' && typeof id === 'string' && id.startsWith('badge:') && e.payload.silent !== true && !out.includes(id)) out.push(id);
  }
  return out;
}

/**
 * Màn "Huy hiệu" (stories 045–047, the fourth tab instead of Con đường): how many of the 150
 * badges are earned, the latest ones, a filter (Tất cả / Đã có / Chưa có) and the badge cards by
 * group. Each card shows its medal in the colour of its highest tier, tier dots, a progress bar
 * to the next tier and opens a popup listing every tier. Read-only.
 */
export function BadgesScreen({ eventStore, memberIds, dataVersion = 0, now = () => new Date(), timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone }: BadgesScreenProps) {
  const [events, setEvents] = useState<readonly LogEvent[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<BadgeRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    eventStore
      .list()
      .then((list) => {
        if (!cancelled) setEvents(list);
      })
      .catch((error: unknown) => {
        console.error('[badges] could not read the event log', error);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [eventStore, dataVersion]);

  const evaluated = useMemo(() => (events === null ? null : evaluateBadges(events, now(), timeZone, memberIds)), [events, now, timeZone, memberIds]);

  if (failed) {
    return (
      <main className="screen screen--tabbed">
        <p className="message message--error" role="alert">
          {STRINGS.loadError}
        </p>
      </main>
    );
  }
  if (evaluated === null || events === null) {
    return (
      <main className="screen screen--tabbed">
        <p className="message" role="status">
          {STRINGS.loading}
        </p>
      </main>
    );
  }

  const total = BADGES.defs.reduce((sum, d) => sum + d.thresholds.length, 0);
  const earned = evaluated.achieved.length;
  const goldPlus = evaluated.rows.reduce(
    (sum, r) => sum + r.def.thresholds.slice(0, r.reached).filter((_, i) => tierColor(i, r.def.thresholds.length) >= 3).length,
    0,
  );
  const recent = recentBadgeIds(events, 3)
    .map((id) => {
      const [, defId, n] = id.split(':');
      const row = evaluated.rows.find((r) => r.def.id === defId);
      return row === undefined ? null : { id, row, label: tierLabel(row.def, Number(n)) };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  const visible = (r: BadgeRow) => filter === 'all' || (filter === 'done' ? r.reached > 0 : r.reached === 0);

  return (
    <main className="screen screen--tabbed badges">
      <header className="screen__header">
        <h1 className="screen__title">{STRINGS.badgesTitle}</h1>
      </header>

      <div className="badges__summary">
        <div className="badges__stat">
          <b>{badgesSummaryLabel(earned, total)}</b>
          <span>{STRINGS.badgesEarned}</span>
        </div>
        <div className="badges__stat">
          <b>{goldPlus}</b>
          <span>{STRINGS.badgesGoldPlus}</span>
        </div>
      </div>

      {recent.length > 0 && (
        <section className="badges__recent" aria-labelledby="badges-recent">
          <h2 id="badges-recent" className="badges__heading">
            {STRINGS.badgesRecent}
          </h2>
          <ul>
            {recent.map(({ id, row, label }) => (
              <li key={id}>
                <span className={medalClass(row)}>
                  <PathIcon shapes={resolveLessonIcon(row.def.icon)} />
                </span>
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="filter-bar" role="group" aria-label={STRINGS.badgesFilterLabel}>
        {FILTERS.map((f) => (
          <button key={f} type="button" className={f === filter ? 'chip chip--selected' : 'chip'} aria-pressed={f === filter} onClick={() => setFilter(f)}>
            {STRINGS.badgesFilters[f]}
          </button>
        ))}
      </div>

      {BADGES.groups.map((group) => {
        const rows = evaluated.rows.filter((r) => r.def.group === group.id);
        const shown = rows.filter(visible);
        if (shown.length === 0) return null;
        const got = rows.reduce((sum, r) => sum + r.reached, 0);
        const all = rows.reduce((sum, r) => sum + r.def.thresholds.length, 0);
        return (
          <section key={group.id} className="badges__group" aria-labelledby={`badges-${group.id}`}>
            <h2 id={`badges-${group.id}`} className="badges__heading">
              {group.title} <span>{badgesSummaryLabel(got, all)}</span>
            </h2>
            <div className="badges__grid">
              {shown.map((row) => (
                <button key={row.def.id} type="button" className="badge-card" onClick={() => setOpen(row)} aria-label={`${row.def.name}, ${badgeProgressLabel(row.reached, row.def.thresholds.length)}`}>
                  <span className={medalClass(row)}>
                    <PathIcon shapes={resolveLessonIcon(row.def.icon)} />
                  </span>
                  <span className="badge-card__name">{row.def.name}</span>
                  {row.def.thresholds.length > 1 && (
                    <span className="badge-card__pips" aria-hidden="true">
                      {row.def.thresholds.map((t, i) => (
                        <i key={t} className={i < row.reached ? 'on' : undefined} />
                      ))}
                    </span>
                  )}
                  {row.next === null ? (
                    <span className="badge-card__prog">{STRINGS.badgesDone}</span>
                  ) : (
                    <>
                      <span className="badge-card__bar" aria-hidden="true">
                        <i style={{ width: `${Math.min(100, Math.round((100 * row.value) / row.next))}%` }} />
                      </span>
                      <span className="badge-card__prog">
                        {row.value.toLocaleString('vi-VN')}/{row.next.toLocaleString('vi-VN')}
                      </span>
                    </>
                  )}
                </button>
              ))}
            </div>
          </section>
        );
      })}

      {open !== null && (
        <Dialog title={open.def.name} onClose={() => setOpen(null)}>
          <div className="badge-sheet__medal">
            <span className={medalClass(open)}>
              <PathIcon shapes={resolveLessonIcon(open.def.icon)} />
            </span>
          </div>
          <p className="popup__body">
            {open.def.description} · {STRINGS.badgesNow} {open.value.toLocaleString('vi-VN')}
          </p>
          <ul className="badge-sheet__tiers">
            {open.def.thresholds.map((t, i) => (
              <li key={t} className={i < open.reached ? 'done' : 'todo'}>
                <span className={i < open.reached ? `tier-dot tier-dot--t${tierColor(i, open.def.thresholds.length)}` : 'tier-dot'} aria-hidden="true" />
                {tierLabel(open.def, t)}
                {i < open.reached ? ' ✓' : ''}
              </li>
            ))}
          </ul>
          <button type="button" className="button button--primary" onClick={() => setOpen(null)}>
            {STRINGS.historyClose}
          </button>
        </Dialog>
      )}
    </main>
  );
}
