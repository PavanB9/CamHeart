import { mean, std } from './stats';

/** Centred moving average via prefix sums (O(n)). */
export function movingAverage(x: ArrayLike<number>, win: number): Float64Array {
  const n = x.length;
  const out = new Float64Array(n);
  if (win <= 1) {
    for (let i = 0; i < n; i++) out[i] = x[i];
    return out;
  }
  const half = Math.floor(win / 2);
  const prefix = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + x[i];
  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - half);
    const hi = Math.min(n, i + half + 1);
    out[i] = (prefix[hi] - prefix[lo]) / (hi - lo);
  }
  return out;
}

/** Remove a slow trend by subtracting a centred moving average. */
export function detrend(x: ArrayLike<number>, win: number): Float64Array {
  const ma = movingAverage(x, win);
  const out = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = x[i] - ma[i];
  return out;
}

/** Zero-mean, unit-variance normalisation. */
export function zscore(x: ArrayLike<number>): Float64Array {
  const mu = mean(x);
  const sd = std(x, mu) || 1;
  const out = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = (x[i] - mu) / sd;
  return out;
}
