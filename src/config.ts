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
  stressEmaAlpha: 0.05, // slower EMA for the stress score

  // ---- Confidence gating ----
  minSnrDb: 2.0, // below this we hold the last value / show "acquiring"

  // ---- Stress score ----
  stressHrWeight: 0.6,
  stressHrvWeight: 0.4,
  hrSpanBpm: 40, // bpm above resting that maps to a full-stress contribution

  // ---- Default rPPG algorithm ----
  defaultAlgorithm: 'pos' as RppgAlgorithm,
} as const;
