import { config } from '../config';
import type { RppgAlgorithm } from '../config';
import { RgbRingBuffer } from '../signal/ringBuffer';
import { resampleUniform } from '../signal/resample';
import { extractPulse } from '../signal/rppg';
import { bandpass } from '../signal/filters';
import { zscore } from '../signal/detrend';
import { estimateHeartRate } from '../signal/heartRate';
import { estimateBreathing } from '../signal/breathing';
import { estimateHrv } from '../signal/hrv';
import { computeStress } from '../signal/stress';
import { clamp, ema } from '../signal/stats';

const GRAPH_SECONDS = 6;
const DEFAULT_RESTING_BPM = 70;
const DEFAULT_BASELINE_RMSSD = 50;

export interface Vitals {
  bpm: number | null;
  breathsPerMin: number | null;
  rmssd: number | null;
  stress: number; // 0..1, smoothed
  confidence: number; // 0..1
  snrDb: number;
  waveform: Float64Array; // recent z-scored bandpassed pulse, for the graph
  algorithm: RppgAlgorithm;
  acquiring: boolean; // true until we have a confident lock
  effectiveFps: number; // measured incoming sample rate
  bufferSec: number; // how much signal we currently hold
  calibrating: boolean;
  calibrated: boolean;
  calibrationProgress: number; // 0..1
}

export function emptyVitals(algo: RppgAlgorithm): Vitals {
  return {
    bpm: null,
    breathsPerMin: null,
    rmssd: null,
    stress: 0,
    confidence: 0,
    snrDb: -Infinity,
    waveform: new Float64Array(0),
    algorithm: algo,
    acquiring: true,
    effectiveFps: 0,
    bufferSec: 0,
    calibrating: false,
    calibrated: false,
    calibrationProgress: 0,
  };
}

interface Calibration {
  startMs: number;
  untilMs: number;
  totalMs: number;
  bpms: number[];
  rmssds: number[];
}

function median(xs: number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Source-agnostic rPPG analysis engine. Feed it timestamped mean-ROI RGB samples
 * via `pushSample`; call `tick` from your animation loop. Heavy analysis runs at
 * `config.analysisHz`, everything else is cheap.
 */
export class VitalsEngine {
  private buffer = new RgbRingBuffer(config.bufferSec * 1000);
  private algo: RppgAlgorithm = config.defaultAlgorithm;
  private bpmEma: number | null = null;
  private breathsEma: number | null = null;
  private stressEma = 0;
  private lastAnalysisMs = 0;
  private baseline: { restingBpm: number; baselineRmssd: number } | null = null;
  private calib: Calibration | null = null;
  private latest: Vitals;

  constructor() {
    this.latest = emptyVitals(this.algo);
  }

  setAlgorithm(a: RppgAlgorithm): void {
    if (a !== this.algo) {
      this.algo = a;
      this.latest = { ...this.latest, algorithm: a };
    }
  }

  getAlgorithm(): RppgAlgorithm {
    return this.algo;
  }

  reset(): void {
    this.buffer.clear();
    this.bpmEma = null;
    this.breathsEma = null;
    this.stressEma = 0;
    this.lastAnalysisMs = 0;
    this.calib = null;
    this.latest = emptyVitals(this.algo);
  }

  pushSample(t: number, r: number, g: number, b: number): void {
    this.buffer.push({ t, r, g, b });
  }

  startCalibration(seconds = 45, now = performance.now()): void {
    this.calib = {
      startMs: now,
      untilMs: now + seconds * 1000,
      totalMs: seconds * 1000,
      bpms: [],
      rmssds: [],
    };
  }

  cancelCalibration(): void {
    this.calib = null;
  }

  get vitals(): Vitals {
    return this.latest;
  }

  /** Run analysis if the cadence elapsed; always returns the latest snapshot. */
  tick(now = performance.now()): Vitals {
    if (now - this.lastAnalysisMs >= 1000 / config.analysisHz) {
      this.lastAnalysisMs = now;
      this.analyze(now);
    }
    return this.latest;
  }

  private windowPulse(
    seconds: number,
  ): { fs: number; pulse: Float64Array; green: Float64Array } | null {
    const w = this.buffer.window(seconds);
    const fs = config.resampleHz;
    if (w.t.length < fs * 3) return null;
    const r = resampleUniform(w.t, w.r, fs).values;
    const g = resampleUniform(w.t, w.g, fs).values;
    const b = resampleUniform(w.t, w.b, fs).values;
    return { fs, pulse: extractPulse(this.algo, r, g, b, fs), green: g };
  }

  private analyze(now: number): void {
    const fs = config.resampleHz;
    const bufferSec = this.buffer.spanSec();
    const effectiveFps = bufferSec > 0 ? this.buffer.length / bufferSec : 0;

    const hrData = this.windowPulse(config.hrWindowSec);
    if (!hrData) {
      this.latest = {
        ...emptyVitals(this.algo),
        bufferSec,
        effectiveFps,
        stress: this.stressEma,
        calibrating: !!this.calib,
        calibrated: !!this.baseline,
      };
      return;
    }

    // --- Heart rate ---
    const hr = estimateHeartRate(hrData.pulse, fs);
    const snrDb = hr ? hr.snrDb : -Infinity;
    const confidence = hr ? 1 / (1 + Math.exp(-(hr.snrDb - config.minSnrDb))) : 0;
    if (hr && hr.confident) {
      this.bpmEma =
        this.bpmEma == null ? hr.bpm : ema(this.bpmEma, hr.bpm, config.bpmEmaAlpha);
    }

    // --- Waveform for the graph ---
    const filtered = bandpass(hrData.pulse, fs, config.hrBand[0], config.hrBand[1]);
    const zf = zscore(filtered);
    const take = Math.min(zf.length, Math.round(GRAPH_SECONDS * fs));
    const waveform = zf.slice(zf.length - take);

    // --- Breathing (longer window, green channel baseline) ---
    let breaths = this.breathsEma;
    const wb = this.buffer.window(config.respWindowSec);
    if (wb.t.length >= fs * 10) {
      const gb = resampleUniform(wb.t, wb.g, fs).values;
      const br = estimateBreathing(zscore(gb), fs);
      if (br && br.confident) {
        this.breathsEma =
          this.breathsEma == null
            ? br.breathsPerMin
            : ema(this.breathsEma, br.breathsPerMin, config.breathsEmaAlpha);
        breaths = this.breathsEma;
      }
    }

    // --- HRV (longest window) ---
    let rmssd: number | null = null;
    const hrvData = this.windowPulse(config.hrvWindowSec);
    if (hrvData) {
      const hf = bandpass(hrvData.pulse, fs, config.hrBand[0], config.hrBand[1]);
      const hrv = estimateHrv(hf, fs);
      if (hrv) rmssd = hrv.rmssd;
    }

    // --- Calibration capture ---
    let calibrating = false;
    let calibrationProgress = 0;
    if (this.calib) {
      calibrating = true;
      calibrationProgress = clamp((now - this.calib.startMs) / this.calib.totalMs, 0, 1);
      if (hr && hr.confident) this.calib.bpms.push(hr.bpm);
      if (rmssd != null) this.calib.rmssds.push(rmssd);
      if (now >= this.calib.untilMs) {
        const rb = median(this.calib.bpms);
        const br = median(this.calib.rmssds);
        this.baseline = {
          restingBpm: Number.isFinite(rb) ? rb : DEFAULT_RESTING_BPM,
          baselineRmssd: Number.isFinite(br) && br > 0 ? br : DEFAULT_BASELINE_RMSSD,
        };
        this.calib = null;
        calibrating = false;
        calibrationProgress = 1;
      }
    }

    // --- Stress ---
    const base = this.baseline ?? {
      restingBpm: DEFAULT_RESTING_BPM,
      baselineRmssd: DEFAULT_BASELINE_RMSSD,
    };
    const bpmForStress = this.bpmEma ?? hr?.bpm ?? null;
    if (bpmForStress != null) {
      const raw = computeStress({
        bpm: bpmForStress,
        rmssd,
        restingBpm: base.restingBpm,
        baselineRmssd: base.baselineRmssd,
      });
      this.stressEma = ema(this.stressEma, raw, config.stressEmaAlpha);
    }

    this.latest = {
      bpm: this.bpmEma,
      breathsPerMin: breaths,
      rmssd,
      stress: this.stressEma,
      confidence,
      snrDb,
      waveform,
      algorithm: this.algo,
      acquiring: this.bpmEma == null || confidence < 0.5,
      effectiveFps,
      bufferSec,
      calibrating,
      calibrated: !!this.baseline,
      calibrationProgress,
    };
  }
}
