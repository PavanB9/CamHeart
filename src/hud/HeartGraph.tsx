import { useEffect, useRef } from 'react';
import { palette } from './palette';

interface Props {
  data: Float64Array;
  color?: string;
  height?: number;
}

/** Scrolling rPPG waveform with a gradient under-fill, glow, and a leading dot. */
export default function HeartGraph({ data, color = palette.cyan, height = 150 }: Props) {
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
      const xOf = (i: number) => (i / (n - 1)) * w;
      const yOf = (val: number) => h / 2 - (val / max) * (h * 0.42);

      // Gradient under-fill.
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, 'rgba(25,230,255,0.28)');
      grad.addColorStop(1, 'rgba(25,230,255,0)');
      ctx.beginPath();
      ctx.moveTo(xOf(0), h);
      for (let i = 0; i < n; i++) ctx.lineTo(xOf(i), yOf(data[i]));
      ctx.lineTo(xOf(n - 1), h);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Line.
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = xOf(i);
        const y = yOf(data[i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.shadowColor = palette.glow;
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Leading dot.
      const lx = xOf(n - 1);
      const ly = yOf(data[n - 1]);
      ctx.beginPath();
      ctx.arc(lx, ly, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }, [data, color, height]);

  return <canvas ref={ref} className="heart-graph" style={{ height }} />;
}
