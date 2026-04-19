// Furin (Japanese wind chime) icon — stroke-based line-art.
// When `enabled` is true, small sound-wave arcs radiate from the right of
// the bell. When false, a diagonal strike crosses through the whole icon.

type Props = {
  enabled: boolean;
  size?: number;
  className?: string;
};

export default function FurinIcon({ enabled, size = 24, className }: Props) {
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
      {/* Bell body — rounded-top trapezoid (glass dome) */}
      <path d="M8 6 C8 4, 16 4, 16 6 L16 11 L8 11 Z" />
      {/* Bell rim — small horizontal mouth */}
      <line x1="8" y1="11.2" x2="16" y2="11.2" />
      {/* Clapper string hanging from inside */}
      <line x1="12" y1="11.5" x2="12" y2="17" />
      {/* Tanzaku (paper strip) */}
      <rect x="10.5" y="17" width="3" height="4" rx="0.4" />

      {enabled && (
        <>
          {/* Sound-wave arcs radiating right */}
          <path d="M17.5 5.5 Q19.5 8 17.5 10.5" />
          <path d="M19.5 4 Q22 8 19.5 12" />
        </>
      )}

      {!enabled && (
        <line x1="21" y1="3" x2="3" y2="21" stroke="currentColor" />
      )}
    </svg>
  );
}
