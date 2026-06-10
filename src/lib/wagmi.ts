// wagmi / RainbowKit config for Soneium.
//
// One chain registered:
//   - soneium (mainnet, id 1868) — required chain for the MVP.
//
// We dropped Soneium Minato (testnet, id 1946) when we discovered the
// Farcaster preview wallet (Warpcast / Startale-App) does not support
// it ("RpcResponse.InternalError: Unsupported chainId 1946"). Mainnet
// is supported by every Farcaster-compatible wallet, so the Mini App
// path works out of the box. A small dev wallet funded with mainnet
// ETH covers our smoke-test needs.
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
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { soneium } from "viem/chains";
import { createConfig, http } from "wagmi";
import { walletConnect } from "wagmi/connectors";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

if (!projectId && typeof window !== "undefined") {
  console.warn(
    "[wagmi] NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set. " +
      "WalletConnect-based wallets (mobile pairings, Rainbow, Trust, Zerion) " +
      "will not function. Get a free project id at https://cloud.reown.com " +
      "and add it to .env.local."
  );
}

// RainbowKit-backed wallets for the standalone web flow. The modal
// renders these in two named groups; the Farcaster Mini App connector
// (added below) is intentionally NOT in this list — it's only ever
// invoked via explicit `connect({ connector: ... })` from
// useMiniAppContext when the host environment is detected.
const rainbowKitConnectors = connectorsForWallets(
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

// Standalone WalletConnect connector (id "walletConnect"), separate from
// RainbowKit's wallet-wrapped WC. Placed 2nd so a direct
// `connect({ connector })` resolves to THIS one (find-by-id returns the
// earliest match). It is the mint escape hatch INSIDE Farcaster: the
// built-in Farcaster Wallet can't do Soneium (chainId 1868), so when the
// chain switch fails the ceremony routes the mint tx through an external
// Soneium-capable wallet via this connector. `showQrModal: true` so the
// pairing QR / mobile deep-link surfaces on direct connect (RainbowKit's
// own WC connector suppresses its modal in favour of the RainbowKit UI,
// which isn't shown inside a Farcaster host).
export const walletConnectConnectorId = "walletConnect";

// Order matters for wagmi's auto-connect heuristic: the Farcaster Mini
// App connector goes first so when we're inside a Farcaster / Startale
// host, wagmi prefers it over any cached injected connector. In the
// standalone browser path the connector simply fails to find a host
// and stays dormant — RainbowKit handles the rest.
export const wagmiConfig = createConfig({
  connectors: [
    farcasterMiniApp(),
    walletConnect({
      projectId: projectId || "kami-merge-dev",
      showQrModal: true,
    }),
    ...rainbowKitConnectors,
  ],
  chains: [soneium],
  transports: {
    [soneium.id]: http("https://rpc.soneium.org"),
  },
  ssr: true,
});
