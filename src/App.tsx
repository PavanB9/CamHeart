import { useRef } from 'react';
import { useEngine } from './state/useEngine';
import type { Mode } from './state/useEngine';
import HeartGraph from './hud/HeartGraph';
import Vignette from './hud/Vignette';
import PulseHeart from './hud/PulseHeart';
import StressGauge from './hud/StressGauge';
import HudFrame from './hud/HudFrame';
import HudOverlay from './hud/HudOverlay';
import { palette } from './hud/palette';
import type { RppgAlgorithm } from './config';

const MODE_LABELS: Record<Mode, string> = {
  synthetic: 'SYNTHETIC',
  webcam: 'WEBCAM',
  sampleVideo: 'SAMPLE VIDEO',
};

function Stat({
  label,
  value,
  unit,
  color = palette.cyan,
}: {
  label: string;
  value: string;
  unit?: string;
  color?: string;
}) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color }}>
        {value}
        {unit && <span className="stat-unit">{unit}</span>}
      </div>
    </div>
  );
}

function Slider({
  label,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="slider">
      <span className="slider-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function AlgoToggle({
  value,
  onChange,
}: {
  value: RppgAlgorithm;
  onChange: (a: RppgAlgorithm) => void;
}) {
  const algos: RppgAlgorithm[] = ['pos', 'green'];
  return (
    <div className="algo">
      <span className="slider-label">Algorithm</span>
      <div className="seg">
        {algos.map((a) => (
          <button
            key={a}
            className={`seg-btn ${value === a ? 'on' : ''}`}
            onClick={() => onChange(a)}
          >
            {a.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const e = useEngine();
  const v = e.vitals;
  const cameraMode = e.mode !== 'synthetic';
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const modes: Mode[] = ['synthetic', 'webcam', 'sampleVideo'];

  return (
    <div className="app">
      <Vignette stress={v.stress} />
      <HudFrame />

      <header className="topbar">
        <span className="logo">
          CAM<span className="logo-dot">·</span>HEART
        </span>
        <span className="badge badge--mode">{MODE_LABELS[e.mode]}</span>
        <span className={`badge ${v.acquiring ? 'badge--warn' : 'badge--ok'}`}>
          {v.acquiring ? 'ACQUIRING' : 'LOCKED'}
        </span>
        {cameraMode && (
          <span className={`badge ${e.faceTracked ? 'badge--ok' : 'badge--warn'}`}>
            {e.faceTracked ? 'FACE' : 'NO FACE'}
          </span>
        )}
        {e.status && <span className="status-msg">{e.status}</span>}
      </header>

      <main className="stage">
        <section className="readouts">
          <div className="stat stat--hero">
            <PulseHeart bpm={v.bpm} />
            <div className="hero-text">
              <div className="stat-label">HEART RATE</div>
              <div className="stat-value" style={{ color: palette.cyan }}>
                {v.bpm ? v.bpm.toFixed(0) : '— —'}
                <span className="stat-unit">bpm</span>
              </div>
            </div>
          </div>

          <Stat
            label="BREATHING"
            value={v.breathsPerMin ? v.breathsPerMin.toFixed(0) : '—'}
            unit="/min"
            color={palette.green}
          />

          <div className="stat stat--gauge">
            <StressGauge value={v.stress} />
            <div className="stat-label gauge-label">STRESS</div>
          </div>

          <Stat
            label="CONFIDENCE"
            value={(v.confidence * 100).toFixed(0)}
            unit="%"
            color={palette.amber}
          />
        </section>

        <div className={`media ${cameraMode ? 'media--on' : 'media--off'}`}>
          <video
            ref={e.videoRef}
            className={`feed ${e.mode === 'webcam' ? 'feed--mirror' : ''}`}
            playsInline
            muted
          />
          {cameraMode && (
            <HudOverlay
              videoRef={e.videoRef}
              trackingRef={e.trackingRef}
              mirror={e.mode === 'webcam'}
            />
          )}
          {cameraMode && !e.faceTracked && (
            <div className="media-hint">
              Point the camera at your face · sit still · even lighting
            </div>
          )}
        </div>

        <HeartGraph data={v.waveform} />

        <section className="telemetry">
          <span>fps {v.effectiveFps.toFixed(0)}</span>
          <span>buffer {v.bufferSec.toFixed(0)}s</span>
          <span>snr {Number.isFinite(v.snrDb) ? v.snrDb.toFixed(1) : '—'} dB</span>
          <span>rmssd {v.rmssd != null ? v.rmssd.toFixed(0) + ' ms' : '—'}</span>
          {v.calibrating && (
            <span className="hot">CALIBRATING {(v.calibrationProgress * 100).toFixed(0)}%</span>
          )}
          {v.calibrated && <span className="ok">CALIBRATED</span>}
        </section>
      </main>

      <aside className="panel">
        <div className="seg modes">
          {modes.map((m) => (
            <button
              key={m}
              className={`seg-btn ${e.mode === m ? 'on' : ''}`}
              onClick={() =>
                m === 'sampleVideo' ? fileInputRef.current?.click() : e.setMode(m)
              }
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          style={{ display: 'none' }}
          onChange={(ev) => {
            const f = ev.target.files?.[0];
            if (f) e.loadSampleVideo(f);
          }}
        />

        {e.mode === 'synthetic' ? (
          <>
            <h3>Synthetic source</h3>
            <p className="panel-note">
              No camera needed — a simulated pulse drives the full pipeline. Drag to
              watch the readouts and the stress vignette react.
            </p>
            <Slider
              label={`Heart rate · ${e.synthBpm} bpm`}
              min={40}
              max={160}
              value={e.synthBpm}
              onChange={e.setSynthBpm}
            />
            <Slider
              label={`Stress · ${(e.synthStress * 100).toFixed(0)}%`}
              min={0}
              max={100}
              value={e.synthStress * 100}
              onChange={(x) => e.setSynthStress(x / 100)}
            />
          </>
        ) : (
          <>
            <h3>{e.mode === 'webcam' ? 'Webcam' : 'Sample video'}</h3>
            <p className="panel-note">
              Sit still for ~10 s under even lighting for a stable lock.
              {e.mode === 'sampleVideo' && ' Choose a clear, well-lit face clip.'}
            </p>
          </>
        )}

        <AlgoToggle value={e.algorithm} onChange={e.setAlgorithm} />

        <button className="calib-btn" onClick={e.startCalibration} disabled={v.calibrating}>
          {v.calibrating ? 'Calibrating…' : 'Calibrate (45s rest)'}
        </button>

        <p className="disclaimer">
          Not a medical device — readings are approximate and processed entirely
          on your machine. Best with even lighting and ~10 s of stillness.
        </p>
      </aside>
    </div>
  );
}
