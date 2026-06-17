// Central configuration for the CamHeart rPPG pipeline.
// All timing/frequency tunables live here so the signal math stays parameterised
// and the UI settings panel (Phase 6) has a single source of truth.

export type RppgAlgorithm = 'pos' | 'green';

export const config = {
  // ---- Capture ----
  targetFps: 30,
  videoWidth: 1280,
  videoHeight: 720,

  // ---- Sampling / analysis windows ----
  resampleHz: 30, // uniform rate the timestamped RGB samples are resampled to
  hrWindowSec: 10, // sliding window length for the heart-rate FFT
  respWindowSec: 30, // longer window for breathing (low frequency)
  hrvWindowSec: 45, // rolling window for HRV (RMSSD / SDNN)
  analysisHz: 1, // how often the heavy analysis runs (Hz)
  bufferSec: 45, // ring-buffer retention; must be >= the largest window

  // ---- Frequency bands (Hz) ----
  hrBand: [0.7, 3.0] as [number, number], // ~42–180 bpm
  respBand: [0.15, 0.4] as [number, number], // ~9–24 breaths/min

  // ---- Inter-beat interval gating (ms) for HRV ----
  ibiMinMs: 300, // 200 bpm
  ibiMaxMs: 1500, // 40 bpm

  // ---- Smoothing ----
  bpmEmaAlpha: 0.2, // EMA factor for the displayed BPM
  breathsEmaAlpha: 0.2,
  stressEmaAlpha: 0.1, // slower EMA for the stress score (≈10 s time constant)

  // ---- Confidence model ----
  minSnrDb: 2.0, // SNR below which a reading isn't folded into the smoothed BPM
  snrFloorDb: 1.5, // display confidence: SNR at/below this maps to 0
  snrCeilDb: 9.5, // display confidence: SNR at/above this maps to full
  freshMinAgeMs: 300, // a sample newer than this counts as fully "live"
  freshMaxAgeMs: 1200, // no fresh sample within this → treated as no signal
  gapResetMs: 700, // a sampling gap longer than this restarts acquisition

  // ---- Stress score ----
  stressHrWeight: 0.6,
  stressHrvWeight: 0.4,
  hrSpanBpm: 40, // bpm above resting that maps to a full-stress contribution

  // ---- Default rPPG algorithm ----
  defaultAlgorithm: 'pos' as RppgAlgorithm,
} as const;
