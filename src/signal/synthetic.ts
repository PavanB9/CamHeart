// Synthetic rPPG generator — the heart of camera-less development.
// Produces mean-RGB samples that mimic what the ROI averager would output from a
// real face: a pulsatile component (mostly on green), a slow respiratory baseline
// wander, and gaussian sensor noise. Used by the unit tests and by the live
// "Synthetic" frame source.

export interface SyntheticParams {
  bpm: number;
  breathsPerMin: number;
  pulseAmpl: number; // green modulation depth (fraction of baseline)
  respAmpl: number; // respiratory baseline wander (fraction)
  noiseStd: number; // gaussian noise std (fraction of baseline)
  baseline: [number, number, number]; // base skin RGB (0–255)
}

export const defaultSyntheticParams: SyntheticParams = {
  bpm: 72,
  breathsPerMin: 14,
  pulseAmpl: 0.02,
  respAmpl: 0.015,
  noiseStd: 0.005,
  baseline: [180, 120, 110],
};

export interface RgbSeries {
  t: Float64Array; // ms
  r: Float64Array;
  g: Float64Array;
  b: Float64Array;
}

/** Deterministic PRNG so tests are reproducible. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard-normal sample via Box–Muller. */
export function gauss(rng: () => number): number {
  const u = 1 - rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Instantaneous RGB at time `tSec`, given an optional pre-sampled noise term. */
export function rppgValueAt(
  tSec: number,
  p: SyntheticParams,
  noise = 0,
): { r: number; g: number; b: number } {
  const f = p.bpm / 60;
  const rf = p.breathsPerMin / 60;
  // Pulse + a touch of 2nd harmonic for a more PPG-like shape.
  const pulse =
    Math.sin(2 * Math.PI * f * tSec) + 0.25 * Math.sin(2 * Math.PI * 2 * f * tSec);
  const resp = p.respAmpl * Math.sin(2 * Math.PI * rf * tSec);
  const common = p.pulseAmpl * pulse;
  const [bR, bG, bB] = p.baseline;
  return {
    // Green carries the strongest plethysmographic signal; red/blue much less.
    g: bG * (1 + common + resp) + bG * noise,
    r: bR * (1 + 0.35 * common + resp) + bR * noise,
    b: bB * (1 + 0.12 * common + resp) + bB * noise,
  };
}

/** Generate a full uniformly-sampled series (used by tests). */
export function generateRppgSeries(
  params: Partial<SyntheticParams> & { fps?: number; durationSec?: number; seed?: number },
): RgbSeries {
  const p = { ...defaultSyntheticParams, ...params };
  const fps = params.fps ?? 30;
  const dur = params.durationSec ?? 12;
  const n = Math.max(1, Math.round(fps * dur));
  const rng = mulberry32(params.seed ?? 1);

  const t = new Float64Array(n);
  const r = new Float64Array(n);
  const g = new Float64Array(n);
  const b = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const tSec = i / fps;
    t[i] = tSec * 1000;
    const { r: rr, g: gg, b: bb } = rppgValueAt(tSec, p, p.noiseStd * gauss(rng));
    r[i] = rr;
    g[i] = gg;
    b[i] = bb;
  }
  return { t, r, g, b };
}
