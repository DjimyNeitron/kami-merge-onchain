// wagmi / RainbowKit config for Soneium.
//
// Two chains registered:
//   - soneiumMinato (testnet, id 1946)  — default / primary during Phase 3
//   - soneium       (mainnet, id 1868)  — available so wallets that land
//                                          there can prompt to switch back
//
// The WalletConnect project id comes from `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
// in `.env.local`. Without it, wallets that rely on WC (mobile, Rainbow,
// Trust) can't pair — MetaMask Browser and Rabby extension still work.
//
// Keep this config isolated from game logic: it's consumed only by
// `src/components/Web3Provider.tsx`. Adding RPCs or chains stays a
// one-file change.

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { soneiumMinato, soneium } from "viem/chains";
import { http } from "wagmi";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

if (!projectId && typeof window !== "undefined") {
  console.warn(
    "[wagmi] NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set. " +
      "WalletConnect-based wallets (mobile pairings, Rainbow, Trust) " +
      "will not function. Get a free project id at https://cloud.reown.com " +
      "and add it to .env.local."
  );
}

export const wagmiConfig = getDefaultConfig({
  appName: "Kami Merge",
  // A non-empty fallback keeps getDefaultConfig from throwing during
  // build/dev. Real pairing still requires a real project id at runtime.
  projectId: projectId || "kami-merge-dev",
  chains: [soneiumMinato, soneium],
  transports: {
    [soneiumMinato.id]: http("https://rpc.minato.soneium.org"),
    [soneium.id]: http("https://rpc.soneium.org"),
  },
  ssr: true,
});
