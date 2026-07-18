"use client";

// useTargetChain — resolves WHICH chain the player mints on, from the
// ground-truth chain the wallet actually connected on (not a guessed host
// clientFid). See the "two editions" model in @/config/chains.
//
// Resolution:
//   • Browser + an explicit switcher choice → that choice.
//   • Wallet connected on a supported chain (1868 or 8453) → use it. This
//     covers Startale (host wallet on Soneium) and Farcaster (host wallet on
//     Base) with no host-type detection.
//   • Fallback (wallet on an unsupported/undefined chain): a Farcaster
//     mini-app host can't provide Soneium, so default Base there; Soneium
//     otherwise (browser / Startale). The mint flow then switchChain()s to
//     the target before minting and, if that's rejected, surfaces the
//     switcher rather than dead-ending.
//
// The compact Soneium⇄Base switcher (browser only) drives `setPreferred`.

import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { useMiniAppContext } from "@/hooks/useMiniAppContext";
import {
  BASE_CHAIN_ID,
  SONEIUM_CHAIN_ID,
  isSupportedChainId,
  type SupportedChainId,
} from "@/config/chains";

export type UseTargetChain = {
  /** The chain the mint + ownership read target. */
  targetChainId: SupportedChainId;
  /** The wallet's actual connected chain (may be unsupported/undefined). */
  walletChainId: number | undefined;
  isMiniApp: boolean;
  /** Show the Soneium⇄Base switcher (browser only; hosts force their chain). */
  showSwitcher: boolean;
  /** Browser-only manual override; null = follow wallet/default. */
  preferred: SupportedChainId | null;
  setPreferred: (id: SupportedChainId | null) => void;
};

export function useTargetChain(): UseTargetChain {
  const { chainId: walletChainId } = useAccount();
  const { isMiniApp } = useMiniAppContext();
  const [preferred, setPreferred] = useState<SupportedChainId | null>(null);

  const targetChainId: SupportedChainId = useMemo(() => {
    if (!isMiniApp && preferred) return preferred;
    if (isSupportedChainId(walletChainId)) return walletChainId;
    return isMiniApp ? BASE_CHAIN_ID : SONEIUM_CHAIN_ID;
  }, [isMiniApp, preferred, walletChainId]);

  return {
    targetChainId,
    walletChainId,
    isMiniApp,
    showSwitcher: !isMiniApp,
    preferred,
    setPreferred,
  };
}
