import { powerSpectrum } from './fft';

export interface BandEstimate {
  freqHz: number; // sub-bin interpolated peak frequency
  snrDb: number; // peak power vs mean of the other in-band bins
  peakIndex: number;
}

/**
 * Find the dominant frequency within `band` (Hz) and a crude SNR around it.
 * Returns null if the signal is too short or the band is empty.
 */
export function dominantInBand(
  signal: ArrayLike<number>,
  fs: number,
  band: [number, number],
): BandEstimate | null {
  if (signal.length < 8) return null;
  const { freqs, mags, df } = powerSpectrum(signal, fs, true);
  const [lo, hi] = band;

  let peakK = -1;
  let peakMag = -Infinity;
  let bandPower = 0;
  let bandCount = 0;

  for (let k = 1; k < freqs.length; k++) {
    const f = freqs[k];
    if (f < lo || f > hi) continue;
    bandPower += mags[k] * mags[k];
    bandCount++;
    if (mags[k] > peakMag) {
      peakMag = mags[k];
      peakK = k;
    }
  }
  if (peakK < 0 || bandCount === 0) return null;

  // Parabolic interpolation around the peak bin for sub-bin resolution.
  let interpK = peakK;
  if (peakK > 0 && peakK < mags.length - 1) {
    const a = mags[peakK - 1];
    const b = mags[peakK];
    const c = mags[peakK + 1];
    const denom = a - 2 * b + c;
    if (denom !== 0) interpK = peakK + (0.5 * (a - c)) / denom;
  }

  const peakPower = peakMag * peakMag;
  const noisePower = (bandPower - peakPower) / Math.max(1, bandCount - 1);
  const snrDb = 10 * Math.log10(peakPower / (noisePower || 1e-12));

  return { freqHz: interpK * df, snrDb, peakIndex: peakK };
}
