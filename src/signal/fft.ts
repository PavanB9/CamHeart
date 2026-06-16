// Minimal, dependency-free radix-2 FFT and a one-sided power spectrum helper.
// Hand-rolled on purpose: the popular npm FFT packages are unmaintained, and we
// only need a few hundred-point transforms.

export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/**
 * In-place iterative Cooley–Tukey FFT.
 * `re`/`im` must have the same length, which must be a power of two.
 */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  if (n <= 1) return;
  if ((n & (n - 1)) !== 0) {
    throw new Error(`fft length must be a power of two, got ${n}`);
  }

  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }

  // Butterflies.
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let k = 0; k < half; k++) {
        const ik = i + k;
        const jk = i + k + half;
        const bRe = re[jk] * curRe - im[jk] * curIm;
        const bIm = re[jk] * curIm + im[jk] * curRe;
        re[jk] = re[ik] - bRe;
        im[jk] = im[ik] - bIm;
        re[ik] += bRe;
        im[ik] += bIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
}

export interface Spectrum {
  freqs: Float64Array; // bin centre frequencies (Hz)
  mags: Float64Array; // magnitude per bin
  df: number; // bin width (Hz)
}

/**
 * One-sided magnitude spectrum of a real signal sampled at `fs`.
 * Applies a Hann window by default (set `window=false` for a raw transform).
 */
export function powerSpectrum(
  signal: ArrayLike<number>,
  fs: number,
  window = true,
): Spectrum {
  const len = signal.length;
  const n = nextPow2(len);
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  const denom = len > 1 ? len - 1 : 1;
  for (let i = 0; i < len; i++) {
    let v = signal[i];
    if (window) {
      const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / denom);
      v *= w;
    }
    re[i] = v;
  }
  fft(re, im);

  const half = n >> 1;
  const mags = new Float64Array(half);
  const freqs = new Float64Array(half);
  const df = fs / n;
  for (let k = 0; k < half; k++) {
    mags[k] = Math.hypot(re[k], im[k]);
    freqs[k] = k * df;
  }
  return { freqs, mags, df };
}
