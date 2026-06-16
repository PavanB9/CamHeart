import { config } from '../config';
import { bandpass } from './filters';
import { dominantInBand } from './spectral';

export interface BreathingResult {
  breathsPerMin: number;
  freqHz: number;
  snrDb: number;
  confident: boolean;
}

/**
 * Estimate respiration rate from a longer window of the pulse / green signal
 * (uniformly sampled at `fs`) by isolating the low-frequency respiratory band.
 * Needs >= ~10 s of data because the band is slow.
 */
export function estimateBreathing(
  signal: ArrayLike<number>,
  fs: number,
): BreathingResult | null {
  if (signal.length < fs * 10) return null;
  const filtered = bandpass(signal, fs, config.respBand[0], config.respBand[1]);
  const est = dominantInBand(filtered, fs, config.respBand);
  if (!est) return null;
  return {
    breathsPerMin: est.freqHz * 60,
    freqHz: est.freqHz,
    snrDb: est.snrDb,
    confident: est.snrDb >= 1.0,
  };
}
