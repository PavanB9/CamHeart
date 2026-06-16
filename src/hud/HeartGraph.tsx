import { useEffect, useRef } from 'react';
import { palette } from './palette';

interface Props {
  data: Float64Array;
  color?: string;
  height?: number;
}

/** Scrolling rPPG waveform on a canvas. Redraws whenever `data` changes. */
export default function HeartGraph({ data, color = palette.cyan, height = 140 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 600;
    const h = canvas.clientHeight || height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Grid.
    ctx.strokeStyle = palette.grid;
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= w; gx += 40) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, h);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    if (data.length > 1) {
      let max = 1e-6;
      for (let i = 0; i < data.length; i++) max = Math.max(max, Math.abs(data[i]));
      const n = data.length;

      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * w;
        const y = h / 2 - (data[i] / max) * (h * 0.42);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.shadowColor = palette.glow;
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }, [data, color, height]);

  return <canvas ref={ref} className="heart-graph" style={{ height }} />;
}
