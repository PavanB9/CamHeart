import { config } from '../config';
import { bandpass } from './filters';
import { dominantInBand } from './spectral';

export interface HeartRateResult {
  bpm: number;
  freqHz: number;
  snrDb: number;
  confident: boolean;
}

/**
 * Estimate heart rate from an rPPG pulse waveform uniformly sampled at `fs`.
 * Bandpasses to the HR band, then takes the dominant FFT peak.
 */
export function estimateHeartRate(
  pulse: ArrayLike<number>,
  fs: number,
): HeartRateResult | null {
  if (pulse.length < fs * 3) return null; // need a few seconds of data
  const filtered = bandpass(pulse, fs, config.hrBand[0], config.hrBand[1]);
  const est = dominantInBand(filtered, fs, config.hrBand);
  if (!est) return null;
  return {
    bpm: est.freqHz * 60,
    freqHz: est.freqHz,
    snrDb: est.snrDb,
    confident: est.snrDb >= config.minSnrDb,
  };
}
