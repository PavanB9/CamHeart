import { useCallback, useEffect, useRef, useState } from 'react';
import { config } from '../config';
import type { RppgAlgorithm } from '../config';
import { VitalsEngine, emptyVitals } from '../engine/pipeline';
import type { Vitals } from '../engine/pipeline';
import { SyntheticSource } from '../camera/frameSource';

const EMIT_INTERVAL_MS = 66; // push React state ~15 fps; canvas can read more often

/**
 * Drives the synthetic frame source + the analysis engine on a single rAF loop
 * and exposes the latest Vitals plus the synthetic controls. Webcam / sample-video
 * sources slot in here in the face-tracking phase.
 */
export function useEngine() {
  const engineRef = useRef<VitalsEngine | null>(null);
  const sourceRef = useRef<SyntheticSource | null>(null);
  if (!engineRef.current) engineRef.current = new VitalsEngine();
  if (!sourceRef.current) sourceRef.current = new SyntheticSource();

  const [vitals, setVitals] = useState<Vitals>(() => emptyVitals(config.defaultAlgorithm));
  const [algorithm, setAlgorithm] = useState<RppgAlgorithm>(config.defaultAlgorithm);
  const [synthBpm, setSynthBpm] = useState(72);
  const [synthStress, setSynthStress] = useState(0);

  useEffect(() => {
    engineRef.current?.setAlgorithm(algorithm);
  }, [algorithm]);

  useEffect(() => {
    sourceRef.current?.setControls({ bpm: synthBpm, stress: synthStress });
  }, [synthBpm, synthStress]);

  useEffect(() => {
    const engine = engineRef.current!;
    const source = sourceRef.current!;
    let raf = 0;
    let lastEmit = 0;
    let mounted = true;

    void source.start();
    const loop = (now: number) => {
      if (!mounted) return;
      const s = source.sample(now);
      if (s) engine.pushSample(s.t, s.r, s.g, s.b);
      const v = engine.tick(now);
      if (now - lastEmit > EMIT_INTERVAL_MS) {
        lastEmit = now;
        setVitals(v);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      mounted = false;
      cancelAnimationFrame(raf);
      source.stop();
    };
  }, []);

  const startCalibration = useCallback(() => {
    engineRef.current?.startCalibration(45);
  }, []);

  return {
    vitals,
    algorithm,
    setAlgorithm,
    synthBpm,
    setSynthBpm,
    synthStress,
    setSynthStress,
    startCalibration,
  };
}
