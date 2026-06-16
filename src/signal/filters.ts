// Zero-phase Butterworth-style bandpass built from RBJ biquad high-pass +
// low-pass stages, each applied forward and backward (filtfilt) so there is no
// phase delay — important because we later peak-detect the waveform for HRV.

interface Biquad {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

const BUTTERWORTH_Q = Math.SQRT1_2; // Q = 1/sqrt(2) → maximally flat passband

function lowpass(fc: number, fs: number, q = BUTTERWORTH_Q): Biquad {
  const w0 = (2 * Math.PI * fc) / fs;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha;
  return {
    b0: ((1 - cos) / 2) / a0,
    b1: (1 - cos) / a0,
    b2: ((1 - cos) / 2) / a0,
    a1: (-2 * cos) / a0,
    a2: (1 - alpha) / a0,
  };
}

function highpass(fc: number, fs: number, q = BUTTERWORTH_Q): Biquad {
  const w0 = (2 * Math.PI * fc) / fs;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha;
  return {
    b0: ((1 + cos) / 2) / a0,
    b1: -(1 + cos) / a0,
    b2: ((1 + cos) / 2) / a0,
    a1: (-2 * cos) / a0,
    a2: (1 - alpha) / a0,
  };
}

function applyBiquad(bq: Biquad, x: ArrayLike<number>): Float64Array {
  const y = new Float64Array(x.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const xi = x[i];
    const yi = bq.b0 * xi + bq.b1 * x1 + bq.b2 * x2 - bq.a1 * y1 - bq.a2 * y2;
    x2 = x1;
    x1 = xi;
    y2 = y1;
    y1 = yi;
    y[i] = yi;
  }
  return y;
}

function reversed(x: Float64Array): Float64Array {
  const n = x.length;
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) y[i] = x[n - 1 - i];
  return y;
}

/** Forward + backward pass → zero phase, doubled effective order. */
function filtfilt(bq: Biquad, x: ArrayLike<number>): Float64Array {
  const fwd = applyBiquad(bq, x);
  const back = applyBiquad(bq, reversed(fwd));
  return reversed(back);
}

/**
 * Zero-phase bandpass: high-pass at `lo` then low-pass at `hi` (Hz).
 * Returns a new array the same length as `signal`.
 */
export function bandpass(
  signal: ArrayLike<number>,
  fs: number,
  lo: number,
  hi: number,
): Float64Array {
  if (signal.length < 4) return Float64Array.from(signal as ArrayLike<number>);
  const hp = filtfilt(highpass(lo, fs), signal);
  return filtfilt(lowpass(hi, fs), hp);
}
