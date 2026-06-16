/** Decorative full-screen HUD frame: corner brackets + a slow scan line. */
export default function HudFrame() {
  return (
    <div className="hud-frame" aria-hidden="true">
      <span className="corner corner--tl" />
      <span className="corner corner--tr" />
      <span className="corner corner--bl" />
      <span className="corner corner--br" />
      <div className="scanline" />
    </div>
  );
}
