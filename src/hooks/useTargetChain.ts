"use client";

// useTargetChain — resolves WHICH chain the player mints on. See the
// "two editions" model in @/config/chains.
//
// Resolution:
//   • Mini-app host (isMiniApp === true) → FORCE Base (8453), unconditionally.
//     Farcaster (Warpcast / the Base app) host wallets cannot execute Soneium
//     (1868) — a mint targeted there fails with "Unsupported chainId 1868".
//     We do NOT trust the wallet's reported chain here: the miniapp connector
//     reports the wagmi config-default (1868) even though the host wallet
//     can't sign it. Startale (Soneium) is NOT a live channel yet, so there
//     is no reliable host discriminator to key on today; when it launches,
//     add its host clientFid to STARTALE_CLIENT_FIDS below and it routes back
//     to Soneium in one line — no logic change. The resolution log emits the
//     live {context, clientFid, targetChainId} so the real Startale clientFid
//     can be read off a device and dropped into that allowlist.
//   • Browser + an explicit switcher choice → that choice.
//   • Browser, wallet on a supported chain (1868 or 8453) → use it
//     (ground truth). Otherwise default Soneium.
//
// The mint flow switchChain()s to the target before minting and, if that's
// rejected, surfaces the external-wallet path rather than dead-ending. The
// compact Soneium⇄Base switcher (browser only) drives `setPreferred`.

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { useMiniAppContext } from "@/hooks/useMiniAppContext";
import {
  BASE_CHAIN_ID,
  SONEIUM_CHAIN_ID,
  isSupportedChainId,
  type SupportedChainId,
} from "@/config/chains";

// Host clientFids that mint on Soneium instead of the mini-app default (Base).
// EMPTY today: the Startale App (our only Soneium mini-app host) is not a live
// distribution channel yet, so we have no confirmed clientFid to key on and do
// NOT fake one. When Startale is tested, read its host clientFid from the
// "[targetChain] resolved" log below and add it here — that single edit routes
// Startale back to Soneium with no other change.
const STARTALE_CLIENT_FIDS: readonly number[] = [];

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
  const { isMiniApp, clientFid } = useMiniAppContext();
  const [preferred, setPreferred] = useState<SupportedChainId | null>(null);

  const targetChainId: SupportedChainId = useMemo(() => {
    // Mini-app host → force Base, unless this host is an allowlisted Soneium
    // host (Startale, once its clientFid is known). We deliberately ignore
    // walletChainId here — the miniapp connector reports 1868 the wallet can't
    // sign. See the header note + STARTALE_CLIENT_FIDS.
    if (isMiniApp) {
      if (clientFid != null && STARTALE_CLIENT_FIDS.includes(clientFid)) {
        return SONEIUM_CHAIN_ID;
      }
      return BASE_CHAIN_ID;
    }
    // Browser: explicit switcher choice, else wallet ground truth, else Soneium.
    if (preferred) return preferred;
    if (isSupportedChainId(walletChainId)) return walletChainId;
    return SONEIUM_CHAIN_ID;
  }, [isMiniApp, clientFid, preferred, walletChainId]);

  // Resolution log — surfaces the live host clientFid so a future Startale
  // session's clientFid can be read off-device and added to STARTALE_CLIENT_FIDS.
  useEffect(() => {
    console.log("[targetChain] resolved", {
      context: isMiniApp ? "mini-app" : "browser",
      clientFid,
      walletChainId,
      preferred,
      targetChainId,
    });
  }, [isMiniApp, clientFid, walletChainId, preferred, targetChainId]);

  return {
    targetChainId,
    walletChainId,
    isMiniApp,
    showSwitcher: !isMiniApp,
    preferred,
    setPreferred,
  };
}
