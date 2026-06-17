import { useState } from 'react';

interface Props {
  text: string;
  /** Open the bubble upward (use near the bottom of a container). */
  up?: boolean;
  /** Anchor the bubble's right edge to the dot (use near the right edge). */
  alignRight?: boolean;
}

/**
 * A tiny "i" affordance that reveals an explanatory bubble. Shows on hover
 * (desktop) and toggles on click/tap (touch), so it works everywhere.
 */
export default function InfoTip({ text, up = false, alignRight = false }: Props) {
  const [open, setOpen] = useState(false);
  const cls = [
    'infotip-bubble',
    up ? 'infotip-bubble--up' : '',
    alignRight ? 'infotip-bubble--right' : '',
    open ? 'is-open' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <span className="infotip">
      <button
        type="button"
        className="infotip-dot"
        aria-label="More information"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
      >
        i
      </button>
      <span className={cls} role="tooltip">
        {text}
      </span>
    </span>
  );
}
