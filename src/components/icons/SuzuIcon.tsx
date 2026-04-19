// Suzu (鈴) — Shinto shrine bell, v3. Nearly spherical body with a strong
// horizontal slit (the iconic mouth of a suzu), short cord + knot on top,
// small clapper dot below the slit. Stroke-based, viewBox 24, 1.5 stroke,
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
      {/* Short cord from the top of the bell */}
      <line x1="12" y1="3" x2="12" y2="5.5" />
      {/* Knot / fastening strip */}
      <line x1="10.5" y1="5.5" x2="13.5" y2="5.5" />
      {/* Nearly spherical bell body, slightly flattened at bottom */}
      <path d="M 12 6 C 7.5 6, 5 9.5, 5 14 C 5 18, 8 20.5, 12 20.5 C 16 20.5, 19 18, 19 14 C 19 9.5, 16.5 6, 12 6 Z" />
      {/* Characteristic horizontal slit — thicker stroke so it reads at 24px */}
      <line x1="7.5" y1="15" x2="16.5" y2="15" strokeWidth={1.8} />
      {/* Clapper dot under the slit */}
      <circle cx="12" cy="17.5" r="0.6" fill="currentColor" />
      {muted && (
        <line x1="4" y1="4" x2="20" y2="20" strokeWidth={2} />
      )}
    </svg>
  );
}
