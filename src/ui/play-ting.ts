/**
 * Short "ting" reward sound synthesized with the Web Audio API (no audio asset).
 */
let audioContext: AudioContext | null = null;
let soundEnabled = true;

/** Turns the reward sound on or off (the `settings_changed { sound }` choice or the config default). */
export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled;
}

/** Whether {@link playTing} currently makes sound. */
export function isSoundEnabled(): boolean {
  return soundEnabled;
}

/**
 * Plays a ~0.4 s bell-like ting. Must be called from a user gesture the
 * first time (browser autoplay policy). Fails silently: sound is feedback,
 * never a reason to break the save flow.
 */
export function playTing(): void {
  if (!soundEnabled) return;
  try {
    audioContext ??= new AudioContext();
    const ctx = audioContext;
    void ctx.resume();
    const start = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.3, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.4);
    gain.connect(ctx.destination);
    // Fundamental plus a quieter upper partial gives the bell colour.
    for (const [frequency, level] of [
      [1318.5, 1],
      [2637, 0.35],
    ] as const) {
      const osc = ctx.createOscillator();
      const partialGain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, start);
      partialGain.gain.value = level;
      osc.connect(partialGain).connect(gain);
      osc.start(start);
      osc.stop(start + 0.42);
    }
  } catch (error) {
    console.warn('[audio] ting failed', error);
  }
}
