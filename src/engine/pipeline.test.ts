import { describe, it, expect } from 'vitest';
import { VitalsEngine } from './pipeline';
import { generateRppgSeries } from '../signal/synthetic';

// Drives the engine the way the rAF loop does: push samples, then tick once per
// second so the per-second analysis (and confidence EMA) advances.
function feedAndLock(bpm: number) {
  const engine = new VitalsEngine();
  const fps = 30;
  const series = generateRppgSeries({ bpm, fps, durationSec: 40, seed: 9 });
  let idx = 0;
  for (let sec = 1; sec <= 40; sec++) {
    const tEnd = sec * 1000;
    while (idx < series.t.length && series.t[idx] <= tEnd) {
      engine.pushSample(series.t[idx], series.r[idx], series.g[idx], series.b[idx]);
      idx++;
    }
    engine.tick(tEnd);
  }
  return { engine, lastT: 40 * 1000 };
}

describe('VitalsEngine confidence', () => {
  it('locks with high confidence on a clean signal', () => {
    const { engine } = feedAndLock(72);
    const v = engine.vitals;
    expect(v.bpm).not.toBeNull();
    expect(Math.abs((v.bpm ?? 0) - 72)).toBeLessThan(4);
    expect(v.confidence).toBeGreaterThan(0.8);
    expect(v.acquiring).toBe(false);
  });

  it('collapses confidence when fresh samples stop (no face / blocked camera)', () => {
    const { engine, lastT } = feedAndLock(72);
    expect(engine.vitals.confidence).toBeGreaterThan(0.8); // locked first

    // Stop feeding and let time advance past the freshness window.
    engine.tick(lastT + 2000);
    const stale = engine.vitals;
    expect(stale.confidence).toBeLessThan(0.15);
    expect(stale.acquiring).toBe(true);
  });

  it('does not reach full confidence before the buffer fills', () => {
    const engine = new VitalsEngine();
    const fps = 30;
    const series = generateRppgSeries({ bpm: 72, fps, durationSec: 12, seed: 4 });
    let idx = 0;
    // Only ~5 seconds of data — below the 10 s analysis window.
    for (let sec = 1; sec <= 5; sec++) {
      const tEnd = sec * 1000;
      while (idx < series.t.length && series.t[idx] <= tEnd) {
        engine.pushSample(series.t[idx], series.r[idx], series.g[idx], series.b[idx]);
        idx++;
      }
      engine.tick(tEnd);
    }
    expect(engine.vitals.confidence).toBeLessThan(0.7);
  });
});
