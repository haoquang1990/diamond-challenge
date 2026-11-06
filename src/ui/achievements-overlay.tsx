import { useCallback, useEffect, useRef, useState } from 'react';
import gameConfig from '../config/game-config.json';
import type { EventStore, LogEvent } from '../data/event-store';
import {
  buildSeedEvents,
  evaluateAchievements,
  newAchievements,
  parseAchievementsConfig,
  pickEncouragement,
  planPopups,
  queueToasts,
  readAcknowledged,
  buildToast,
} from '../domain/achievements';
import type { AchievedItem, PopupPlanEntry } from '../domain/achievements';
import type { QueuedToast } from '../domain/achievements';
import {
  acknowledgePayload,
  itemsToSeed,
  popupTitle,
  stageItemId,
  toastNameFor,
} from './achievements-helpers';
import type { ObservedStore } from './achievements-helpers';
import { ACTIVITY_TYPES } from './activity-types';
import { PEOPLE_CONFIG, PERSON_TASKS } from './people-config';
import { playTing } from './play-ting';
import { DEFAULT_STAGES, buildStageView } from './screens/diamond-path-screen';
import { STRINGS, popupRestTitle, toastLabel, toastMergedLabel } from './strings';

/** Achievements config from game-config.json, validated once at load. */
export const ACHIEVEMENTS_CONFIG = parseAchievementsConfig(
  gameConfig.achievements,
  PEOPLE_CONFIG.targets,
  DEFAULT_STAGES.map((s) => s.id),
);
if (ACHIEVEMENTS_CONFIG.problems.length > 0) console.warn('[achievements] config problems', ACHIEVEMENTS_CONFIG.problems);

const DAILY_XP_GOAL = gameConfig.dailyXpGoal;
const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
const CONFETTI_PIECES = 18;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Popup entry plus the items it acknowledges and its chosen encouragement. */
interface ActivePopup {
  readonly entry: PopupPlanEntry;
  /** Items acknowledged when this popup starts (a 'rest' entry holds all remaining items). */
  readonly items: readonly AchievedItem[];
  readonly encouragement: string;
  readonly key: number;
}

/** Props for {@link AchievementsOverlay}. */
export interface AchievementsOverlayProps {
  /** Observed store (its `subscribe` reports saved events). */
  readonly observed: ObservedStore;
  /** Raw store used for the overlay's own writes, so they never re-trigger checks. */
  readonly rawStore: EventStore;
  /** Current tab id; a change triggers a milestone check. */
  readonly tab: string;
  /** Told when a popup opens or closes (the app makes the background inert). */
  readonly onPopupOpenChange: (open: boolean) => void;
}

/**
 * XP toasts and milestone popups, mounted once above every screen. Toasts show
 * one at a time at the top edge; a popup blocks the screen and toasts wait.
 * Milestones are checked after each saved event, on mount and on tab change.
 */
export function AchievementsOverlay({ observed, rawStore, tab, onPopupOpenChange }: AchievementsOverlayProps) {
  const [pendingToasts, setPendingToasts] = useState<readonly QueuedToast[]>([]);
  const [toast, setToast] = useState<QueuedToast | null>(null);
  const [popup, setPopup] = useState<ActivePopup | null>(null);
  const popupQueue = useRef<ActivePopup[]>([]);
  const currentPopup = useRef<ActivePopup | null>(null);
  const seenIds = useRef<Set<string>>(new Set());
  const running = useRef(false);
  const again = useRef(false);
  const keyCounter = useRef(0);
  const lastEncouragement = useRef<string | null>(null);
  const popupOpen = popup !== null;

  useEffect(() => onPopupOpenChange(popupOpen), [popupOpen, onPopupOpenChange]);

  const acknowledge = useCallback(
    async (items: readonly AchievedItem[]) => {
      for (const item of items) {
        const payload = acknowledgePayload(item, ACHIEVEMENTS_CONFIG.items);
        if (payload === null) continue;
        try {
          await rawStore.append({ type: 'settings_changed', payload });
        } catch (error) {
          console.error('[achievements] could not save the acknowledgement', error);
        }
      }
    },
    [rawStore],
  );

  const showNext = useCallback(() => {
    const next = popupQueue.current.shift() ?? null;
    currentPopup.current = next;
    setPopup(next);
    if (next !== null) {
      playTing();
      void acknowledge(next.items);
    }
  }, [acknowledge]);

  const enqueuePopups = useCallback(
    (entries: readonly { entry: PopupPlanEntry; items: readonly AchievedItem[] }[]) => {
      for (const { entry, items } of entries) {
        const encouragement = pickEncouragement(ACHIEVEMENTS_CONFIG.encouragements, lastEncouragement.current, Math.random);
        lastEncouragement.current = encouragement;
        keyCounter.current += 1;
        popupQueue.current.push({ entry, items, encouragement, key: keyCounter.current });
      }
      if (currentPopup.current === null) showNext();
    },
    [showNext],
  );

  const checkOnce = useCallback(async () => {
    const events = await rawStore.list();
    const now = new Date();
    const deps = { stages: DEFAULT_STAGES, people: PEOPLE_CONFIG, progress: { dailyXpGoal: DAILY_XP_GOAL } };
    const achieved = evaluateAchievements(events, ACHIEVEMENTS_CONFIG, now, TIME_ZONE, deps);
    let ack = readAcknowledged(events, DEFAULT_STAGES);
    if (!ack.seeded) {
      const celebrate = buildStageView(events, DEFAULT_STAGES, now, TIME_ZONE).celebrate;
      const pendingStage = celebrate === null ? null : stageItemId(ACHIEVEMENTS_CONFIG.items, celebrate.id);
      for (const e of buildSeedEvents(itemsToSeed(achieved, pendingStage), false, ack.ids)) await rawStore.append(e);
      ack = readAcknowledged(await rawStore.list(), DEFAULT_STAGES);
    }
    const fresh = newAchievements(achieved, ack.ids).filter((a) => !seenIds.current.has(a.id));
    if (fresh.length === 0) return;
    for (const a of fresh) seenIds.current.add(a.id);
    const plan = planPopups(fresh, ACHIEVEMENTS_CONFIG.maxPopupsPerAction);
    const singles = plan.popups.flatMap((p) => (p.kind === 'single' ? [p.item] : []));
    const remaining = fresh.filter((a) => !singles.includes(a));
    enqueuePopups(plan.popups.map((entry) => ({ entry, items: entry.kind === 'single' ? [entry.item] : remaining })));
  }, [rawStore, enqueuePopups]);

  /** Single in-flight check; a burst of calls collapses into one extra run. */
  const checkMilestones = useCallback(async () => {
    if (running.current) {
      again.current = true;
      return;
    }
    running.current = true;
    try {
      do {
        again.current = false;
        try {
          await checkOnce();
        } catch (error) {
          console.error('[achievements] milestone check failed', error);
        }
      } while (again.current);
    } finally {
      running.current = false;
    }
  }, [checkOnce]);

  useEffect(
    () =>
      observed.subscribe((event: LogEvent) => {
        const built = buildToast(event, (e) => toastNameFor(e, PERSON_TASKS, ACTIVITY_TYPES));
        if (built !== null) setPendingToasts((pending) => queueToasts(pending, built));
        void checkMilestones();
      }),
    [observed, checkMilestones],
  );

  useEffect(() => {
    void checkMilestones();
  }, [tab, checkMilestones]);

  // A popup opening over a visible toast puts that toast back at the front of
  // the queue, so it is shown (silently, it already rang) once the popup closes.
  const rung = useRef<WeakSet<QueuedToast>>(new WeakSet());
  useEffect(() => {
    if (!popupOpen || toast === null) return;
    const hidden = toast;
    setToast(null);
    setPendingToasts((pending) => [hidden, ...pending]);
  }, [popupOpen, toast]);

  // Next toast: only when none is showing and no popup is open.
  useEffect(() => {
    if (toast !== null || popupOpen) return;
    const next = pendingToasts[0];
    if (next === undefined) return;
    setPendingToasts(pendingToasts.slice(1));
    setToast(next);
    if (!rung.current.has(next)) {
      rung.current.add(next);
      playTing();
    }
  }, [toast, popupOpen, pendingToasts]);

  useEffect(() => {
    if (toast === null) return;
    const id = window.setTimeout(() => setToast(null), ACHIEVEMENTS_CONFIG.toastMs);
    return () => window.clearTimeout(id);
  }, [toast]);

  return (
    <>
      <div className="toast-region" role="status" aria-live="polite">
        {toast !== null && (
          <p className="toast">{toast.count > 1 ? toastMergedLabel(toast.xp, toast.count) : toastLabel(toast.xp, toast.label)}</p>
        )}
      </div>
      {popup !== null && <MilestonePopup key={popup.key} popup={popup} onClose={showNext} />}
    </>
  );
}

function MilestonePopup({ popup, onClose }: { readonly popup: ActivePopup; readonly onClose: () => void }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [reduceMotion] = useState(prefersReducedMotion);
  const title = popup.entry.kind === 'single' ? popupTitle(popup.entry.item) : popupRestTitle(popup.entry.count);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    buttonRef.current?.focus();
    return () => previous?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="popup-backdrop">
      <div className="popup" role="dialog" aria-modal="true" aria-labelledby="popup-title">
        {!reduceMotion && (
          <div className="confetti" aria-hidden="true">
            {Array.from({ length: CONFETTI_PIECES }, (_, i) => (
              <span key={i} className={`confetti__piece confetti__piece--${i % 6}`} style={{ left: `${(i * 100) / CONFETTI_PIECES + 2}%`, animationDelay: `${(i % 6) * 60}ms` }} />
            ))}
          </div>
        )}
        <div className="popup__gem" aria-hidden="true">
          ◆
        </div>
        <p className="popup__kicker">{STRINGS.popupKicker}</p>
        <h2 id="popup-title" className="popup__title">
          {title}
        </h2>
        <p className="popup__body">{popup.encouragement}</p>
        <button ref={buttonRef} type="button" className="button button--primary" onClick={onClose}>
          {STRINGS.popupClose}
        </button>
      </div>
    </div>
  );
}
