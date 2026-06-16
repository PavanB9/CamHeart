interface Props {
  stress: number; // 0..1
}

/**
 * Calming edge vignette that fades in as stress rises. Sits above everything,
 * ignores pointer events. A soft turquoise glow creeps in from the screen edges.
 */
export default function Vignette({ stress }: Props) {
  const opacity = Math.min(0.85, Math.max(0, stress) * 0.95);
  return <div className="vignette" style={{ opacity }} aria-hidden="true" />;
}
