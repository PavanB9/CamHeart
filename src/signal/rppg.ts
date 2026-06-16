import type { RppgAlgorithm } from '../config';
import { mean, std } from './stats';

// rPPG pulse extraction: turn a window of per-frame mean RGB into a 1-D pulse
// waveform. Two methods:
//   GREEN — Verkruysse 2008. Just the (inverted, mean-normalised) green channel.
//   POS   — Wang 2017, "Algorithmic Principles of Remote PPG". Projects the
//           temporally-normalised RGB onto a plane orthogonal to the skin tone,
//           which makes it far more robust to motion/illumination than GREEN.

/** GREEN: inverted mean-normalised green channel. */
export function greenPulse(g: ArrayLike<number>): Float64Array {
  const mu = mean(g) || 1;
  const out = new Float64Array(g.length);
  // Negated so a blood-volume rise (less reflected green) is an upward peak.
  for (let i = 0; i < g.length; i++) out[i] = -(g[i] / mu - 1);
  return out;
}

/**
 * POS with the classic sliding-window overlap-add.
 * `r`/`g`/`b` are uniformly sampled at `fs` Hz.
 */
export function posPulse(
  r: ArrayLike<number>,
  g: ArrayLike<number>,
  b: ArrayLike<number>,
  fs: number,
): Float64Array {
  const n = r.length;
  const H = new Float64Array(n);
  if (n === 0) return H;

  const l = Math.max(2, Math.round(1.6 * fs)); // ~1.6 s window
  const s1 = new Float64Array(l);
  const s2 = new Float64Array(l);
  const h = new Float64Array(l);

  for (let end = l - 1; end < n; end++) {
    const m = end - l + 1;

    // Temporal means over the window [m..end].
    let mr = 0;
    let mg = 0;
    let mb = 0;
    for (let i = m; i <= end; i++) {
      mr += r[i];
      mg += g[i];
      mb += b[i];
    }
    mr /= l;
    mg /= l;
    mb /= l;
    if (mr === 0 || mg === 0 || mb === 0) continue;

    // Temporal normalisation + projection P = [[0,1,-1],[-2,1,1]].
    for (let i = 0; i < l; i++) {
      const idx = m + i;
      const rn = r[idx] / mr;
      const gn = g[idx] / mg;
      const bn = b[idx] / mb;
      s1[i] = gn - bn;
      s2[i] = -2 * rn + gn + bn;
    }

    // Alpha-tuning collapses the 2-D projection to 1-D.
    const alpha = std(s1) / (std(s2) || 1e-9);
    let hMean = 0;
    for (let i = 0; i < l; i++) {
      h[i] = s1[i] + alpha * s2[i];
      hMean += h[i];
    }
    hMean /= l;

    // Mean-removed overlap-add.
    for (let i = 0; i < l; i++) H[m + i] += h[i] - hMean;
  }

  return H;
}

export function extractPulse(
  algo: RppgAlgorithm,
  r: ArrayLike<number>,
  g: ArrayLike<number>,
  b: ArrayLike<number>,
  fs: number,
): Float64Array {
  return algo === 'pos' ? posPulse(r, g, b, fs) : greenPulse(g);
}
