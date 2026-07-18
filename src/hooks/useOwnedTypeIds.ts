"use client";

// useOwnedTypeIds — reads on-chain ownership of all 44 KamiMergeNFT typeIds
// (0..43) for a wallet across BOTH editions (Soneium 1868 + Base 8453) via a
// wagmi multicall per chain. Ownership is the contract's
// `minted(address, uint8) → bool` mapping (D2: one mint per wallet per
// typeId). Each read is forced onto its chain's client so it resolves
// regardless of the wallet's current chain.
//
// The two chains are read as two independent multicalls so the Shrine can
// render progressively — a slow RPC on one chain doesn't block the other. A
// typeId counts as collected if owned on EITHER chain; `chainsFor(typeId)`
// says which.

import { useMemo } from "react";
import { useReadContracts } from "wagmi";
import {
  BASE_CHAIN_ID,
  SONEIUM_CHAIN_ID,
  contractFor,
  type SupportedChainId,
} from "@/config/chains";

// minted(address, uint8) -> bool  — the public auto-getter on
// KamiMergeNFT.sol's `mapping(address => mapping(uint8 => bool)) minted`.
const MINTED_ABI = [
  {
    type: "function",
    name: "minted",
    stateMutability: "view",
    inputs: [
      { name: "", type: "address" },
      { name: "", type: "uint8" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const TYPE_ID_COUNT = 44; // 11 yokai × 4 tiers

function useChainOwnership(
  address: `0x${string}` | undefined,
  chainId: SupportedChainId,
) {
  const contracts = useMemo(
    () =>
      address
        ? Array.from({ length: TYPE_ID_COUNT }, (_, t) => ({
            address: contractFor(chainId),
            abi: MINTED_ABI,
            functionName: "minted" as const,
            args: [address, t] as const, // t = typeId 0..43 (uint8)
            chainId,
          }))
        : [],
    [address, chainId],
  );

  const { data, isLoading, isError, refetch } = useReadContracts({
    contracts,
    allowFailure: true,
    query: { enabled: !!address },
  });

  const owned = useMemo(() => {
    const s = new Set<number>();
    data?.forEach((r, t) => {
      if (r.status === "success" && r.result === true) s.add(t);
    });
    return s;
  }, [data]);

  return { owned, isLoading: !!address && isLoading, isError, refetch };
}

export function useOwnedTypeIds(address?: `0x${string}`) {
  const soneium = useChainOwnership(address, SONEIUM_CHAIN_ID);
  const base = useChainOwnership(address, BASE_CHAIN_ID);

  // Union — a kami owned on either chain is "collected".
  const ownedTypeIds = useMemo(() => {
    const s = new Set<number>(soneium.owned);
    base.owned.forEach((t) => s.add(t));
    return s;
  }, [soneium.owned, base.owned]);

  // Which chain(s) hold a given typeId — drives the Shrine chain badge.
  const chainsFor = useMemo(
    () =>
      (typeId: number): SupportedChainId[] => {
        const chains: SupportedChainId[] = [];
        if (soneium.owned.has(typeId)) chains.push(SONEIUM_CHAIN_ID);
        if (base.owned.has(typeId)) chains.push(BASE_CHAIN_ID);
        return chains;
      },
    [soneium.owned, base.owned],
  );

  const refetch = () => {
    soneium.refetch();
    base.refetch();
  };

  return {
    ownedTypeIds,
    ownedCount: ownedTypeIds.size,
    chainsFor,
    // "loading" until BOTH chains resolve, but ownedTypeIds grows as each
    // lands so consumers render progressively.
    isLoading: soneium.isLoading || base.isLoading,
    isError: soneium.isError && base.isError,
    refetch,
    hasAddress: !!address,
  };
}
