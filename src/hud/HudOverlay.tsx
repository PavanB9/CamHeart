import { useEffect, useRef } from 'react';
import type { TrackingState } from '../camera/videoFrameSource';
import type { NormRect } from '../tracking/roi';
import { palette } from './palette';

interface Props {
  videoRef: { current: HTMLVideoElement | null };
  trackingRef: { current: TrackingState };
  mirror: boolean;
}

interface PxRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function drawBrackets(ctx: CanvasRenderingContext2D, r: PxRect, color: string): void {
  const len = Math.min(28, r.w * 0.25, r.h * 0.25);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  const corners: [number, number, number, number][] = [
    [r.x, r.y, 1, 1],
    [r.x + r.w, r.y, -1, 1],
    [r.x, r.y + r.h, 1, -1],
    [r.x + r.w, r.y + r.h, -1, -1],
  ];
  for (const [cx, cy, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx + sx * len, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + sy * len);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
}

function drawRoi(ctx: CanvasRenderingContext2D, r: PxRect, label: string): void {
  ctx.strokeStyle = palette.magenta;
  ctx.lineWidth = 1.25;
  ctx.setLineDash([5, 4]);
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  ctx.setLineDash([]);
  ctx.fillStyle = palette.magenta;
  ctx.font = '9px monospace';
  ctx.fillText(label, r.x + 2, r.y - 3);
}

/**
 * Canvas overlay drawn over the live video: face corner-brackets, the forehead
 * and cheek ROIs being sampled, and a sweeping scan line. Runs on its own rAF and
 * reads the per-frame tracking geometry the engine produces. Maps normalised
 * landmark coords through the video's object-fit:contain letterbox (and mirrors x
 * for the selfie webcam view).
 */
export default function HudOverlay({ videoRef, trackingRef, mirror }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let raf = 0;
    let mounted = true;

    const draw = () => {
      if (!mounted) return;
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (canvas && video) {
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (ctx && w > 0 && h > 0) {
          if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
          }
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.clearRect(0, 0, w, h);

          const vw = video.videoWidth;
          const vh = video.videoHeight;
          const track = trackingRef.current;
          if (vw > 0 && vh > 0 && track.hasFace && track.rois) {
            // object-fit: contain letterbox mapping.
            const scale = Math.min(w / vw, h / vh);
            const cw = vw * scale;
            const ch = vh * scale;
            const ox = (w - cw) / 2;
            const oy = (h - ch) / 2;
            const mapRect = (r: NormRect): PxRect => {
              const xa = ox + (mirror ? 1 - r.x : r.x) * cw;
              const xb = ox + (mirror ? 1 - (r.x + r.w) : r.x + r.w) * cw;
              return {
                x: Math.min(xa, xb),
                y: oy + r.y * ch,
                w: Math.abs(xb - xa),
                h: r.h * ch,
              };
            };

            const face = mapRect(track.rois.face);
            drawBrackets(ctx, face, palette.cyan);
            drawRoi(ctx, mapRect(track.rois.forehead), 'FOREHEAD');
            drawRoi(ctx, mapRect(track.rois.leftCheek), 'CHEEK');
            drawRoi(ctx, mapRect(track.rois.rightCheek), 'CHEEK');

            // Sweeping scan line inside the face box.
            const phase = (performance.now() % 2200) / 2200;
            const sy = face.y + phase * face.h;
            ctx.strokeStyle = 'rgba(25,230,255,0.55)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(face.x, sy);
            ctx.lineTo(face.x + face.w, sy);
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      mounted = false;
      cancelAnimationFrame(raf);
    };
  }, [videoRef, trackingRef, mirror]);

  return <canvas ref={canvasRef} className="hud-overlay" />;
}
