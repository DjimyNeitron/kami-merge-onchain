// HudIcons — single import surface for the 5 HUD glyphs, shared by the
// GameCanvas HUD and the "How to Play" Controls legend so both render
// from ONE source (no duplicated SVG markup).
//
//   1. SuzuIcon        — temple bell (audio mute-all; `muted` adds a strike)
//   2. LeaderboardIcon — 3-bar podium
//   3. ToriiIcon       — shrine gate          (extracted from the HUD button)
//   4. InfoIcon        — info ⓘ ring          (extracted from the HUD button)
//   5. MonIcon         — sakura crest (Settings)
//
// SuzuIcon / LeaderboardIcon / MonIcon already live as standalone
// components under @/components/icons (also imported by Settings +
// SplashScreen); they're re-exported here verbatim — surfaced through one
// module without copying their SVG or touching those files. ToriiIcon and
// InfoIcon were inline JSX in the HUD buttons; they're defined here so the
// HUD and the legend share the exact same markup.
//
// All glyphs are presentational: they inherit color via `currentColor`
// (gold in the HUD, re-tinted to wood-ink in the parchment legend).

export { default as SuzuIcon } from "@/components/icons/SuzuIcon";
export { default as MonIcon } from "@/components/icons/MonIcon";
export { default as LeaderboardIcon } from "@/components/icons/LeaderboardIcon";

type IconProps = {
  size?: number;
  className?: string;
};

// Torii: two stacked horizontal beams + two posts. (Verbatim from the HUD
// "The Shrine" button so the HUD stays pixel-identical.)
export function ToriiIcon({ size = 24, className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 6 H21" />
      <path d="M5 9.2 H19" />
      <path d="M6.5 6 V20" />
      <path d="M17.5 6 V20" />
    </svg>
  );
}

// Info glyph: ring + dot + stem. (Verbatim from the HUD "How to Play"
// button so the HUD stays pixel-identical.)
export function InfoIcon({ size = 24, className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="8" r="0.6" fill="currentColor" stroke="none" />
      <path d="M12 11 V16.5" />
    </svg>
  );
}
