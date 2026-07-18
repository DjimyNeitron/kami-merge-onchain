// Multichain registry — the single source of truth for which KamiMergeNFT
// contract lives on which chain. "Two editions" of the same collection
// (identical art/metadata), one per chain: Soneium (1868) and Base (8453).
// Every mint / ownership / Shrine call reads its contract + chain metadata
// from here by chainId — no hardcoded single address anywhere else.
//
// Both addresses are PUBLIC (verified on-chain), safe to ship in the bundle.

export const SONEIUM_CHAIN_ID = 1868 as const;
export const BASE_CHAIN_ID = 8453 as const;

export type SupportedChainId =
  | typeof SONEIUM_CHAIN_ID
  | typeof BASE_CHAIN_ID;

export type ChainEntry = {
  chainId: SupportedChainId;
  /** Deployed + verified KamiMergeNFT on this chain. */
  contract: `0x${string}`;
  /** Display name — mint button ("Bind on Base") + Shrine chain badge. */
  name: string;
  /** Block-explorer base (no trailing slash) for token links. */
  explorerBase: string;
};

export const CHAINS: Record<SupportedChainId, ChainEntry> = {
  [SONEIUM_CHAIN_ID]: {
    chainId: SONEIUM_CHAIN_ID,
    contract: "0x9c21C01a52481a68dB6fad5960d5366D0779983a",
    name: "Soneium",
    explorerBase: "https://soneium.blockscout.com",
  },
  [BASE_CHAIN_ID]: {
    chainId: BASE_CHAIN_ID,
    contract: "0x9EDDC0156c587ace1f1636326FE7378856DeC0C4",
    name: "Base",
    explorerBase: "https://basescan.org",
  },
};

/** Chains we mint on, in switcher/display order. */
export const SUPPORTED_CHAIN_IDS: SupportedChainId[] = [
  SONEIUM_CHAIN_ID,
  BASE_CHAIN_ID,
];

export function isSupportedChainId(
  id: number | undefined | null,
): id is SupportedChainId {
  return id === SONEIUM_CHAIN_ID || id === BASE_CHAIN_ID;
}

export function chainEntry(id: SupportedChainId): ChainEntry {
  return CHAINS[id];
}

/** The KamiMergeNFT address for a given chain. */
export function contractFor(id: SupportedChainId): `0x${string}` {
  return CHAINS[id].contract;
}

/** Human display name for a chain ("Soneium" / "Base"). */
export function chainName(id: SupportedChainId): string {
  return CHAINS[id].name;
}
