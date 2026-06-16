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
 * A frame source produces timestamped mean-ROI RGB samples. The synthetic source
 * computes them directly; the webcam / sample-video sources (added with face
 * tracking) will derive them from real video frames behind the same interface.
 */
export interface FrameSource {
  readonly mode: FrameMode;
  start(): Promise<void>;
  stop(): void;
  /** Produce a sample for this animation frame, or null if not ready. */
  sample(now: number): FrameSample | null;
}

export interface SyntheticControls {
  bpm: number;
  breathsPerMin: number;
  stress: number; // 0..1
}

/**
 * Fully self-contained synthetic rPPG source — no camera, no DOM. It integrates
 * an instantaneous heart frequency (modulated by respiration + a little noise) so
 * the produced signal has realistic beat-to-beat variation, which keeps the whole
 * HR / breathing / HRV / stress chain demoable on a machine with no webcam.
 */
export class SyntheticSource implements FrameSource {
  readonly mode = 'synthetic' as const;

  private params: SyntheticParams = { ...defaultSyntheticParams };
  private rng = mulberry32(0xc0ffee);
  private startMs = 0;
  private lastMs = 0;
  private phase = 0;

  controls: SyntheticControls = { bpm: 72, breathsPerMin: 14, stress: 0 };

  async start(): Promise<void> {
    this.startMs = 0;
    this.lastMs = 0;
    this.phase = 0;
  }

  stop(): void {}

  setControls(c: Partial<SyntheticControls>): void {
    this.controls = { ...this.controls, ...c };
  }

  sample(now: number): FrameSample {
    if (this.startMs === 0) {
      this.startMs = now;
      this.lastMs = now;
    }
    const dt = Math.min(0.1, (now - this.lastMs) / 1000);
    this.lastMs = now;
    const tSec = (now - this.startMs) / 1000;

    const stress = clamp(this.controls.stress, 0, 1);
    const bpm = this.controls.bpm + stress * 25; // stress nudges HR up
    const rf = this.controls.breathsPerMin / 60;
    const rsaDepth = (1 - stress) * 0.06; // respiratory sinus arrhythmia → HRV

    // Integrate instantaneous frequency to get realistic, slightly-variable IBIs.
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
      t: now,
      g: bG * (1 + common + resp) + bG * n(),
      r: bR * (1 + 0.35 * common + resp) + bR * n(),
      b: bB * (1 + 0.12 * common + resp) + bB * n(),
    };
  }
}
