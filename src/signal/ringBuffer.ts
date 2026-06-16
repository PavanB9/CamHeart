export interface RgbSample {
  t: number; // timestamp (ms, e.g. performance.now())
  r: number;
  g: number;
  b: number;
}

export interface RgbWindow {
  t: number[];
  r: number[];
  g: number[];
  b: number[];
}

/**
 * Timestamped ring buffer of mean-ROI RGB samples. Old samples beyond the
 * retention horizon are dropped on push, so memory stays bounded regardless of
 * how long the app runs.
 */
export class RgbRingBuffer {
  private t: number[] = [];
  private r: number[] = [];
  private g: number[] = [];
  private b: number[] = [];

  constructor(private readonly retentionMs: number) {}

  push(s: RgbSample): void {
    this.t.push(s.t);
    this.r.push(s.r);
    this.g.push(s.g);
    this.b.push(s.b);

    const cutoff = s.t - this.retentionMs;
    let drop = 0;
    while (drop < this.t.length && this.t[drop] < cutoff) drop++;
    if (drop > 0) {
      this.t.splice(0, drop);
      this.r.splice(0, drop);
      this.g.splice(0, drop);
      this.b.splice(0, drop);
    }
  }

  get length(): number {
    return this.t.length;
  }

  /** The most recent `seconds` of samples. */
  window(seconds: number): RgbWindow {
    const n = this.t.length;
    if (n === 0) return { t: [], r: [], g: [], b: [] };
    const cutoff = this.t[n - 1] - seconds * 1000;
    let start = 0;
    while (start < n && this.t[start] < cutoff) start++;
    return {
      t: this.t.slice(start),
      r: this.r.slice(start),
      g: this.g.slice(start),
      b: this.b.slice(start),
    };
  }

  /** Time span currently held, in seconds. */
  spanSec(): number {
    const n = this.t.length;
    return n < 2 ? 0 : (this.t[n - 1] - this.t[0]) / 1000;
  }

  clear(): void {
    this.t = [];
    this.r = [];
    this.g = [];
    this.b = [];
  }
}
