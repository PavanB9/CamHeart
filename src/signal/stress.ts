import { config } from '../config';
import { clamp } from './stats';

export interface StressInputs {
  bpm: number;
  rmssd: number | null; // ms; null when HRV isn't available yet
  restingBpm: number; // calibration baseline
  baselineRmssd: number; // calibration baseline
}

/**
 * A simple, deliberately non-medical stress score in [0, 1].
 * Elevated HR above resting and reduced HRV below baseline both push it up.
 * HR is weighted more heavily because rPPG HR is far more reliable than HRV.
 */
export function computeStress(inp: StressInputs): number {
  const hrNorm = clamp((inp.bpm - inp.restingBpm) / config.hrSpanBpm, 0, 1);

  if (inp.rmssd != null && inp.baselineRmssd > 0) {
    const hrvScore = clamp(inp.rmssd / inp.baselineRmssd, 0, 1);
    return clamp(
      config.stressHrWeight * hrNorm + config.stressHrvWeight * (1 - hrvScore),
      0,
      1,
    );
  }

  // No HRV → fall back to HR only.
  return hrNorm;
}
