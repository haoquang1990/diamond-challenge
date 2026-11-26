// Story 053: which "add to home screen" steps to show, and the Android install prompt.
import { describe, expect, it, vi } from 'vitest';
import { createInstallPrompt, detectInstallPlatform } from '../../../src/ui/install-guide';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const IPAD_DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

describe('detectInstallPlatform', () => {
  it('knows iPhone, iPad (desktop user agent with touch), Android and others', () => {
    expect(detectInstallPlatform({ userAgent: IPHONE, maxTouchPoints: 5, standalone: false })).toBe('ios');
    expect(detectInstallPlatform({ userAgent: IPAD_DESKTOP_UA, maxTouchPoints: 5, standalone: false })).toBe('ios');
    expect(detectInstallPlatform({ userAgent: IPAD_DESKTOP_UA, maxTouchPoints: 0, standalone: false })).toBe('other');
    expect(detectInstallPlatform({ userAgent: ANDROID, maxTouchPoints: 5, standalone: false })).toBe('android');
    expect(detectInstallPlatform({ userAgent: DESKTOP, maxTouchPoints: 0, standalone: false })).toBe('other');
  });

  it('says installed when the app runs from the home screen', () => {
    expect(detectInstallPlatform({ userAgent: IPHONE, maxTouchPoints: 5, standalone: true })).toBe('installed');
  });
});

describe('createInstallPrompt', () => {
  it('keeps the browser prompt, shows it once on request and reports the answer', async () => {
    const holder = createInstallPrompt();
    expect(holder.available()).toBe(false);
    const prompt = vi.fn(async () => undefined);
    const event = { preventDefault: vi.fn(), prompt, userChoice: Promise.resolve({ outcome: 'accepted' as const }) };
    holder.capture(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(holder.available()).toBe(true);
    await expect(holder.show()).resolves.toBe('accepted');
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(holder.available()).toBe(false);
    await expect(holder.show()).resolves.toBe('unavailable');
  });

  it('tells listeners when the prompt appears or the app was installed', () => {
    const holder = createInstallPrompt();
    const seen: boolean[] = [];
    const stop = holder.subscribe(() => seen.push(holder.available()));
    holder.capture({ preventDefault: () => undefined, prompt: async () => undefined, userChoice: Promise.resolve({ outcome: 'dismissed' as const }) });
    holder.installed();
    stop();
    holder.installed();
    expect(seen).toEqual([true, false]);
  });
});
