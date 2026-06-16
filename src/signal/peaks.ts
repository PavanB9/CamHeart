export interface Peak {
  index: number;
  value: number;
}

/**
 * Local-maxima peak detector with a refractory distance and an amplitude
 * threshold (in std units above the mean). Used to find systolic peaks for HRV.
 */
export function findPeaks(
  x: ArrayLike<number>,
  minDistance: number,
  thresholdStd = 0.3,
): Peak[] {
  const n = x.length;
  const peaks: Peak[] = [];
  if (n < 3) return peaks;

  let mu = 0;
  for (let i = 0; i < n; i++) mu += x[i];
  mu /= n;
  let sd = 0;
  for (let i = 0; i < n; i++) {
    const d = x[i] - mu;
    sd += d * d;
  }
  sd = Math.sqrt(sd / Math.max(1, n - 1));
  const thr = mu + thresholdStd * sd;

  let lastIdx = -Infinity;
  for (let i = 1; i < n - 1; i++) {
    if (x[i] > thr && x[i] >= x[i - 1] && x[i] > x[i + 1]) {
      if (i - lastIdx >= minDistance) {
        peaks.push({ index: i, value: x[i] });
        lastIdx = i;
      } else if (peaks.length && x[i] > peaks[peaks.length - 1].value) {
        // Within the refractory window but taller → keep the taller one.
        peaks[peaks.length - 1] = { index: i, value: x[i] };
        lastIdx = i;
      }
    }
  }
  return peaks;
}
