// Shamisen (三味線) — 3-string traditional Japanese lute. Stroke-based icon
// matching the Horagai / Furin / Mon family: viewBox 24, 1.5 stroke,
// currentColor, round caps. Square body bottom-left with neck extending up
// to the top-right, 3 parallel strings along the neck. `muted` adds a
// diagonal strike like the other audio icons.

type Props = {
  muted?: boolean;
  size?: number;
  className?: string;
};

export default function ShamisenIcon({
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
      {/* Square body with slightly rounded corners (dō) */}
      <rect x="3" y="14" width="7" height="7" rx="1.3" />
      {/* Neck (sao) — parallelogram extending up-right from the body */}
      <path d="M8.5 14 L19.5 3 L21 4.5 L10 15.5 Z" />
      {/* 3 strings running along the neck's length */}
      <line x1="9.3" y1="14.8" x2="20.3" y2="3.8" strokeWidth={0.9} />
      <line x1="9.8" y1="15.3" x2="20.8" y2="4.3" strokeWidth={0.9} />
      <line x1="10.3" y1="15.8" x2="21.3" y2="4.8" strokeWidth={0.9} />
      {muted && <line x1="21" y1="3" x2="3" y2="21" />}
    </svg>
  );
}
