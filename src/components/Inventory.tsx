"use client";

// Inventory — the top-level component orchestrating the 3-screen
// collection flow.
//
// Screens form a simple stack:
//   overview  (default)  → grid of 11 yokai cells, tap drills down
//   yokai     (after tap) → 2×2 tier grid for the selected yokai
//   detail    (after tap) → single card + metadata
//
// State machine kept in a single discriminated union (Screen) so
// invalid combinations (e.g. detail without a token id) are unrep-
// resentable at the type level. Back navigation pops the stack.
//
// `initialScreen` lets the dev playground force a particular screen
// at mount, useful for screenshot work without manually clicking
// through the flow each time. In production it's left undefined and
// the default ("overview") wins.
//
// Card widths are passed in as props so the dev sizing playground
// can drive them. Production callers use the locked defaults (198 /
// 198 / 360) and never touch the props.

import { useState } from "react";
import YokaiOverviewCard from "@/components/YokaiOverviewCard";
import YokaiDetail from "@/components/YokaiDetail";
import CardDetail from "@/components/CardDetail";
import styles from "./Inventory.module.css";
import {
  TIER_ORDER,
  YOKAI_ORDER,
  type Tier,
  type YokaiName,
} from "@/config/yokai";
import { useInventory, type InventoryNFT } from "@/hooks/useInventory";

export type InventoryScreen =
  | { name: "overview" }
  | { name: "yokai"; yokai: YokaiName }
  | { name: "detail"; tokenId: string };

export interface InventoryProps {
  /** Override the initial screen — used by the dev force-screen controls. */
  initialScreen?: InventoryScreen;
  /** Pixel width of each yokai cell in the Overview grid. Default 180 (tuned for 424 px Startale viewport: (424 - 32 padding - 12 gap) / 2 ≈ 190; 180 leaves visual breathing room). */
  overviewCardWidth?: number;
  /** Pixel width of each tier card in the Yokai screen. Default 180 (same 2-col math as overview). */
  tierCardWidth?: number;
  /** Pixel width of the single card in the Card Detail screen. Default 300 (~70 % of 424 px Startale viewport). */
  detailCardWidth?: number;
}

function toTitle(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function Inventory({
  initialScreen,
  overviewCardWidth = 180,
  tierCardWidth = 180,
  detailCardWidth = 300,
}: InventoryProps) {
  const inventory = useInventory();
  const [screen, setScreen] = useState<InventoryScreen>(
    initialScreen ?? { name: "overview" }
  );

  // ─── Navigation handlers ──────────────────────────────────────────
  const goOverview = () => setScreen({ name: "overview" });
  const goYokai = (yokai: YokaiName) => setScreen({ name: "yokai", yokai });
  const goDetail = (tokenId: string) => setScreen({ name: "detail", tokenId });
  const goBack = () => {
    if (screen.name === "detail") {
      // Pop back to the parent yokai screen of this NFT.
      const nft = inventory.nfts.find((n) => n.tokenId === screen.tokenId);
      if (nft) {
        setScreen({ name: "yokai", yokai: nft.yokai });
        return;
      }
      goOverview();
    } else if (screen.name === "yokai") {
      goOverview();
    }
  };

  // ─── Loading state — first render after mount, before useEffect
  //   hydrates from localStorage. Empty grid would be ambiguous
  //   (loading vs genuinely-empty collection), so we render a faint
  //   spinner-text instead. */
  if (inventory.isLoading) {
    return (
      <div className={styles.root}>
        <div className={styles.empty}>Loading collection…</div>
      </div>
    );
  }

  // ─── Header — shared across all 3 screens ─────────────────────────
  const title = (() => {
    if (screen.name === "overview") return "Your Collection";
    if (screen.name === "yokai") {
      const owned = inventory.byYokai[screen.yokai].length;
      return `${toTitle(screen.yokai)} ${owned}/${TIER_ORDER.length}`;
    }
    // detail
    const nft = inventory.nfts.find((n) => n.tokenId === screen.tokenId);
    if (!nft) return "Card";
    return `${toTitle(nft.yokai)} · ${nft.tier}`;
  })();

  const showBack = screen.name !== "overview";

  const headerProgress = inventory.count / inventory.total;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        {showBack ? (
          <button
            type="button"
            className={styles.backBtn}
            onClick={goBack}
            aria-label="Back"
          >
            ←
          </button>
        ) : (
          <div className={styles.headerSpacer} aria-hidden="true" />
        )}
        <h1 className={styles.title}>{title}</h1>
        <span className={styles.countBadge}>
          {inventory.count}/{inventory.total}
        </span>
      </div>
      <div className={styles.progressTrack} aria-hidden="true">
        <div
          className={styles.progressFill}
          style={{ width: `${headerProgress * 100}%` }}
        />
      </div>

      <div className={styles.body}>
        {screen.name === "overview" && (
          <OverviewGrid
            inventory={inventory}
            cardWidth={overviewCardWidth}
            onSelectYokai={goYokai}
          />
        )}
        {screen.name === "yokai" && (
          <YokaiDetail
            yokai={screen.yokai}
            ownedTiers={Object.fromEntries(
              TIER_ORDER.map((t) => [t, inventory.hasYokaiTier(screen.yokai, t)])
            ) as Record<Tier, boolean>}
            tierCardWidth={tierCardWidth}
            tokenIdFor={(yokai, tier) =>
              inventory.byYokai[yokai].find((n) => n.tier === tier)?.tokenId ??
              null
            }
            onSelectTier={(_tier, tokenId) => goDetail(tokenId)}
          />
        )}
        {screen.name === "detail" &&
          (() => {
            const nft = inventory.nfts.find(
              (n) => n.tokenId === screen.tokenId
            );
            if (!nft) {
              // Token id no longer in inventory (e.g. _devClear in the
              // background tab) — bail back to overview gracefully.
              return (
                <div className={styles.empty}>
                  This card is no longer in your collection.
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={goOverview}
                  >
                    Back to overview
                  </button>
                </div>
              );
            }
            return (
              <CardDetail nft={nft} detailCardWidth={detailCardWidth} />
            );
          })()}
      </div>
    </div>
  );
}

// ─── Screen 1 sub-component ─────────────────────────────────────────
// Kept in this file (not its own) because it's a thin presentation
// layer over the YokaiOverviewCard grid — splitting would just add
// import overhead without adding clarity.

interface OverviewGridProps {
  inventory: ReturnType<typeof useInventory>;
  cardWidth: number;
  onSelectYokai: (yokai: YokaiName) => void;
}

function OverviewGrid({
  inventory,
  cardWidth,
  onSelectYokai,
}: OverviewGridProps) {
  if (inventory.count === 0) {
    return (
      <div className={styles.empty}>
        No cards yet.
        <div className={styles.emptyHint}>
          Play a game and mint a yokai to start your collection.
        </div>
      </div>
    );
  }

  // 11 yokai in a flex-wrap grid. The previous implementation split
  // the array into "first 10" + "11th singleton" because CSS Grid
  // `1fr 1fr` made the lone Amaterasu shrink to the cell width
  // instead of keeping parity with the rest. Flex-wrap renders each
  // card at its inline width regardless of row position, and the
  // CSS `justify-content: center` on .grid centres the last partial
  // row (the singleton sits exactly under the column gap above it).
  const renderCell = (yokai: YokaiName) => {
    const owned = inventory.byYokai[yokai];
    return (
      <YokaiOverviewCard
        key={yokai}
        yokai={yokai}
        highestTier={inventory.highestTierFor(yokai)}
        ownedCount={owned.length}
        width={cardWidth}
        onTap={() => onSelectYokai(yokai)}
      />
    );
  };

  return <div className={styles.grid}>{YOKAI_ORDER.map(renderCell)}</div>;
}

// Re-export for callers that need the InventoryNFT shape (e.g. dev
// route's force-screen controls that need to construct a screen-state).
export type { InventoryNFT };
