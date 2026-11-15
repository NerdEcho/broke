// A glass ball that fills as a goal gets closer: red and nearly empty when it is far, green and full when it is near.
// The liquid's surface takes the colour of the level (red, through amber, to green) and deepens to green below, over
// a red ball, so the two blend where they meet. Two waves drift across the surface at different speeds.
// Plain SVG and one CSS keyframe (globals.css `wave`), so it renders on the server and stops with reduced motion.
export function GoalSphere({ pct, label, size = 168 }: { pct: number; label: string; size?: number }) {
  const p = Math.min(100, Math.max(0, pct));
  const hue = Math.round((p / 100) * 135); // 0 red, 45 amber, 135 green
  const top = 192 - (p / 100) * 184; // the surface, inside a ball from y=8 to y=192
  // One wave length is 100 wide; the path runs 5 lengths so it can slide one length and look endless.
  const wave = (amp: number) => `M-100 0 Q-75 ${-amp} -50 0 T0 0 T50 0 T100 0 T150 0 T200 0 T250 0 T300 0 T350 0 T400 0 V220 H-100 Z`;
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label={label} className="shrink-0">
      <defs>
        <clipPath id="goal-ball"><circle cx="100" cy="100" r="92" /></clipPath>
        <radialGradient id="goal-empty" cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="hsl(0 70% 58%)" stopOpacity="0.55" />
          <stop offset="1" stopColor="hsl(0 70% 32%)" stopOpacity="0.75" />
        </radialGradient>
        <linearGradient id="goal-liquid" gradientUnits="userSpaceOnUse" x1="0" y1="-8" x2="0" y2="120">
          <stop offset="0" stopColor={`hsl(${hue} 78% 50%)`} />
          <stop offset="1" stopColor={`hsl(${Math.min(140, hue + 35)} 70% 36%)`} />
        </linearGradient>
        <radialGradient id="goal-shine" cx="32%" cy="26%" r="45%">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g clipPath="url(#goal-ball)">
        <rect width="200" height="200" fill="url(#goal-empty)" />
        {p > 0 && (
          <g transform={`translate(0 ${top})`}>
            <g style={{ animation: "wave 9s linear infinite" }}><path d={wave(7)} fill="url(#goal-liquid)" opacity="0.55" transform="translate(-30 -3)" /></g>
            <g style={{ animation: "wave 5s linear infinite" }}><path d={wave(5)} fill="url(#goal-liquid)" /></g>
          </g>
        )}
        <circle cx="100" cy="100" r="92" fill="url(#goal-shine)" />
      </g>
      <circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="2" />
      <text x="100" y="100" textAnchor="middle" dominantBaseline="central" fontSize="44" fontWeight="700" fill="#fff" stroke="rgba(0,0,0,0.45)" strokeWidth="3" paintOrder="stroke" style={{ fontVariantNumeric: "tabular-nums" }}>
        {Math.round(p)}%
      </text>
    </svg>
  );
}
