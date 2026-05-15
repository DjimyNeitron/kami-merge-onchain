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
// NFTCard now takes a `width` prop (PR #28) so we pass that directly
// — no transform: scale wrapper, no manual height reservation. This
// fixes the visible top-crop and bottom-empty-space glitch we shipped
// in PR #27 where scaling a 240 px native card to 198 px via
// `transform: scale(0.825)` made the asset's text content drift
// off the wrapper's centre. With native width, aspect-ratio: 5/7 on
// .card derives the height automatically and content stays where the
// asset bitmap put it.

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
  /** Pixel width per tier card. Passed straight into NFTCard's width prop. */
  tierCardWidth: number;
  /** Mapping yokai+tier → tokenId, used by the tap handler. */
  tokenIdFor: (yokai: YokaiName, tier: Tier) => string | null;
  onSelectTier: (tier: Tier, tokenId: string) => void;
}

// Threshold copy for the unlock hint. Placeholder values for the
// demo — Stage 7 will swap to real scoring criteria.
const UNLOCK_HINT: Record<Tier, string> = {
  common: "Drop your first to unlock",
  rare: "Score ≥ 500 to unlock",
  epic: "Score ≥ 1,500 to unlock",
  legendary: "Score ≥ 5,000 to unlock",
};

export default function YokaiDetail({
  yokai,
  ownedTiers,
  tierCardWidth,
  tokenIdFor,
  onSelectTier,
}: YokaiDetailProps) {
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
              onClick={() => {
                if (tokenId) onSelectTier(tier, tokenId);
              }}
            >
              <NFTCard
                yokai={yokai}
                tier={tier}
                width={tierCardWidth}
                interactive
              />
            </div>
          );
        }
        return (
          <div
            key={tier}
            className={styles.tierCardLocked}
            /* aspectRatio inline alongside width — same defensive
             * pattern as the owned NFTCard so the locked silhouette
             * keeps 5/7 even if the flex parent tries to stretch. */
            style={{ width: tierCardWidth, aspectRatio: "5 / 7" }}
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
