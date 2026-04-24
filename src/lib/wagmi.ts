// wagmi / RainbowKit config for Soneium.
//
// Two chains registered:
//   - soneiumMinato (testnet, id 1946)  — default / primary during Phase 3
//   - soneium       (mainnet, id 1868)  — available so wallets that land
//                                          there can prompt to switch back
//
// Wallet list is explicit (two named groups) rather than RainbowKit's
// default "popular" auto-list. This gives a stable, curated set of
// wallets we've actually tested against, and lets us prioritise
// Rabby (great multi-chain UX for Soneium + Base dual support in
// Phase 3C) and Trust (large mobile footprint) without waiting for
// RainbowKit's default ordering to catch up.
//
// The WalletConnect project id comes from `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
// in `.env.local`. Without it, wallets that rely on WC (mobile
// pairings, Rainbow, Trust, Zerion) can't pair — MetaMask Browser and
// Rabby extension still work. A non-empty dev fallback string keeps
// the connector factory from throwing during build/dev.
//
// Keep this config isolated from game logic: it's consumed only by
// `src/components/Web3Provider.tsx`. Adding RPCs, chains, or wallets
// stays a one-file change.

import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  coinbaseWallet,
  metaMaskWallet,
  rabbyWallet,
  rainbowWallet,
  trustWallet,
  walletConnectWallet,
  zerionWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { soneiumMinato, soneium } from "viem/chains";
import { createConfig, http } from "wagmi";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

if (!projectId && typeof window !== "undefined") {
  console.warn(
    "[wagmi] NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set. " +
      "WalletConnect-based wallets (mobile pairings, Rainbow, Trust, Zerion) " +
      "will not function. Get a free project id at https://cloud.reown.com " +
      "and add it to .env.local."
  );
}

const connectors = connectorsForWallets(
  [
    {
      groupName: "Popular",
      wallets: [metaMaskWallet, rabbyWallet, trustWallet, coinbaseWallet],
    },
    {
      groupName: "More",
      wallets: [walletConnectWallet, rainbowWallet, zerionWallet],
    },
  ],
  {
    appName: "Kami Merge",
    // Dev fallback keeps the factory from throwing; real pairing still
    // requires a real project id at runtime.
    projectId: projectId || "kami-merge-dev",
  }
);

export const wagmiConfig = createConfig({
  connectors,
  chains: [soneiumMinato, soneium],
  transports: {
    [soneiumMinato.id]: http("https://rpc.minato.soneium.org"),
    [soneium.id]: http("https://rpc.soneium.org"),
  },
  ssr: true,
});
