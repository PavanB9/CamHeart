import { useEngine } from './state/useEngine';
import HeartGraph from './hud/HeartGraph';
import Vignette from './hud/Vignette';
import { palette } from './hud/palette';
import type { RppgAlgorithm } from './config';

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

export default function App() {
  const e = useEngine();
  const v = e.vitals;

  const algos: RppgAlgorithm[] = ['pos', 'green'];

  return (
    <div className="app">
      <Vignette stress={v.stress} />

      <header className="topbar">
        <span className="logo">
          CAM<span className="logo-dot">·</span>HEART
        </span>
        <span className="badge badge--mode">SYNTHETIC</span>
        <span className={`badge ${v.acquiring ? 'badge--warn' : 'badge--ok'}`}>
          {v.acquiring ? 'ACQUIRING' : 'LOCKED'}
        </span>
      </header>

      <main className="stage">
        <section className="readouts">
          <Stat label="HEART RATE" value={v.bpm ? v.bpm.toFixed(0) : '— —'} unit="bpm" />
          <Stat
            label="BREATHING"
            value={v.breathsPerMin ? v.breathsPerMin.toFixed(0) : '—'}
            unit="/min"
            color={palette.green}
          />
          <Stat
            label="STRESS"
            value={(v.stress * 100).toFixed(0)}
            unit="%"
            color={palette.magenta}
          />
          <Stat
            label="CONFIDENCE"
            value={(v.confidence * 100).toFixed(0)}
            unit="%"
            color={palette.amber}
          />
        </section>

        <HeartGraph data={v.waveform} />

        <section className="telemetry">
          <span>fps {v.effectiveFps.toFixed(0)}</span>
          <span>buffer {v.bufferSec.toFixed(0)}s</span>
          <span>snr {Number.isFinite(v.snrDb) ? v.snrDb.toFixed(1) : '—'} dB</span>
          <span>rmssd {v.rmssd != null ? v.rmssd.toFixed(0) + ' ms' : '—'}</span>
          {v.calibrating && <span className="hot">CALIBRATING {(v.calibrationProgress * 100).toFixed(0)}%</span>}
          {v.calibrated && <span className="ok">CALIBRATED</span>}
        </section>
      </main>

      <aside className="panel">
        <h3>Synthetic source</h3>
        <p className="panel-note">
          No camera needed — a simulated pulse drives the full pipeline. Drag to see
          the readouts and stress vignette react.
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

        <div className="algo">
          <span className="slider-label">Algorithm</span>
          <div className="seg">
            {algos.map((a) => (
              <button
                key={a}
                className={`seg-btn ${e.algorithm === a ? 'on' : ''}`}
                onClick={() => e.setAlgorithm(a)}
              >
                {a.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <button className="calib-btn" onClick={e.startCalibration} disabled={v.calibrating}>
          {v.calibrating ? 'Calibrating…' : 'Calibrate (45s rest)'}
        </button>
      </aside>
    </div>
  );
}
