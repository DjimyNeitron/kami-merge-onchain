"use client";

// CardDetail — Screen 3 of the inventory flow.
//
// Renders a single NFTCard at the largest size with full interaction
// (touch tilt, hover holo, animated webp swap), plus a metadata
// panel showing the seven attributes locked in Brief v13 Session B,
// plus action buttons for Share and View on OpenSea.
//
// The metadata values pull from:
//   - ELEMENT_MAP[yokai]               → Element
//   - YOKAI_ORDER.indexOf(yokai) + 1   → Yokai Rank (1..11)
//   - TIER_ORDER.indexOf(tier) + 1     → Tier Rank (1..4)
//   - AURORA_OPACITY[tier]             → Aurora Opacity (0.45..0.90)
//   - InventoryNFT.score               → Score at mint
//   - InventoryNFT.mintedAt            → Relative mint date
//   - InventoryNFT.tokenId             → Token ID
//
// Share + OpenSea are wired as stubs:
//   - Share: console.log fallback in dev; in Stage 4 (cast composer
//     integration) it'll fire sdk.actions.composeCast with a card
//     image attachment.
//   - OpenSea: disabled until the contract address from Stage 7 is
//     plumbed in — the URL pattern is well-known but pointing at a
//     dead contract would be worse than a disabled button.
//
// Width driven by parent (dev playground or 360 default). NFTCard
// natively renders at lg (360 px) so scale ≥ 1 mostly grows; the
// slider's lower bound (280) just shrinks slightly for smaller
// viewports.

import NFTCard from "@/components/NFTCard";
import styles from "./Inventory.module.css";
import {
  AURORA_OPACITY,
  ELEMENT_MAP,
  TIER_ORDER,
  YOKAI_ORDER,
  type Tier,
  type YokaiName,
} from "@/config/yokai";
import type { InventoryNFT } from "@/hooks/useInventory";

interface CardDetailProps {
  nft: InventoryNFT;
  /** Pixel width of the displayed card. NFTCard renders at lg (360) and we scale. */
  detailCardWidth: number;
  onShare?: (nft: InventoryNFT) => void;
}

const NATIVE_LG = 360;

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 0) return "just now";
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} day${day === 1 ? "" : "s"} ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo} month${mo === 1 ? "" : "s"} ago`;
  const yr = Math.floor(day / 365);
  return `${yr} year${yr === 1 ? "" : "s"} ago`;
}

function shortTokenId(id: string): string {
  // Mock tokens have human-readable ids; keep them as-is. Real on-
  // chain ids (Stage 7) will be 0x-prefixed hashes — clip to head…tail.
  if (id.length <= 14) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

export default function CardDetail({
  nft,
  detailCardWidth,
  onShare,
}: CardDetailProps) {
  const scale = detailCardWidth / NATIVE_LG;
  const yokaiRank = YOKAI_ORDER.indexOf(nft.yokai) + 1;
  const tierRank = TIER_ORDER.indexOf(nft.tier) + 1;
  const auroraOp = AURORA_OPACITY[nft.tier];
  const element = ELEMENT_MAP[nft.yokai];

  const handleShare = () => {
    if (onShare) {
      onShare(nft);
      return;
    }
    // Default stub — real Cast composer integration lands in Stage 4.
    if (typeof window !== "undefined") {
      console.log(
        `[CardDetail] share: ${nft.yokai}-${nft.tier} (${nft.tokenId})`
      );
    }
  };

  return (
    <div className={styles.detailLayout}>
      <div
        className={styles.detailCardWrap}
        style={{
          transform: `scale(${scale})`,
          // Reserve the scaled footprint so the metadata panel below
          // doesn't slide up into the card when we shrink.
          width: detailCardWidth,
          height: ((NATIVE_LG * 7) / 5) * scale,
        }}
      >
        <NFTCard
          yokai={nft.yokai}
          tier={nft.tier}
          size="lg"
          interactive
        />
      </div>

      <div className={styles.metadata} aria-label="Card attributes">
        <div className={styles.metadataRow}>
          <span className={styles.metadataKey}>Element</span>
          <span className={styles.metadataVal}>{element}</span>
        </div>
        <div className={styles.metadataRow}>
          <span className={styles.metadataKey}>Yokai Rank</span>
          <span className={styles.metadataVal}>
            {yokaiRank} / {YOKAI_ORDER.length}
          </span>
        </div>
        <div className={styles.metadataRow}>
          <span className={styles.metadataKey}>Tier Rank</span>
          <span className={styles.metadataVal}>
            {tierRank} / {TIER_ORDER.length}
          </span>
        </div>
        <div className={styles.metadataRow}>
          <span className={styles.metadataKey}>Aurora Opacity</span>
          <span className={styles.metadataVal}>{auroraOp.toFixed(2)}</span>
        </div>
        <div className={styles.metadataRow}>
          <span className={styles.metadataKey}>Score at Mint</span>
          <span className={styles.metadataVal}>
            {nft.score.toLocaleString()}
          </span>
        </div>
        <div className={styles.metadataRow}>
          <span className={styles.metadataKey}>Minted</span>
          <span className={styles.metadataVal}>{relativeTime(nft.mintedAt)}</span>
        </div>
        <div className={styles.metadataRow}>
          <span className={styles.metadataKey}>Token ID</span>
          <span className={styles.metadataVal}>{shortTokenId(nft.tokenId)}</span>
        </div>
      </div>

      <div className={styles.actionRow}>
        <button
          type="button"
          className={styles.actionBtn}
          onClick={handleShare}
        >
          Share
        </button>
        <button
          type="button"
          className={styles.actionBtn}
          disabled
          title="Available after contract deployment (Stage 7)"
        >
          OpenSea
        </button>
      </div>
    </div>
  );
}
