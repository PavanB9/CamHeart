// Small numeric helpers shared across the signal pipeline.

export function mean(x: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i];
  return x.length ? s / x.length : 0;
}

/** Sample standard deviation (N-1). Pass the mean if you already have it. */
export function std(x: ArrayLike<number>, mu = mean(x)): number {
  if (x.length < 2) return 0;
  let s = 0;
  for (let i = 0; i < x.length; i++) {
    const d = x[i] - mu;
    s += d * d;
  }
  return Math.sqrt(s / (x.length - 1));
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Exponential moving average step. */
export function ema(prev: number, next: number, alpha: number): number {
  return prev + alpha * (next - prev);
}
