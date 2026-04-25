// Thin facade over wagmi's low-level hooks. Game components import from
// here so they don't need to know the exact wagmi shape, and so Phase
// 3B/3C can add/rename fields without touching every call site.
//
// Phase 3B (Supabase leaderboard) will use `address` as the player key.
// Phase 3C (Farcaster MiniApp SDK) may add `fid` alongside `address`.

import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { soneium } from "viem/chains";

export function useWallet() {
  const { address, isConnected, isConnecting } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const isOnSoneium = chainId === soneium.id;

  const switchToSoneium = () => {
    if (chainId !== soneium.id) {
      switchChain({ chainId: soneium.id });
    }
  };

  return {
    address,
    isConnected,
    isConnecting,
    chainId,
    isOnSoneium,
    switchToSoneium,
  };
}
