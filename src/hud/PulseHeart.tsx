import { palette } from './palette';

interface Props {
  bpm: number | null;
  size?: number;
}

/** An SVG heart that beats at the current BPM (animation period = 60/bpm). */
export default function PulseHeart({ bpm, size = 58 }: Props) {
  const beating = bpm != null && bpm > 0;
  const style = beating
    ? { animationDuration: `${60 / bpm!}s` }
    : { animation: 'none', opacity: 0.4 };
  return (
    <svg
      className="pulse-heart"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      style={style}
      aria-hidden="true"
    >
      <path
        d="M16 28.6l-1.8-1.6C8 21.3 3.7 17.4 3.7 12.8 3.7 9.2 6.5 6.4 10 6.4c2 0 3.9 0.9 5.2 2.4l0.8 0.9 0.8-0.9c1.3-1.5 3.2-2.4 5.2-2.4 3.5 0 6.3 2.8 6.3 6.4 0 4.6-4.3 8.5-10.5 14.2L16 28.6z"
        fill={palette.red}
      />
    </svg>
  );
}
