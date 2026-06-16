import { defaultSyntheticParams, gauss, mulberry32 } from '../signal/synthetic';
import type { SyntheticParams } from '../signal/synthetic';
import { clamp } from '../signal/stats';

export type FrameMode = 'synthetic' | 'webcam' | 'sampleVideo';

export interface FrameSample {
  t: number;
  r: number;
  g: number;
  b: number;
}

/**
 * A frame source produces timestamped mean-ROI RGB samples. `sample()` may return
 * zero, one, or several samples for a given animation frame — the synthetic source
 * backfills at a fixed rate so it stays correct even if rAF is throttled (e.g. a
 * hidden tab); real-video sources return at most the current frame.
 */
export interface FrameSource {
  readonly mode: FrameMode;
  start(): Promise<void>;
  stop(): void;
  sample(now: number): FrameSample[];
}

export interface SyntheticControls {
  bpm: number;
  breathsPerMin: number;
  stress: number; // 0..1
}

const SYNTH_HZ = 30;
const SYNTH_STEP_MS = 1000 / SYNTH_HZ;
const SYNTH_MAX_BACKFILL = 90; // cap a burst after a long pause (~3 s)

/**
 * Fully self-contained synthetic rPPG source — no camera, no DOM. It integrates an
 * instantaneous heart frequency (modulated by respiration + a little noise) so the
 * signal has realistic beat-to-beat variation, and emits samples on a fixed 30 Hz
 * grid decoupled from the render loop.
 */
export class SyntheticSource implements FrameSource {
  readonly mode = 'synthetic' as const;

  private params: SyntheticParams = { ...defaultSyntheticParams };
  private rng = mulberry32(0xc0ffee);
  private startMs = 0;
  private emitMs = 0;
  private phase = 0;

  controls: SyntheticControls = { bpm: 72, breathsPerMin: 14, stress: 0 };

  async start(): Promise<void> {
    this.startMs = 0;
    this.emitMs = 0;
    this.phase = 0;
  }

  stop(): void {}

  setControls(c: Partial<SyntheticControls>): void {
    this.controls = { ...this.controls, ...c };
  }

  sample(now: number): FrameSample[] {
    if (this.startMs === 0) {
      this.startMs = now;
      this.emitMs = now;
    }
    const out: FrameSample[] = [];
    let guard = 0;
    while (this.emitMs + SYNTH_STEP_MS <= now && guard < SYNTH_MAX_BACKFILL) {
      this.emitMs += SYNTH_STEP_MS;
      out.push(this.generateAt(this.emitMs));
      guard++;
    }
    // After a long stall (tab resumed), resync instead of spiralling.
    if (now - this.emitMs > 1000) this.emitMs = now;
    return out;
  }

  private generateAt(nowMs: number): FrameSample {
    const dt = 1 / SYNTH_HZ;
    const tSec = (nowMs - this.startMs) / 1000;
    const stress = clamp(this.controls.stress, 0, 1);
    const bpm = this.controls.bpm + stress * 25; // stress nudges HR up
    const rf = this.controls.breathsPerMin / 60;
    const rsaDepth = (1 - stress) * 0.06; // respiratory sinus arrhythmia → HRV

    const fInst =
      (bpm / 60) *
      (1 + rsaDepth * Math.sin(2 * Math.PI * rf * tSec) + 0.01 * gauss(this.rng));
    this.phase += 2 * Math.PI * fInst * dt;

    const pulse = Math.sin(this.phase) + 0.25 * Math.sin(2 * this.phase);
    const resp = this.params.respAmpl * Math.sin(2 * Math.PI * rf * tSec);
    const common = this.params.pulseAmpl * pulse;
    const noiseStd = this.params.noiseStd * (1 + stress * 3);
    const [bR, bG, bB] = this.params.baseline;
    const n = () => noiseStd * gauss(this.rng);

    return {
      t: nowMs,
      g: bG * (1 + common + resp) + bG * n(),
      r: bR * (1 + 0.35 * common + resp) + bR * n(),
      b: bB * (1 + 0.12 * common + resp) + bB * n(),
    };
  }
}
