"use client";

// useInventory — mock NFT-collection state for Stage 3.4 Inventory UI.
//
// Backed by localStorage (key: kami_inventory_mock_v1) so the demo
// page can simulate a real player's collection across reloads without
// any blockchain reads. Replaced in Stage 7 by an on-chain read of
// the player's wallet via wagmi useReadContract — the consumer shape
// of this hook intentionally mirrors what that real read will return,
// so swap is a single-file change.
//
// SSR safety: localStorage probed only inside useEffect on mount,
// nfts state initially empty, isLoading flips false once the read
// completes. Components that depend on data should branch on
// `isLoading` rather than `count === 0` (the latter is also true
// for the legitimate empty-collection state).
//
// Dev-only mutators (_devAddMock, _devAddAll, _devClear) are gated
// on NODE_ENV. Calling them in a production build is a no-op — the
// guard is enforced at the top of each method so accidental wiring
// from a future Inventory route doesn't mutate real player state.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  TIER_ORDER,
  YOKAI_ORDER,
  type Tier,
  type YokaiName,
} from "@/config/yokai";

const STORAGE_KEY = "kami_inventory_mock_v1";
const TOTAL_CARDS = YOKAI_ORDER.length * TIER_ORDER.length; // 11 × 4 = 44

export interface InventoryNFT {
  /** Stable id — token id from chain when real, mock_<yokai>_<tier>_<ts> for mock. */
  tokenId: string;
  yokai: YokaiName;
  tier: Tier;
  /** Unix ms — used to sort by recency and to render "X days ago" in detail. */
  mintedAt: number;
  /** Score snapshot at mint time (replaces real engine score in Stage 7). */
  score: number;
}

export interface UseInventoryReturn {
  /** Sorted newest-first by mintedAt. */
  nfts: InventoryNFT[];
  count: number;
  /** Always 44 (11 yokai × 4 tiers). */
  total: number;
  /** Group lookup — every yokai key present (empty arr if none owned). */
  byYokai: Record<YokaiName, InventoryNFT[]>;
  /** Highest tier the player owns for this yokai, or null. */
  highestTierFor: (yokai: YokaiName) => Tier | null;
  hasYokaiTier: (yokai: YokaiName, tier: Tier) => boolean;
  /** True until the first localStorage read completes. */
  isLoading: boolean;
  /** Dev mock helpers — no-op in production builds. */
  _devAddMock: (yokai: YokaiName, tier: Tier, score?: number) => void;
  _devAddAll: () => void;
  _devClear: () => void;
}

const IS_PROD = process.env.NODE_ENV === "production";

function readStorage(): InventoryNFT[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as InventoryNFT[];
  } catch {
    return [];
  }
}

function writeStorage(nfts: InventoryNFT[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nfts));
  } catch {
    // QuotaExceeded etc — silent fail; in-memory state still serves the UI.
  }
}

function sortNewestFirst(nfts: InventoryNFT[]): InventoryNFT[] {
  return [...nfts].sort((a, b) => b.mintedAt - a.mintedAt);
}

export function useInventory(): UseInventoryReturn {
  const [nfts, setNfts] = useState<InventoryNFT[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Hydrate from localStorage on mount.
  useEffect(() => {
    const loaded = readStorage();
    setNfts(sortNewestFirst(loaded));
    setIsLoading(false);
  }, []);

  const persist = useCallback((next: InventoryNFT[]) => {
    const sorted = sortNewestFirst(next);
    setNfts(sorted);
    writeStorage(sorted);
  }, []);

  // Group-by-yokai lookup, memoised so children that destructure
  // byYokai[yokai] don't trigger render cascades on unrelated state.
  const byYokai = useMemo(() => {
    const result = Object.fromEntries(
      YOKAI_ORDER.map((y) => [y, [] as InventoryNFT[]])
    ) as Record<YokaiName, InventoryNFT[]>;
    for (const nft of nfts) {
      result[nft.yokai].push(nft);
    }
    return result;
  }, [nfts]);

  const highestTierFor = useCallback(
    (yokai: YokaiName): Tier | null => {
      // Iterate TIER_ORDER in reverse so Legendary wins over Epic etc.
      for (let i = TIER_ORDER.length - 1; i >= 0; i--) {
        const t = TIER_ORDER[i];
        if (nfts.some((n) => n.yokai === yokai && n.tier === t)) return t;
      }
      return null;
    },
    [nfts]
  );

  const hasYokaiTier = useCallback(
    (yokai: YokaiName, tier: Tier): boolean =>
      nfts.some((n) => n.yokai === yokai && n.tier === tier),
    [nfts]
  );

  // ─── Dev mock helpers ─────────────────────────────────────────────
  // process.env.NODE_ENV is a build-time constant, so in production
  // the early-return collapses to a dead branch and the rest of the
  // method gets eliminated.

  const _devAddMock = useCallback(
    (yokai: YokaiName, tier: Tier, score?: number) => {
      if (IS_PROD) return;
      const next: InventoryNFT = {
        tokenId: `mock_${yokai}_${tier}_${Date.now()}`,
        yokai,
        tier,
        mintedAt: Date.now(),
        score: score ?? Math.floor(Math.random() * 5000) + 500,
      };
      // Replace any existing entry for the same yokai+tier so adding
      // twice doesn't produce dupes (mock_addAll wouldn't either).
      const filtered = nfts.filter(
        (n) => !(n.yokai === yokai && n.tier === tier)
      );
      persist([...filtered, next]);
    },
    [nfts, persist]
  );

  const _devAddAll = useCallback(() => {
    if (IS_PROD) return;
    const now = Date.now();
    const all: InventoryNFT[] = [];
    YOKAI_ORDER.forEach((yokai, yi) => {
      TIER_ORDER.forEach((tier, ti) => {
        all.push({
          tokenId: `mock_${yokai}_${tier}`,
          // Stagger by minute so the sort is stable + readable.
          mintedAt: now - (yi * TIER_ORDER.length + ti) * 60_000,
          yokai,
          tier,
          // Deterministic-but-believable score curve: yokai chain
          // position + tier rank dominate, with a fixed offset.
          score: 1000 + yi * 500 + ti * 200,
        });
      });
    });
    persist(all);
  }, [persist]);

  const _devClear = useCallback(() => {
    if (IS_PROD) return;
    persist([]);
  }, [persist]);

  return {
    nfts,
    count: nfts.length,
    total: TOTAL_CARDS,
    byYokai,
    highestTierFor,
    hasYokaiTier,
    isLoading,
    _devAddMock,
    _devAddAll,
    _devClear,
  };
}
