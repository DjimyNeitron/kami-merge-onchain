"use client";

// YokaiOverviewCard — single cell in the Screen 1 (Overview) grid.
//
// This is a summary tile, NOT a full NFT card. The intent is "at a
// glance, where am I in the collection for this yokai" — so we
// optimise for:
//   - Compact rendering (11 of these per screen, ~440 px wide)
//   - Calm visuals (no aurora animation on the grid — reserved for
//     the detail screen where the player is focused)
//   - Clear progress signal (X/4 badge in the corner)
//   - Locked-state distinction (silhouette + kanji watermark when no
//     tier is owned)
//
// We deliberately do NOT reuse NFTCard here: NFTCard wires up tilt
// handlers, holo layers, and a static-PNG preload — all wasted work
// for an at-a-glance grid that needs none of that. The visual we want
// is just the asset PNG inside a 5:7 frame with a corner badge. Tap
// drills down to Screen 2 where NFTCard takes over.
//
// Width is driven by the parent (dev playground or production default
// of 198 px) so the same component renders correctly across the
// viewport-simulator sliders.

import styles from "./Inventory.module.css";
import { KANJI, type Tier, type YokaiName } from "@/config/yokai";

interface YokaiOverviewCardProps {
  yokai: YokaiName;
  /** Highest tier the player owns for this yokai. null → locked. */
  highestTier: Tier | null;
  /** 0–4. Drives the "X/4" badge in the top-right corner. */
  ownedCount: number;
  /** Pixel width. Aspect-ratio (5:7) is enforced by CSS. */
  width: number;
  onTap: () => void;
}

function toTitle(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function YokaiOverviewCard({
  yokai,
  highestTier,
  ownedCount,
  width,
  onTap,
}: YokaiOverviewCardProps) {
  const isLocked = highestTier === null;
  const ariaLabel = isLocked
    ? `${toTitle(yokai)}, not yet collected. Tap for tier overview.`
    : `${toTitle(yokai)}, ${ownedCount} of 4 tiers collected, highest ${highestTier}. Tap for tier overview.`;

  if (isLocked) {
    return (
      <button
        type="button"
        onClick={onTap}
        className={styles.lockedCard}
        /* aspect-ratio also declared on .lockedCard CSS, but setting
         * it inline here is the belt-and-suspenders insurance that
         * fixed the PR #28 "Detail black / Overview left-crop" bug:
         * with width inline + aspect-ratio inline, the browser
         * derives height deterministically from width without
         * depending on the class rule being consulted at all. */
        style={{ width, aspectRatio: "5 / 7" }}
        aria-label={ariaLabel}
      >
        <div className={styles.lockedKanji}>{KANJI[yokai]}</div>
        <div className={styles.lockedRomaji}>{toTitle(yokai)}</div>
        {/* Inline SVG padlock — avoids importing an icon set for one
         *  glyph and keeps the colour tied to the parent's CSS var
         *  via `currentColor`. */}
        <svg
          className={styles.lockIcon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
      </button>
    );
  }

  // Owned variant — show the highest-tier asset bitmap so the player
  // sees their "best" version of this yokai. The asset already has
  // the yokai name + kanji + tier label baked in, so we don't add
  // text overlays here.
  const assetSrc = `/nft_assets/static/${yokai}_${highestTier}.png`;

  return (
    <button
      type="button"
      onClick={onTap}
      className={styles.overviewCard}
      style={{ width, aspectRatio: "5 / 7" }}
      aria-label={ariaLabel}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={assetSrc}
        alt=""
        className={styles.overviewArt}
        loading="eager"
        decoding="async"
        draggable={false}
      />
      <div className={styles.progressBadge} aria-hidden="true">
        {ownedCount}/4
      </div>
    </button>
  );
}
