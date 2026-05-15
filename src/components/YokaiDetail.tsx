"use client";

// YokaiDetail — Screen 2 of the inventory flow.
//
// After the player taps a yokai cell in the Overview grid, this
// screen takes over and shows the 4 tier variants (Common / Rare /
// Epic / Legendary) for that one yokai in a 2×2 layout. Owned tiers
// render as full NFTCard with all the dynamic behaviour (hover holo
// + tilt). Locked tiers render as a dark silhouette slab with the
// tier label and an unlock hint.
//
// Width is driven by the parent (dev playground or 198 px default).
// Because NFTCard's `size` prop only supports the three discrete
// presets sm (160) / md (240) / lg (360), we scale the NFTCard
// container via CSS transform to hit arbitrary widths between them.
// Aspect ratio and 3-D tilt origins compose correctly under uniform
// transform-scale, so the visual result matches a native-width card.

import NFTCard from "@/components/NFTCard";
import styles from "./Inventory.module.css";
import {
  TIER_ORDER,
  type Tier,
  type YokaiName,
} from "@/config/yokai";

interface YokaiDetailProps {
  yokai: YokaiName;
  /** Which tiers are owned. Closed shape per Tier. */
  ownedTiers: Record<Tier, boolean>;
  /** Pixel width per tier card. Drives CSS scale of NFTCard. */
  tierCardWidth: number;
  /** Mapping yokai+tier → tokenId, used by the tap handler. */
  tokenIdFor: (yokai: YokaiName, tier: Tier) => string | null;
  onSelectTier: (tier: Tier, tokenId: string) => void;
}

// Threshold copy for the unlock hint. These are placeholder values
// for the demo — Stage 7 will swap to real scoring criteria.
const UNLOCK_HINT: Record<Tier, string> = {
  common: "Drop your first to unlock",
  rare: "Score ≥ 500 to unlock",
  epic: "Score ≥ 1,500 to unlock",
  legendary: "Score ≥ 5,000 to unlock",
};

// NFTCard's native size for the size="md" preset. We scale from this
// value to whatever tierCardWidth requests so the tilt math + aspect
// ratio stay consistent.
const NATIVE_MD = 240;

export default function YokaiDetail({
  yokai,
  ownedTiers,
  tierCardWidth,
  tokenIdFor,
  onSelectTier,
}: YokaiDetailProps) {
  const scale = tierCardWidth / NATIVE_MD;

  return (
    <div className={styles.grid}>
      {TIER_ORDER.map((tier) => {
        const isOwned = ownedTiers[tier];
        if (isOwned) {
          const tokenId = tokenIdFor(yokai, tier);
          return (
            <div
              key={tier}
              className={styles.tierCardOwned}
              style={{
                // The wrapper preserves the SCALED footprint so the
                // grid spacing accounts for the visible card size,
                // not NFTCard's native 240 px. Without this the
                // grid layout would think each cell is 240 px and
                // produce mis-aligned rows.
                width: tierCardWidth,
                height: (NATIVE_MD * 7) / 5 * scale,
              }}
              onClick={() => {
                if (tokenId) onSelectTier(tier, tokenId);
              }}
            >
              <div
                className={styles.detailCardWrap}
                style={{ transform: `scale(${scale})` }}
              >
                <NFTCard
                  yokai={yokai}
                  tier={tier}
                  size="md"
                  interactive
                />
              </div>
            </div>
          );
        }
        return (
          <div
            key={tier}
            className={styles.tierCardLocked}
            style={{ width: tierCardWidth }}
          >
            <div className={styles.lockedTierLabel}>{tier}</div>
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
            <div className={styles.lockedHint}>{UNLOCK_HINT[tier]}</div>
          </div>
        );
      })}
    </div>
  );
}
