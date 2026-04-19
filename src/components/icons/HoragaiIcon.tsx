// Horagai (法螺貝) — Japanese conch-shell trumpet used for Shinto ritual
// and samurai battlefield signalling. Stroke-based icon matching the
// FurinIcon / MonIcon family: viewBox 24, 1.5 stroke, currentColor, round
// caps. When `muted` is true a diagonal strike line crosses the whole icon.

type Props = {
  muted?: boolean;
  size?: number;
  className?: string;
};

export default function HoragaiIcon({
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
      {/* Conical mouth (bell) on the left — curved trumpet opening */}
      <path d="M14 6 Q6 9 6 12 Q6 15 14 14" />
      {/* Inner spiral — tight decreasing curl (the shell's internal whorl) */}
      <path d="M14 6 Q18 6 18 10 Q18 14 14 14 Q11 14 11 11 Q11 9 13 9 Q14 9 14 10.5" />
      {/* Short tanzaku cord / tassel above the rim */}
      <path d="M15 5 l1.2 -2" />
      <path d="M16.5 4 l1 -1.2" />
      {muted && <line x1="21" y1="3" x2="3" y2="21" />}
    </svg>
  );
}
