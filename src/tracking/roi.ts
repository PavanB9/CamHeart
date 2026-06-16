// Region-of-interest geometry from MediaPipe face-mesh landmarks, plus mean-RGB
// sampling. We pick the forehead and both cheeks — high capillary density, low
// movement — and average their skin colour each frame.

export interface Point {
  x: number; // normalised 0..1 (relative to image width)
  y: number; // normalised 0..1 (relative to image height)
}

export interface NormRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RoiSet {
  face: NormRect;
  forehead: NormRect;
  leftCheek: NormRect;
  rightCheek: NormRect;
}

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

// Landmark index groups (MediaPipe 468/478 face mesh).
const FOREHEAD = [67, 109, 10, 338, 297, 105, 66, 107, 336, 296, 334, 9];
const LEFT_CHEEK = [205, 50, 101, 118, 117, 123, 147, 187];
const RIGHT_CHEEK = [425, 280, 330, 347, 346, 352, 376, 411];

function bboxOf(landmarks: Point[], idx: number[], inset: number): NormRect {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const i of idx) {
    const p = landmarks[i];
    if (!p) continue;
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const w = Math.max(0, maxX - minX);
  const h = Math.max(0, maxY - minY);
  return {
    x: minX + w * inset,
    y: minY + h * inset,
    w: w * (1 - 2 * inset),
    h: h * (1 - 2 * inset),
  };
}

function faceBox(landmarks: Point[]): NormRect {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const p of landmarks) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function computeRois(landmarks: Point[]): RoiSet {
  return {
    face: faceBox(landmarks),
    forehead: bboxOf(landmarks, FOREHEAD, 0.12),
    leftCheek: bboxOf(landmarks, LEFT_CHEEK, 0.18),
    rightCheek: bboxOf(landmarks, RIGHT_CHEEK, 0.18),
  };
}

/** Average RGB over a normalised rect of an ImageData buffer (skipping shadow/specular pixels). */
export function meanRgbInRect(img: ImageData, rect: NormRect): Rgb | null {
  const W = img.width;
  const H = img.height;
  const x0 = Math.max(0, Math.floor(rect.x * W));
  const y0 = Math.max(0, Math.floor(rect.y * H));
  const x1 = Math.min(W, Math.ceil((rect.x + rect.w) * W));
  const y1 = Math.min(H, Math.ceil((rect.y + rect.h) * H));
  const d = img.data;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const o = (y * W + x) * 4;
      const rr = d[o];
      const gg = d[o + 1];
      const bb = d[o + 2];
      const lum = (rr + gg + bb) / 3;
      if (lum < 25 || lum > 245) continue; // skip deep shadow / blown highlights
      r += rr;
      g += gg;
      b += bb;
      n++;
    }
  }
  if (n === 0) return null;
  return { r: r / n, g: g / n, b: b / n };
}

/** Mean RGB across the forehead + both cheeks (averaging the per-ROI means). */
export function meanRgbOverRois(img: ImageData, rois: RoiSet): Rgb | null {
  const parts: Rgb[] = [];
  for (const rect of [rois.forehead, rois.leftCheek, rois.rightCheek]) {
    const m = meanRgbInRect(img, rect);
    if (m) parts.push(m);
  }
  if (!parts.length) return null;
  let r = 0;
  let g = 0;
  let b = 0;
  for (const p of parts) {
    r += p.r;
    g += p.g;
    b += p.b;
  }
  return { r: r / parts.length, g: g / parts.length, b: b / parts.length };
}
