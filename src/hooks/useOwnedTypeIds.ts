"use client";

// useOwnedTypeIds — reads on-chain ownership of all 44 KamiMergeNFT
// typeIds (0..43) for a wallet via a single wagmi multicall against
// Soneium mainnet. Ownership is the contract's `minted(address, uint8)
// → bool` mapping (D2: one mint per wallet per typeId). The read is
// forced onto the Soneium client (chainId) so it works even when the
// connected wallet is on the wrong chain — no chain guard.

import { useMemo } from "react";
import { useReadContracts } from "wagmi";
import { NFT_CONTRACT_ADDRESS, SONEIUM_CHAIN_ID } from "@/config/contract";

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

export function useOwnedTypeIds(address?: `0x${string}`) {
  const contracts = useMemo(
    () =>
      address
        ? Array.from({ length: TYPE_ID_COUNT }, (_, t) => ({
            address: NFT_CONTRACT_ADDRESS,
            abi: MINTED_ABI,
            functionName: "minted" as const,
            args: [address, t] as const, // t = typeId 0..43 (uint8)
            // Force the Soneium client; the read must run regardless of
            // the wallet's current chain.
            chainId: SONEIUM_CHAIN_ID,
          }))
        : [],
    [address],
  );

  const { data, isLoading, isError, error, refetch } = useReadContracts({
    contracts,
    allowFailure: true,
    query: { enabled: !!address },
  });

  const ownedTypeIds = useMemo(() => {
    const s = new Set<number>();
    data?.forEach((r, t) => {
      if (r.status === "success" && r.result === true) s.add(t);
    });
    return s;
  }, [data]);

  return {
    ownedTypeIds,
    ownedCount: ownedTypeIds.size,
    isLoading: !!address && isLoading,
    isError,
    error,
    refetch,
    hasAddress: !!address,
  };
}
