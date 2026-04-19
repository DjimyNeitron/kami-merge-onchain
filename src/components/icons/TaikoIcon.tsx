// Taiko (太鼓) — ritual drum with two crossed bachi sticks above, v4.
// Classic "drums" iconography: barrel in 3/4 perspective + two bachi
// forming an X over the membrane, knobs on the upper (handle) ends.
// Stroke-based, viewBox 24, 1.5 stroke, currentColor, round caps.
// `muted` adds a diagonal strike.

type Props = {
  muted?: boolean;
  size?: number;
  className?: string;
};

export default function TaikoIcon({
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
      {/* Crossed bachi — left stick top-left down to drum top */}
      <line x1="4" y1="3" x2="13" y2="10" strokeWidth={1.8} />
      {/* Right stick top-right down to drum top (X intersection near 12,10) */}
      <line x1="20" y1="3" x2="11" y2="10" strokeWidth={1.8} />
      {/* Handle knobs at the upper ends */}
      <circle cx="4" cy="3" r="0.9" fill="currentColor" />
      <circle cx="20" cy="3" r="0.9" fill="currentColor" />

      {/* Top membrane — perspective ellipse */}
      <ellipse cx="12" cy="11" rx="7" ry="2" />

      {/* Left barrel wall — slight outward curve */}
      <path d="M 5 11 Q 4.5 14.5, 5 18" />
      {/* Right barrel wall — mirrored */}
      <path d="M 19 11 Q 19.5 14.5, 19 18" />
      {/* Front curve of the bottom rim */}
      <path d="M 5 18 Q 12 20, 19 18" />

      {/* Metal hoop band following the body curve */}
      <path
        d="M 5 14.5 Q 12 15.5, 19 14.5"
        strokeWidth={0.9}
        opacity={0.6}
      />

      {muted && (
        <line x1="4" y1="4" x2="20" y2="20" strokeWidth={2} />
      )}
    </svg>
  );
}
