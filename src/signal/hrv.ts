import { config } from '../config';
import { findPeaks } from './peaks';
import { mean } from './stats';

export interface HrvResult {
  rmssd: number; // ms — root mean square of successive IBI differences
  sdnn: number; // ms — std of IBIs
  meanIbiMs: number;
  beatCount: number;
}

/**
 * Estimate HRV from a bandpassed HR-band waveform sampled at `fs`.
 * Peak-detects beats, forms inter-beat intervals (gated to a plausible range),
 * then computes RMSSD and SDNN. rPPG HRV is noisy — treat as a relative trend.
 */
export function estimateHrv(
  signal: ArrayLike<number>,
  fs: number,
  maxBpm = 180,
): HrvResult | null {
  const minDist = Math.max(1, Math.round((60 / maxBpm) * fs));
  const peaks = findPeaks(signal, minDist, 0.2);
  if (peaks.length < 4) return null;

  const ibis: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    const ibi = ((peaks[i].index - peaks[i - 1].index) / fs) * 1000;
    if (ibi >= config.ibiMinMs && ibi <= config.ibiMaxMs) ibis.push(ibi);
  }
  if (ibis.length < 3) return null;

  const meanIbi = mean(ibis);
  let varSum = 0;
  for (const v of ibis) {
    const d = v - meanIbi;
    varSum += d * d;
  }
  const sdnn = Math.sqrt(varSum / (ibis.length - 1));

  let sq = 0;
  for (let i = 1; i < ibis.length; i++) {
    const d = ibis[i] - ibis[i - 1];
    sq += d * d;
  }
  const rmssd = Math.sqrt(sq / (ibis.length - 1));

  return { rmssd, sdnn, meanIbiMs: meanIbi, beatCount: peaks.length };
}
