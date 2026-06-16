import type { FaceLandmarker } from '@mediapipe/tasks-vision';
import { getFaceLandmarker } from '../tracking/faceLandmarker';
import { computeRois, meanRgbOverRois } from '../tracking/roi';
import type { RoiSet } from '../tracking/roi';
import { startWebcam, stopStream } from './useCamera';
import type { FrameMode, FrameSample, FrameSource } from './frameSource';

const SAMPLE_W = 256; // downscaled width of the sampling canvas (keeps getImageData cheap)

export interface TrackingState {
  hasFace: boolean;
  rois: RoiSet | null;
}

/**
 * Real-video frame source (webcam or a loaded sample clip). Each frame it runs the
 * FaceLandmarker, derives forehead/cheek ROIs, and averages their RGB. The latest
 * tracking geometry is exposed for the HUD overlay to draw.
 */
export class VideoFrameSource implements FrameSource {
  readonly mode: FrameMode;
  tracking: TrackingState = { hasFace: false, rois: null };

  private readonly kind: 'webcam' | 'sampleVideo';
  private readonly video: HTMLVideoElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private landmarker: FaceLandmarker | null = null;
  private stream: MediaStream | null = null;
  private lastTs = -1;
  private lastVideoTime = -1;

  constructor(video: HTMLVideoElement, kind: 'webcam' | 'sampleVideo') {
    this.video = video;
    this.kind = kind;
    this.mode = kind;
    this.canvas = document.createElement('canvas');
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('2D canvas context unavailable.');
    this.ctx = ctx;
  }

  async start(): Promise<void> {
    // Load the (shared) model first so it's ready before frames arrive.
    this.landmarker = await getFaceLandmarker();
    if (this.kind === 'webcam') {
      this.stream = await startWebcam(this.video);
    } else {
      await this.video.play().catch(() => {
        /* a sample clip may need a user gesture; ignored */
      });
    }
  }

  stop(): void {
    stopStream(this.stream);
    this.stream = null;
    if (this.kind === 'webcam') this.video.srcObject = null;
    this.tracking = { hasFace: false, rois: null };
  }

  sample(now: number): FrameSample[] {
    const v = this.video;
    const lm = this.landmarker;
    if (!lm || v.readyState < 2 || v.videoWidth === 0) return [];

    // Skip frames we've already processed — on a high-refresh display rAF can
    // outrun the camera, and re-running MediaPipe on the same frame is wasteful.
    if (v.currentTime === this.lastVideoTime) return [];
    this.lastVideoTime = v.currentTime;

    // detectForVideo requires strictly increasing timestamps.
    let ts = now;
    if (ts <= this.lastTs) ts = this.lastTs + 1;
    this.lastTs = ts;

    const res = lm.detectForVideo(v, ts);
    const faces = res.faceLandmarks;
    if (!faces || faces.length === 0) {
      this.tracking = { hasFace: false, rois: null };
      return [];
    }

    const rois = computeRois(faces[0]);
    this.tracking = { hasFace: true, rois };

    // Downscale-draw the current frame, then sample the ROIs.
    const aspect = v.videoHeight / v.videoWidth;
    const w = SAMPLE_W;
    const h = Math.max(1, Math.round(w * aspect));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.ctx.drawImage(v, 0, 0, w, h);
    const img = this.ctx.getImageData(0, 0, w, h);
    const rgb = meanRgbOverRois(img, rois);
    if (!rgb) return [];

    return [{ t: now, r: rgb.r, g: rgb.g, b: rgb.b }];
  }
}
