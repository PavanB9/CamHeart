import { palette } from './palette';

interface Props {
  value: number; // 0..1
  size?: number;
}

/** Radial progress ring for the stress score; colour shifts green → amber → red. */
export default function StressGauge({ value, size = 96 }: Props) {
  const v = Math.max(0, Math.min(1, value));
  const stroke = 8;
  const r = (size - stroke - 4) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - v);
  const cx = size / 2;
  const color = v < 0.34 ? palette.green : v < 0.67 ? palette.amber : palette.red;

  return (
    <svg
      className="stress-gauge"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
    >
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(25,230,255,0.12)" strokeWidth={stroke} />
      <circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${cx} ${cx})`}
        style={{ transition: 'stroke-dashoffset 0.4s ease, stroke 0.4s ease' }}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        className="gauge-text"
        fill={color}
      >
        {Math.round(v * 100)}%
      </text>
    </svg>
  );
}
