// Suzu (鈴) — Shinto shrine bell, v4. Spherical grapefruit-shaped body
// (not bell/dome), dominant horizontal slit spanning most of the body,
// small triangular clapper tongue hanging under the slit, subtle upper-
// left highlight hint for volume. Stroke-based, viewBox 24, 1.5 stroke,
// currentColor, round caps. `muted` adds a diagonal strike.

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
      {/* Short cord from the top */}
      <line x1="12" y1="2.5" x2="12" y2="5" />
      {/* Fastening knot */}
      <path
        d="M 10.5 5 L 13.5 5 L 13.5 6 L 10.5 6 Z"
        fill="currentColor"
      />

      {/* Spherical body — rx 7, ry 7.5 (almost a circle, slightly taller
       * so it reads as a cast bell rather than a perfect sphere) */}
      <ellipse cx="12" cy="14" rx="7" ry="7.5" />

      {/* Dominant horizontal slit — the key identifier, thicker stroke */}
      <line x1="6" y1="15.5" x2="18" y2="15.5" strokeWidth={2} />

      {/* Triangular clapper tongue hanging below the slit */}
      <path
        d="M 11 17.5 L 13 17.5 L 12 19 Z"
        fill="currentColor"
      />

      {/* Subtle upper-left highlight — hint of a lit sphere */}
      <path
        d="M 7 11 Q 8 9.5, 10 9.5"
        strokeWidth={0.8}
        opacity={0.5}
      />

      {muted && (
        <line x1="4" y1="4" x2="20" y2="20" strokeWidth={2} />
      )}
    </svg>
  );
}
