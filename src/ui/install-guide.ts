/**
 * "Đưa app ra màn hình chính" (story 053): which steps to show on this device, and the
 * Android/Chrome install prompt kept from page load so a button can show it later.
 */

/** Which steps fit this device; `installed` when the app already runs from the home screen. */
export type InstallPlatform = 'ios' | 'android' | 'other' | 'installed';

/** What {@link detectInstallPlatform} reads from the browser. */
export interface InstallEnvironment {
  readonly userAgent: string;
  readonly maxTouchPoints: number;
  /** `display-mode: standalone` matches, or iOS `navigator.standalone`. */
  readonly standalone: boolean;
}

/**
 * Picks the steps for this device. An iPad on iPadOS 13+ reports a Mac user agent; touch
 * points tell it apart. Pure.
 */
export function detectInstallPlatform(env: InstallEnvironment): InstallPlatform {
  if (env.standalone) return 'installed';
  const ua = env.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && env.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

/** Reads the real browser (call in the browser only). */
export function browserInstallEnvironment(): InstallEnvironment {
  const nav = navigator as Navigator & { readonly standalone?: boolean };
  const standalone = nav.standalone === true || (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches);
  return { userAgent: nav.userAgent, maxTouchPoints: nav.maxTouchPoints ?? 0, standalone };
}

/** The part of Chrome's `beforeinstallprompt` event this app uses. */
export interface DeferredInstallPrompt {
  preventDefault(): void;
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ readonly outcome: 'accepted' | 'dismissed' }>;
}

/** Holds the install prompt between page load and the "Cài app" button. */
export interface InstallPromptHolder {
  /** Keeps the event (and stops the browser's own mini bar). */
  capture(event: DeferredInstallPrompt): void;
  /** The browser said the app was installed. */
  installed(): void;
  available(): boolean;
  /** Shows the prompt once; `unavailable` when there is none. */
  show(): Promise<'accepted' | 'dismissed' | 'unavailable'>;
  /** Called on every change; returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
}

/** Creates an empty holder. */
export function createInstallPrompt(): InstallPromptHolder {
  let event: DeferredInstallPrompt | null = null;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const l of listeners) l();
  };
  return {
    capture(e) {
      e.preventDefault();
      event = e;
      notify();
    },
    installed() {
      event = null;
      notify();
    },
    available: () => event !== null,
    async show() {
      const e = event;
      if (e === null) return 'unavailable';
      event = null;
      notify();
      await e.prompt();
      return (await e.userChoice).outcome;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** The app's holder; {@link listenForInstallPrompt} fills it from page load. */
export const INSTALL_PROMPT = createInstallPrompt();

/** Starts keeping the install prompt (call once at start-up). */
export function listenForInstallPrompt(target: Pick<Window, 'addEventListener'> = window, holder: InstallPromptHolder = INSTALL_PROMPT): void {
  target.addEventListener('beforeinstallprompt', (e) => holder.capture(e as unknown as DeferredInstallPrompt));
  target.addEventListener('appinstalled', () => holder.installed());
}
