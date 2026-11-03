/**
 * Browser side of the daily reminder (story-007, option P1 in
 * production/qa/evidence/story-007-feasibility.md section F): best-effort
 * local notifications on top of the in-app banner.
 *
 * - If the browser has Notification Triggers (`'showTrigger' in
 *   Notification.prototype`), one notification is scheduled at the next
 *   reminder instant with a fixed tag; it is replaced whenever the scheduler
 *   refreshes.
 * - Otherwise a timer runs while the app is open; when it fires the log is
 *   re-read and a notification is shown only if today's goal is still not met.
 * - Never notifies when today's goal is met; nothing here is guaranteed while
 *   the app is closed (reliable delivery needs server push, phase 2).
 *
 * Every browser API goes through {@link NotificationPlatform}, so the
 * scheduler is testable without a browser.
 */
import gameConfig from '../config/game-config.json';
import type { EventStore } from '../data/event-store';
import { computeProgress } from '../domain/progress';
import type { ProgressConfig } from '../domain/progress';
import { nextReminderAt, parseReminderConfig, readReminderSettings, reminderMissing, shouldShowReminder } from '../domain/reminders';
import type { ReminderConfig } from '../domain/reminders';
import { STRINGS, reminderMessage } from '../ui/strings';

/** Notification permission as the UI needs it. */
export type ReminderPermission = 'granted' | 'denied' | 'default' | 'unsupported';

/** Fixed tag shared by every reminder notification, so a new one replaces the old. */
export const REMINDER_TAG = 'daily-reminder';

/** Minimal shape of a shown/scheduled notification. */
export interface ReminderNotificationHandle {
  close(): void;
}

/** Content of one reminder notification. */
export interface ReminderNotification {
  readonly title: string;
  readonly body: string;
  /** Epoch ms for a scheduled (trigger) notification; absent to show now. */
  readonly showAt?: number;
}

/** Browser capabilities the scheduler uses. Injected for tests. */
export interface NotificationPlatform {
  /** Current permission (no prompt). */
  permission(): ReminderPermission;
  /** Asks for permission. Must be called directly from a user tap. */
  requestPermission(): Promise<ReminderPermission>;
  /** True when scheduled notifications (`showTrigger`) are available. */
  supportsTriggers(): boolean;
  /** Shows (or, with `showAt` and trigger support, schedules) a notification with {@link REMINDER_TAG}. */
  show(notification: ReminderNotification): Promise<void>;
  /** Shown or scheduled reminder notifications (tag {@link REMINDER_TAG}). */
  pending(): Promise<readonly ReminderNotificationHandle[]>;
  setTimer(callback: () => void, delayMs: number): number;
  clearTimer(id: number): void;
}

// --- Notification Triggers: not in the DOM typings, declared minimally here. ---

/** `TimestampTrigger` constructor (Notification Triggers, Chromium origin trial). */
type TimestampTriggerConstructor = new (timestamp: number) => object;

interface TriggerNotificationOptions extends NotificationOptions {
  showTrigger?: object;
}

interface TriggerGetNotificationOptions extends GetNotificationOptions {
  includeTriggered?: boolean;
}

function timestampTrigger(): TimestampTriggerConstructor | undefined {
  return (globalThis as { TimestampTrigger?: TimestampTriggerConstructor }).TimestampTrigger;
}

function hasNotificationApi(): boolean {
  return typeof Notification !== 'undefined' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
}

function toPermission(value: NotificationPermission): ReminderPermission {
  return value === 'granted' || value === 'denied' ? value : 'default';
}

async function registration(): Promise<ServiceWorkerRegistration | undefined> {
  try {
    return await navigator.serviceWorker.getRegistration();
  } catch {
    return undefined;
  }
}

/** The real browser implementation of {@link NotificationPlatform}. */
export function browserNotificationPlatform(): NotificationPlatform {
  return {
    permission: () => (hasNotificationApi() ? toPermission(Notification.permission) : 'unsupported'),
    requestPermission: async () => {
      if (!hasNotificationApi()) return 'unsupported';
      try {
        return toPermission(await Notification.requestPermission());
      } catch {
        return toPermission(Notification.permission);
      }
    },
    supportsTriggers: () =>
      hasNotificationApi() && 'showTrigger' in Notification.prototype && timestampTrigger() !== undefined,
    show: async ({ title, body, showAt }) => {
      const options: TriggerNotificationOptions = { body, tag: REMINDER_TAG, icon: './icon.svg', data: { url: './' } };
      const Trigger = timestampTrigger();
      if (showAt !== undefined && Trigger !== undefined) options.showTrigger = new Trigger(showAt);
      const reg = await registration();
      if (reg !== undefined) {
        await reg.showNotification(title, options);
      } else if (showAt === undefined) {
        new Notification(title, options);
      }
    },
    pending: async () => {
      const reg = await registration();
      if (reg === undefined) return [];
      const filter: TriggerGetNotificationOptions = { tag: REMINDER_TAG, includeTriggered: true };
      return reg.getNotifications(filter);
    },
    setTimer: (callback, delayMs) => window.setTimeout(callback, delayMs),
    clearTimer: (id) => window.clearTimeout(id),
  };
}

/** Dependencies of {@link createReminderScheduler}. */
export interface ReminderSchedulerDeps {
  readonly eventStore: EventStore;
  readonly platform: NotificationPlatform;
  /** Clock (injected). */
  readonly now: () => Date;
  /** IANA time zone defining the local day. */
  readonly timeZone: string;
  /** Defaults to game-config.json. */
  readonly progressConfig?: ProgressConfig;
  /** Defaults to game-config.json. */
  readonly reminderConfig?: ReminderConfig;
}

/** Keeps the best-effort reminder notification in sync with the log. */
export interface ReminderScheduler {
  /**
   * Re-reads the log and replaces any scheduled reminder / pending timer.
   * Call on app start, when the app becomes visible, when Hôm nay mounts
   * (i.e. after a Học/Làm save) and after the reminder settings change.
   * Never throws.
   */
  refresh(): Promise<void>;
  /** Stops the timer. Scheduled trigger notifications are left as they are. */
  dispose(): void;
}

/**
 * Creates the scheduler. Nothing happens until {@link ReminderScheduler.refresh}.
 */
export function createReminderScheduler(deps: ReminderSchedulerDeps): ReminderScheduler {
  const { eventStore, platform, now, timeZone } = deps;
  const progressConfig = deps.progressConfig ?? { dailyXpGoal: gameConfig.dailyXpGoal };
  const reminderConfig = deps.reminderConfig ?? parseReminderConfig(gameConfig.reminder);
  let timer: number | null = null;
  let generation = 0;

  const clearTimer = () => {
    if (timer !== null) platform.clearTimer(timer);
    timer = null;
  };

  const cancelPending = async () => {
    for (const n of await platform.pending()) n.close();
  };

  /** Timer path: show now if the reminder is (still) due. */
  const fire = async (gen: number) => {
    timer = null;
    if (gen !== generation) return;
    try {
      const events = await eventStore.list();
      const at = now();
      const settings = readReminderSettings(events, reminderConfig);
      const progress = computeProgress(events, at, progressConfig, timeZone);
      if (platform.permission() === 'granted' && shouldShowReminder(settings, at, timeZone, progress.dailyGoal.met)) {
        await platform.show({
          title: STRINGS.reminderNotificationTitle,
          body: reminderMessage(progress.streak, reminderMissing(progress.dailyGoal)),
        });
      }
    } catch (error) {
      console.warn('[reminders] could not show the reminder', error);
    }
    if (gen === generation) await refresh();
  };

  const refresh = async (): Promise<void> => {
    const gen = ++generation;
    clearTimer();
    try {
      const events = await eventStore.list();
      if (gen !== generation) return;
      const at = now();
      const settings = readReminderSettings(events, reminderConfig);
      const progress = computeProgress(events, at, progressConfig, timeZone);
      const goalMet = progress.dailyGoal.met;
      const triggers = platform.supportsTriggers();
      // Replace whatever was shown or scheduled before; also clears a stale reminder once the goal is met.
      if (triggers || goalMet || !settings.enabled) await cancelPending();
      if (gen !== generation) return;
      if (!settings.enabled || platform.permission() !== 'granted') return;
      const next = nextReminderAt(settings, at, timeZone, goalMet);
      if (next === null) return;
      if (triggers) {
        // Streak as it will read at that instant if nothing else is logged.
        const then = computeProgress(events, next, progressConfig, timeZone);
        await platform.show({
          title: STRINGS.reminderNotificationTitle,
          body: reminderMessage(then.streak, reminderMissing(then.dailyGoal)),
          showAt: next.getTime(),
        });
      } else {
        timer = platform.setTimer(() => void fire(gen), Math.max(0, next.getTime() - at.getTime()));
      }
    } catch (error) {
      console.warn('[reminders] could not schedule the reminder', error);
    }
  };

  return {
    refresh,
    dispose: () => {
      generation++;
      clearTimer();
    },
  };
}
