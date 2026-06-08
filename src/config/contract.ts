// On-chain NFT contract config (Stage 7B).
//
// Canonical source of truth for the deployed address is
// `contracts/deployments/soneium-mainnet.json` (committed). We surface it
// here as a constant so app code never hardcodes it in a component:
//   - `NEXT_PUBLIC_NFT_CONTRACT_ADDRESS` overrides at build time (matches
//     the project's existing NEXT_PUBLIC_* config pattern), and
//   - the deployed mainnet address is the default (it is a *public*
//     address, not a secret — safe to ship as a fallback so the build
//     works without extra env wiring).
//
// If the contract is ever redeployed, update soneium-mainnet.json AND
// either this default or the env var.

import { soneium } from "viem/chains";

/** Soneium mainnet chain id. Mirrors `wagmiConfig` in src/lib/wagmi.ts. */
export const SONEIUM_CHAIN_ID = soneium.id; // 1868

/** KamiMergeNFT, deployed + Blockscout-verified on Soneium mainnet. */
export const NFT_CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS ??
  "0x9c21C01a52481a68dB6fad5960d5366D0779983a") as `0x${string}`;

// Minimal ABI — only the mint path the frontend touches: the `mint`
// function, the `Minted` event (to read tokenId back from the receipt),
// and the two custom errors so viem can decode reverts into readable
// messages (e.g. AlreadyMinted) for the ceremony's error UX.
export const KAMI_NFT_ABI = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [{ name: "typeId", type: "uint8" }],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    type: "event",
    name: "Minted",
    inputs: [
      { name: "to", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "typeId", type: "uint8", indexed: true },
    ],
  },
  {
    type: "error",
    name: "AlreadyMinted",
    inputs: [
      { name: "wallet", type: "address" },
      { name: "typeId", type: "uint8" },
    ],
  },
  {
    type: "error",
    name: "InvalidTypeId",
    inputs: [{ name: "typeId", type: "uint8" }],
  },
] as const;
