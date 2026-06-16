import { clamp } from './stats';

export interface Uniform {
  values: Float64Array;
  fs: number;
  t0: number; // timestamp (ms) of the first sample
}

/**
 * Linearly interpolate timestamped samples onto a uniform grid at `fs` Hz.
 * `t` is in milliseconds, ascending. This is what tames a webcam's jittery,
 * variable frame rate before any frequency analysis.
 */
export function resampleUniform(
  t: ArrayLike<number>,
  v: ArrayLike<number>,
  fs: number,
): Uniform {
  const n = t.length;
  if (n === 0) return { values: new Float64Array(0), fs, t0: 0 };
  if (n === 1) return { values: Float64Array.from([v[0]]), fs, t0: t[0] };

  const t0 = t[0];
  const tEnd = t[n - 1];
  const durSec = (tEnd - t0) / 1000;
  const count = Math.max(1, Math.floor(durSec * fs) + 1);
  const out = new Float64Array(count);
  const dtMs = 1000 / fs;

  let j = 0;
  for (let i = 0; i < count; i++) {
    const tt = t0 + i * dtMs;
    while (j < n - 2 && t[j + 1] < tt) j++;
    const t1 = t[j];
    const t2 = t[j + 1];
    const frac = t2 > t1 ? clamp((tt - t1) / (t2 - t1), 0, 1) : 0;
    out[i] = v[j] + (v[j + 1] - v[j]) * frac;
  }
  return { values: out, fs, t0 };
}
