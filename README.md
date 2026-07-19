Kami Merge (神マージ)


A calm, onchain merge puzzle — merge yokai spirits in a moonlit forest and mint the kami you reach as an NFT.



Kami Merge is a Suika-style physics merge puzzle set in Japanese mythology, built as a Farcaster Mini App and playable on two chains: Base and Soneium. Drop and merge yokai spirits to summon gods, then mint the kami you reach as an ERC-721 NFT.

🎮 Play: https://kami-merge.vercel.app


What it is

Kami Merge takes the familiar "drop and merge" puzzle loop and grounds it in a hand-crafted world of yokai (妖怪) and kami (神). You drop spirits into a bowl; when two of the same kind touch, they merge into the next spirit up the chain — from a humble kodama all the way to Amaterasu. The higher you climb, the rarer the kami you can permanently mint onchain.

There are no timers and no pressure — just a quiet, meditative loop in a moonlit forest, with an onchain collection ("the Shrine") to grow at your own pace.

Highlights


Onchain minting on two networks. The kami you reach can be minted as an ERC-721 NFT on Base (8453) or Soneium (1868) — same art, two editions.
Farcaster Mini App. Runs natively inside Farcaster with in-app wallet minting and one-tap share-to-cast, and also as a standalone web app with wallet connect.
The Shrine. A personal, on-chain collection view showing every kami you own across both chains, with locked/unlocked states for the full set.
A leaderboard tracking best scores by player identity.
Royalty-aware NFTs (ERC-2981) with a structured, per-token trait set (yokai, kanji, tier, element, and more).


Tech stack

LayerTechFrontendNext.js, React, TypeScriptPhysics / renderingMatter.js + HTML5 CanvasAudioWeb Audio API (procedural marimba synthesis)Wallet / chainwagmi, viem, RainbowKit, Farcaster Mini App SDKAuthSign-In With Ethereum (SIWE)BackendSupabase (Postgres, Edge Functions)ContractsSolidity, Foundry, OpenZeppelin (ERC-721 + ERC-2981)HostingVercel

Onchain deployments

Both contracts are verified KamiMergeNFT (ERC-721 + ERC-2981) deployments:

ChainChain IDContractBase84530x9EDDC0156c587ace1f1636326FE7378856DeC0C4Soneium18680x9c21C01a52481a68dB6fad5960d5366D0779983a

Architecture

Kami Merge uses a dual-mode design so a single build serves both audiences:


Farcaster context → the Farcaster Mini App SDK provides the player's identity and an in-app wallet; minting targets Base.
Startale / standalone web context → wallet connect via RainbowKit; minting targets Soneium (or the wallet's supported chain).


Scores are submitted to a Supabase Edge Function and verified server-side via a SIWE-issued token. Minting is fully permissionless and on-chain; a confirm-mint Edge Function records each mint (chain-aware) after reading the token id straight from the contract's Minted event, so the database never has to trust client-supplied token data. NFT ownership shown in the Shrine is always read from chain, not from the database.

The kami

Eleven spirits form the merge chain, from common woodland yokai to the sun goddess herself:

kodama → hitodama → tanuki → kappa → kitsune → jōrōgumo → tengu → oni → raijin → ryūjin → amaterasu

Each kami is minted in one of four rarity tiers (common, rare, epic, legendary), determined by the score at which it was reached.

Status

Live and playable on Base and Soneium, with onchain minting working end-to-end on both chains, an on-chain Shrine collection, share-to-cast/tweet, and a leaderboard. Actively maintained by a solo developer.

Roadmap


Expanded Shrine gallery showing all 44 kami × tier combinations with locked/unlocked states
Broader Farcaster distribution and community features
Continued balancing, audio, and visual polish


License

All rights reserved. The source is published for transparency and grant review; please reach out before reusing assets or code.


Built with care by @DjimyNeitron · @kodymeverik on Farcaster.
