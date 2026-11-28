/** 2026-11-28: the cheer picker shows a few random lines of ~100 and "Câu khác" gives others. Fixed data only. */
import { describe, expect, it } from 'vitest';
import gameConfig from '../../../src/config/game-config.json';
import { cheerBatch } from '../../../src/data/group-service';

const ALL = Array.from({ length: 20 }, (_, i) => `Câu ${i + 1}`);
/** Deterministic stand-in for Math.random. */
function seq(seed: number): () => number {
  let x = seed;
  return () => {
    x = (x * 9301 + 49297) % 233280;
    return x / 233280;
  };
}

describe('cheerBatch', () => {
  it('shows the asked number of different lines', () => {
    const batch = cheerBatch(ALL, [], 5, seq(1));
    expect(batch).toHaveLength(5);
    expect(new Set(batch).size).toBe(5);
    for (const line of batch) expect(ALL).toContain(line);
  });

  it('"Câu khác" never repeats the batch shown just before', () => {
    let shown = cheerBatch(ALL, [], 5, seq(2));
    for (let i = 0; i < 10; i++) {
      const next = cheerBatch(ALL, shown, 5, seq(3 + i));
      for (const line of next) expect(shown).not.toContain(line);
      shown = next;
    }
  });

  it('with fewer lines than asked, shows all it can, still avoiding the last batch when possible', () => {
    expect(cheerBatch(['a', 'b', 'c'], [], 5, seq(4)).sort()).toEqual(['a', 'b', 'c']);
    expect(cheerBatch(['a', 'b', 'c', 'd'], ['a', 'b'], 2, seq(5)).sort()).toEqual(['c', 'd']);
  });
});

describe('cheer lines in the config', () => {
  it('holds about 100 different lines the server accepts (1–200 characters)', () => {
    const lines = gameConfig.cheerMessages;
    expect(lines.length).toBeGreaterThanOrEqual(100);
    expect(new Set(lines).size).toBe(lines.length);
    for (const line of lines) expect(line.trim().length).toBeGreaterThan(0);
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(200);
  });
});
