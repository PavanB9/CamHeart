// Concrete hex/rgba colours for <canvas> drawing (canvas can't read CSS vars).
// Keep these in sync with the CSS custom properties in styles.css.
export const palette = {
  cyan: '#19e6ff',
  magenta: '#ff3da6',
  green: '#28ffa6',
  amber: '#ffb020',
  red: '#ff4d5e',
  text: '#cde8f0',
  textDim: '#6f8a99',
  grid: 'rgba(25, 230, 255, 0.10)',
  glow: 'rgba(25, 230, 255, 0.35)',
} as const;
