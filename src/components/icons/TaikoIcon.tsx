// Taiko (太鼓) — ritual drum in side profile. Barrel body with membrane
// top ellipse, two side hoops, and one bachi (stick) approaching from
// upper-right. Same stroke-based family conventions (24 viewBox, 1.5
// stroke, currentColor, round caps). `muted` adds the standard diagonal
// strike line.

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
      {/* Drum body — slightly rounded barrel in profile */}
      <rect x="4" y="11" width="13" height="8" rx="1.8" />

      {/* Membrane — oval stretched across the top edge */}
      <ellipse cx="10.5" cy="11" rx="6.5" ry="1.3" />

      {/* Side hoops (barrel bands) */}
      <line x1="5" y1="12.5" x2="5" y2="17.5" />
      <line x1="16" y1="12.5" x2="16" y2="17.5" />

      {/* Bachi (stick) — thicker line from upper right */}
      <line x1="17.5" y1="8" x2="21" y2="4" strokeWidth={2} />

      {muted && <line x1="21" y1="3" x2="3" y2="21" />}
    </svg>
  );
}
