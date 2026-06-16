import { useCallback, useEffect, useRef, useState } from 'react';
import { config } from '../config';
import type { RppgAlgorithm } from '../config';
import { VitalsEngine, emptyVitals } from '../engine/pipeline';
import type { Vitals } from '../engine/pipeline';
import { SyntheticSource } from '../camera/frameSource';
import type { FrameSource } from '../camera/frameSource';
import { VideoFrameSource } from '../camera/videoFrameSource';
import type { TrackingState } from '../camera/videoFrameSource';
import { cameraErrorMessage } from '../camera/useCamera';

export type Mode = 'synthetic' | 'webcam' | 'sampleVideo';

const EMIT_INTERVAL_MS = 66; // push React state ~15 fps; canvas can read more often
const NO_TRACKING: TrackingState = { hasFace: false, rois: null };

/**
 * Owns the analysis engine, the active frame source (synthetic / webcam /
 * sample-video), and the single rAF loop that drives them. Exposes live Vitals,
 * the shared <video> ref, and per-frame tracking geometry (via a ref the HUD reads).
 */
export function useEngine() {
  const engineRef = useRef<VitalsEngine | null>(null);
  if (!engineRef.current) engineRef.current = new VitalsEngine();
  const syntheticRef = useRef<SyntheticSource | null>(null);
  if (!syntheticRef.current) syntheticRef.current = new SyntheticSource();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sourceRef = useRef<FrameSource | null>(null);
  const trackingRef = useRef<TrackingState>(NO_TRACKING);

  const [vitals, setVitals] = useState<Vitals>(() => emptyVitals(config.defaultAlgorithm));
  const [mode, setMode] = useState<Mode>('synthetic');
  const [status, setStatus] = useState('');
  const [faceTracked, setFaceTracked] = useState(false);
  const [algorithm, setAlgorithm] = useState<RppgAlgorithm>(config.defaultAlgorithm);
  const [synthBpm, setSynthBpm] = useState(72);
  const [synthStress, setSynthStress] = useState(0);

  useEffect(() => {
    engineRef.current?.setAlgorithm(algorithm);
  }, [algorithm]);

  useEffect(() => {
    syntheticRef.current?.setControls({ bpm: synthBpm, stress: synthStress });
  }, [synthBpm, synthStress]);

  // (Re)build the active source whenever the mode changes.
  useEffect(() => {
    const engine = engineRef.current!;
    engine.reset();
    trackingRef.current = NO_TRACKING;
    setFaceTracked(false);
    let cancelled = false;

    if (mode === 'synthetic') {
      const src = syntheticRef.current!;
      void src.start();
      sourceRef.current = src;
      setStatus('');
    } else {
      const video = videoRef.current;
      if (!video) return;
      const src = new VideoFrameSource(video, mode);
      sourceRef.current = src;
      setStatus(mode === 'webcam' ? 'Requesting camera…' : 'Loading model…');
      src
        .start()
        .then(() => {
          if (!cancelled) setStatus('');
        })
        .catch((e) => {
          if (!cancelled) setStatus(cameraErrorMessage(e));
        });
    }

    return () => {
      cancelled = true;
      sourceRef.current?.stop();
      sourceRef.current = null;
    };
  }, [mode]);

  // Single animation loop, independent of mode.
  useEffect(() => {
    const engine = engineRef.current!;
    let raf = 0;
    let lastEmit = 0;
    let mounted = true;

    const loop = (now: number) => {
      if (!mounted) return;
      const src = sourceRef.current;
      if (src) {
        try {
          const s = src.sample(now);
          if (s) engine.pushSample(s.t, s.r, s.g, s.b);
        } catch {
          /* a dropped frame shouldn't kill the loop */
        }
        if (src instanceof VideoFrameSource) trackingRef.current = src.tracking;
      }
      const v = engine.tick(now);
      if (now - lastEmit > EMIT_INTERVAL_MS) {
        lastEmit = now;
        setVitals(v);
        setFaceTracked(trackingRef.current.hasFace);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      mounted = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  const loadSampleVideo = useCallback((file: File) => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = null;
    video.src = URL.createObjectURL(file);
    video.loop = true;
    video.muted = true;
    setMode('sampleVideo');
  }, []);

  const startCalibration = useCallback(() => {
    engineRef.current?.startCalibration(45);
  }, []);

  return {
    vitals,
    mode,
    setMode,
    status,
    faceTracked,
    algorithm,
    setAlgorithm,
    synthBpm,
    setSynthBpm,
    synthStress,
    setSynthStress,
    startCalibration,
    loadSampleVideo,
    videoRef,
    trackingRef,
  };
}
