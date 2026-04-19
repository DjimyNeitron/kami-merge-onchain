// Suzu (鈴) — Shinto shrine bell. Rounded bell body with a horizontal slit
// (iconic opening), string and knot at the top. Stroke-based, same
// conventions as the rest of the icon family (viewBox 24, 1.5 stroke,
// currentColor, round caps). `muted` adds a diagonal strike line.

type Props = {
  muted?: boolean;
  size?: number;
  className?: string;
};

export default function SuzuIcon({ muted = false, size = 24, className }: Props) {
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
      {/* Himo (cord) + top knot */}
      <line x1="10.5" y1="3" x2="13.5" y2="3" />
      <line x1="12" y1="3" x2="12" y2="7" />

      {/* Bell body — rounded dome top, wider rounded bottom */}
      <path d="M8 9 Q12 6 16 9 L16 16 Q12 19 8 16 Z" />

      {/* Mouth slit — the characteristic horizontal opening of a suzu */}
      <line x1="9.5" y1="14" x2="14.5" y2="14" />

      {/* Subtle inner highlight arc (adds depth at small sizes) */}
      <path
        d="M10 10 Q12 8.5 14 10"
        strokeWidth={0.7}
        opacity={0.55}
      />

      {muted && <line x1="21" y1="3" x2="3" y2="21" />}
    </svg>
  );
}
