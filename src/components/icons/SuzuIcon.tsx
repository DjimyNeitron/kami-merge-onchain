// Bonshō (梵鐘) — large hanging Japanese temple bell. v5 rebuild.
//
// Previous v4 was a spherical body with a horizontal slit — read as a
// perfume bottle / jingle-ball. Bonshō is the recognisable silhouette
// hanging from temple eaves:
//   - Trapezoidal body, narrow at top, wider at bottom
//   - Ryūzu (dragon-head loop) at the top for hanging
//   - Two horizontal decorative bands (koma-no-ma) across the waist
//   - Flat bottom rim
//
// Still exported as `SuzuIcon` to avoid touching every import site — the
// SVG class semantics (icon for "sound") are unchanged. `muted` adds
// a diagonal strike.

type Props = {
  muted?: boolean;
  size?: number;
  className?: string;
};

export default function SuzuIcon({
  muted = false,
  size = 24,
  className,
}: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Ryūzu — small loop/horns on top for hanging */}
      <path d="M 10 3.5 Q 10 2, 12 2 Q 14 2, 14 3.5" />

      {/* Main bell body — trapezoidal, narrow top widening to flat bottom */}
      <path
        d="M 9 5
           L 6 17.5
           Q 6 18.5, 7 19
           L 17 19
           Q 18 18.5, 18 17.5
           L 15 5
           L 9 5 Z"
      />

      {/* Top shoulder line — small horizontal just under the ryūzu */}
      <line x1="9.2" y1="5.5" x2="14.8" y2="5.5" />

      {/* First decorative band (koma-no-ma, upper) */}
      <line
        x1="7.5"
        y1="10"
        x2="16.5"
        y2="10"
        strokeWidth={1}
        opacity={0.7}
      />

      {/* Second decorative band (middle) */}
      <line
        x1="7"
        y1="13.5"
        x2="17"
        y2="13.5"
        strokeWidth={1}
        opacity={0.7}
      />

      {/* Bottom rim emphasis */}
      <line
        x1="6.5"
        y1="18.5"
        x2="17.5"
        y2="18.5"
        strokeWidth={0.8}
        opacity={0.5}
      />

      {muted && (
        <line x1="4" y1="4" x2="20" y2="20" strokeWidth={2} />
      )}
    </svg>
  );
}
