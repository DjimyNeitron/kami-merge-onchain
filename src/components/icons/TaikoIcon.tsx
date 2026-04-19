// Taiko (太鼓) — ritual drum in 3/4 perspective, v3. Top membrane as an
// ellipse, curved barrel walls, front curve of the bottom rim, a metal
// hoop across the middle, and a bachi (stick) with a tip dot approaching
// from upper-right. Stroke-based, viewBox 24, 1.5 stroke, currentColor,
// round caps. `muted` adds a diagonal strike.

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
      {/* Top membrane — ellipse seen in perspective */}
      <ellipse cx="12" cy="7.5" rx="8" ry="2.5" />
      {/* Left barrel wall — slight outward curve */}
      <path d="M 4 7.5 Q 3.5 12, 4 16.5" />
      {/* Right barrel wall — mirrored */}
      <path d="M 20 7.5 Q 20.5 12, 20 16.5" />
      {/* Front curve of the bottom rim */}
      <path d="M 4 16.5 Q 12 19, 20 16.5" />
      {/* Metal hoop wrapping the barrel, follows the body curve */}
      <path d="M 4 12 Q 12 13.2, 20 12" strokeWidth={1} opacity={0.7} />
      {/* Bachi stick approaching from upper right */}
      <line x1="18" y1="6" x2="22" y2="2.5" strokeWidth={1.8} />
      {/* Bachi tip */}
      <circle cx="22" cy="2.5" r="0.9" fill="currentColor" />
      {muted && (
        <line x1="4" y1="4" x2="20" y2="20" strokeWidth={2} />
      )}
    </svg>
  );
}
