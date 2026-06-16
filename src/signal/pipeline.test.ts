import { describe, it, expect } from 'vitest';

import { powerSpectrum } from './fft';
import { bandpass } from './filters';
import { dominantInBand } from './spectral';
import { resampleUniform } from './resample';
import { zscore } from './detrend';
import { greenPulse, posPulse } from './rppg';
import { estimateHeartRate } from './heartRate';
import { estimateBreathing } from './breathing';
import { estimateHrv } from './hrv';
import { computeStress } from './stress';
import { generateRppgSeries } from './synthetic';

/** RMS over the middle 50% of a signal (avoids filter edge transients). */
function rmsMiddle(x: ArrayLike<number>): number {
  const n = x.length;
  const a = Math.floor(n * 0.25);
  const b = Math.floor(n * 0.75);
  let s = 0;
  let c = 0;
  for (let i = a; i < b; i++) {
    s += x[i] * x[i];
    c++;
  }
  return Math.sqrt(s / Math.max(1, c));
}

describe('FFT', () => {
  it('recovers the frequency of a pure cosine', () => {
    const fs = 64;
    const N = 256;
    const f = 5;
    const sig = new Float64Array(N);
    for (let i = 0; i < N; i++) sig[i] = Math.cos((2 * Math.PI * f * i) / fs);
    const { freqs, mags } = powerSpectrum(sig, fs, false);
    let peakK = 0;
    for (let k = 1; k < mags.length; k++) if (mags[k] > mags[peakK]) peakK = k;
    expect(freqs[peakK]).toBeCloseTo(f, 1);
  });
});

describe('bandpass', () => {
  const fs = 30;
  const N = 600;
  const sine = (f: number) => {
    const x = new Float64Array(N);
    for (let i = 0; i < N; i++) x[i] = Math.sin((2 * Math.PI * f * i) / fs);
    return x;
  };

  it('passes an in-band tone (1.2 Hz)', () => {
    const inp = sine(1.2);
    const out = bandpass(inp, fs, 0.7, 3.0);
    expect(rmsMiddle(out) / rmsMiddle(inp)).toBeGreaterThan(0.55);
  });

  it('rejects a sub-band tone (0.2 Hz)', () => {
    const inp = sine(0.2);
    const out = bandpass(inp, fs, 0.7, 3.0);
    expect(rmsMiddle(out) / rmsMiddle(inp)).toBeLessThan(0.25);
  });

  it('rejects a supra-band tone (8 Hz)', () => {
    const inp = sine(8);
    const out = bandpass(inp, fs, 0.7, 3.0);
    expect(rmsMiddle(out) / rmsMiddle(inp)).toBeLessThan(0.25);
  });
});

describe('resampleUniform', () => {
  it('reconstructs a sine from jittered timestamps', () => {
    const f = 1.0;
    const t: number[] = [];
    const v: number[] = [];
    let tt = 0;
    for (let i = 0; i < 200; i++) {
      tt += 33 + (i % 5) - 2; // jittery ~30 fps
      t.push(tt);
      v.push(Math.sin((2 * Math.PI * f * tt) / 1000));
    }
    const u = resampleUniform(t, v, 30);
    expect(u.fs).toBe(30);
    // dominant frequency should still be ~1 Hz (parabolic-interpolated peak)
    const est = dominantInBand(u.values, 30, [0.5, 2.0]);
    expect(est).not.toBeNull();
    expect(Math.abs(est!.freqHz - 1.0)).toBeLessThan(0.08);
  });
});

describe('heart-rate recovery (POS)', () => {
  for (const bpm of [60, 72, 100]) {
    it(`recovers ${bpm} bpm from a synthetic face signal`, () => {
      const s = generateRppgSeries({ bpm, fps: 30, durationSec: 20, seed: 7 });
      const pulse = posPulse(s.r, s.g, s.b, 30);
      const hr = estimateHeartRate(pulse, 30);
      expect(hr).not.toBeNull();
      expect(hr!.bpm).toBeGreaterThan(bpm - 4);
      expect(hr!.bpm).toBeLessThan(bpm + 4);
      expect(hr!.confident).toBe(true);
    });
  }
});

describe('heart-rate recovery (GREEN)', () => {
  it('recovers 84 bpm from the green channel', () => {
    const s = generateRppgSeries({ bpm: 84, fps: 30, durationSec: 20, seed: 3 });
    const pulse = greenPulse(s.g);
    const hr = estimateHeartRate(pulse, 30);
    expect(hr).not.toBeNull();
    expect(hr!.bpm).toBeCloseTo(84, -0.5); // within a few bpm
    expect(Math.abs(hr!.bpm - 84)).toBeLessThan(4);
  });
});

describe('breathing recovery', () => {
  it('recovers ~15 breaths/min from the green channel baseline', () => {
    const s = generateRppgSeries({
      bpm: 72,
      breathsPerMin: 15,
      respAmpl: 0.02,
      fps: 30,
      durationSec: 40,
      seed: 11,
    });
    const br = estimateBreathing(zscore(s.g), 30);
    expect(br).not.toBeNull();
    expect(Math.abs(br!.breathsPerMin - 15)).toBeLessThan(3);
  });
});

describe('HRV', () => {
  it('returns plausible inter-beat statistics for a 72 bpm signal', () => {
    const s = generateRppgSeries({ bpm: 72, fps: 30, durationSec: 20, seed: 5 });
    const pulse = posPulse(s.r, s.g, s.b, 30);
    const filtered = bandpass(pulse, 30, 0.7, 3.0);
    const hrv = estimateHrv(filtered, 30);
    expect(hrv).not.toBeNull();
    // 72 bpm → ~833 ms mean IBI
    expect(Math.abs(hrv!.meanIbiMs - 833)).toBeLessThan(80);
    expect(hrv!.rmssd).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(hrv!.rmssd)).toBe(true);
  });
});

describe('stress score', () => {
  it('is 0 at resting and rises with HR', () => {
    const resting = computeStress({
      bpm: 60,
      rmssd: 50,
      restingBpm: 60,
      baselineRmssd: 50,
    });
    const elevated = computeStress({
      bpm: 90,
      rmssd: 50,
      restingBpm: 60,
      baselineRmssd: 50,
    });
    expect(resting).toBeCloseTo(0, 5);
    expect(elevated).toBeGreaterThan(resting);
    expect(elevated).toBeLessThanOrEqual(1);
  });

  it('rises as HRV drops', () => {
    const calm = computeStress({
      bpm: 70,
      rmssd: 60,
      restingBpm: 60,
      baselineRmssd: 60,
    });
    const tense = computeStress({
      bpm: 70,
      rmssd: 20,
      restingBpm: 60,
      baselineRmssd: 60,
    });
    expect(tense).toBeGreaterThan(calm);
  });
});
