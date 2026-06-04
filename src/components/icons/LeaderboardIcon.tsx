// Leaderboard icon — a three-bar award podium (2nd · 1st · 3rd) in the
// same stroke-based line-art as MonIcon / SuzuIcon. Reads as "ranking"
// at HUD size. Inherits colour via currentColor (gold stroke on dark).

type Props = {
  size?: number;
  className?: string;
};

export default function LeaderboardIcon({ size = 24, className }: Props) {
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
      {/* Podium baseline */}
      <line x1="3.5" y1="20" x2="20.5" y2="20" />
      {/* 2nd place — left, medium */}
      <rect x="4.5" y="12" width="4" height="8" rx="0.8" />
      {/* 1st place — centre, tallest */}
      <rect x="10" y="7.5" width="4" height="12.5" rx="0.8" />
      {/* 3rd place — right, shortest */}
      <rect x="15.5" y="14" width="4" height="6" rx="0.8" />
    </svg>
  );
}
