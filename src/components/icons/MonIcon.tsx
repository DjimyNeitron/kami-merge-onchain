// Mon (family crest) icon — outer ring + symmetrical 5-petal sakura in
// stroke-based line-art. Reads as a seal / setting emblem at 24px.

type Props = {
  size?: number;
  className?: string;
};

export default function MonIcon({ size = 24, className }: Props) {
  // Five petals arranged radially. Each petal is drawn as an ellipse
  // pointing outward from the center; we rotate a base "up" petal by
  // 72° * index around (12, 12).
  const petals = [0, 72, 144, 216, 288];

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
      {/* Outer seal ring — just inside the 24×24 bounds so stroke doesn't clip */}
      <circle cx="12" cy="12" r="10.5" />

      {/* 5-petal sakura */}
      {petals.map((deg) => (
        <ellipse
          key={deg}
          cx="12"
          cy="7.2"
          rx="1.9"
          ry="2.9"
          transform={`rotate(${deg} 12 12)`}
        />
      ))}

      {/* Small center point */}
      <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}
