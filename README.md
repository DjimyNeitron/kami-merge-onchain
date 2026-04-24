# Kami Merge · 神マージ

A Japanese yokai merge puzzle game built on Soneium, Sony's Ethereum L2.

Combine kodama spirits into kitsune, then into oni, then into Amaterasu
herself — a Suika-style physics puzzle wrapped in shrine aesthetics, with
on-chain leaderboard and dual-mode support (standalone web + Startale
Mini App).

## Features

- **11 yokai tiers** — Kodama → Hitodama → Tanuki → Kappa → Kitsune →
  Jorogumo → Tengu → Oni → Raijin → Ryujin → Amaterasu
- **Physics-based merge gameplay** — Matter.js with tuned collisions,
  bounce and friction for a satisfying stack-and-merge feel
- **Shrine ambiance** — koto pentatonic combo melody that ascends with
  every merge, bonshō temple bell on game over, torii-gate background
- **Soneium-native** — connects on Soneium Minato testnet today (mainnet
  at launch), wagmi + viem + RainbowKit under the hood
- **Dual-mode architecture** — runs as a standalone web app and (planned)
  as a Farcaster Mini App inside the Startale App
- **On-chain leaderboard (planned)** — scores linked to wallet, anti-cheat
  via signed messages
- **DevPanel** — URL-gated `?dev=1` mode with god mode, wallet bypass,
  yokai spawning, and catalogue unlocks for fast iteration

## Tech stack

- Frontend: Next.js 16, TypeScript, React, Tailwind CSS
- Physics: Matter.js
- Audio: Web Audio API + sample playback (koto, bonshō, drop)
- Web3: wagmi 2.x, viem 2.x, RainbowKit 2.x
- Blockchain: Soneium (Ethereum L2 by Sony, OP-Stack)
- Database (planned): Supabase for off-chain leaderboard
- Deployment target: Vercel

## Getting started

### Prerequisites

- Node.js 20 or newer
- A WalletConnect Project ID (free at https://cloud.reown.com)
- Soneium Minato testnet ETH for local wallet testing
  (faucet: https://docs.soneium.org/docs/builders/tools/faucets)

### Install

```bash
git clone https://github.com/DjimyNeitron/kami-merge-onchain.git
cd kami-merge-onchain
npm install
```

### Configure

Copy the env template:

```bash
cp .env.example .env.local
```

Fill `.env.local` with your keys. At minimum
`NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is required for mobile / remote
wallets; MetaMask and Rabby browser extensions still work without it.

### Run

```bash
npm run dev
```

Open http://localhost:3000

For mobile testing on your LAN:

```bash
npm run dev -- -H 0.0.0.0
```

Then visit `http://YOUR_LAN_IP:3000` from your phone on the same Wi-Fi.

## Development

### Dev mode

Append `?dev=1` to the URL to unlock the DevPanel:

- **God mode** — disables game-over detection
- **Skip wallet** — bypasses the wallet-connect splash gate for fast
  iteration on gameplay, audio, and visuals
- **Clear field** — removes every yokai in play
- **Unlock all yokai** — marks all 11 tiers as discovered in the
  Settings catalogue
- **Spawn any yokai** — one button per tier

The dev wallet bypass is gated by `?dev=1` at the hook level, so it
cannot be toggled on a production build even by seeding sessionStorage
manually.

### Project structure

```
src/
├── app/              Next.js App Router entry
├── components/       React components (GameCanvas, SplashScreen, Settings, DevPanel, icons)
├── game/             Matter.js engine, audio system, particle effects, yokai config
├── hooks/            useDevMode, useDevSkipWallet
├── lib/              wagmi config, (planned) supabase client
public/
├── yokai/            11 yokai sprites (PNG, 512x512)
├── sfx/              Audio samples (koto A4, bonshō, celtic harp drop)
└── bg_game.jpg       Shrine-gate background
```

### Build

```bash
npm run build     # Production build
npm run start     # Serve the production build
```

## Roadmap

- [x] Core gameplay (Matter.js, 11 yokai, tuned physics)
- [x] Audio system (pentatonic koto combo, water-drop SFX, bonshō GO)
- [x] Shrine UI polish, Settings, yokai catalogue, DevPanel
- [x] Wallet connect (wagmi + RainbowKit, Soneium Minato + mainnet)
- [x] Wallet-required splash flow with English-only RainbowKit modal
- [x] Dev wallet-bypass toggle
- [ ] Supabase leaderboard with signed-message submission
- [ ] Farcaster Mini App integration for Startale App
- [ ] Production deploy to Vercel + mainnet switch
- [ ] Submit to the Startale App directory

## Security

A living security checklist lives in `docs/SECURITY_AUDIT.md` (planned).
Developer wallet hygiene notes are in `docs/DEV_WALLET_SECURITY.md`
(planned).

Never connect a wallet holding real assets to a development environment.
Use a fresh dev-only wallet funded exclusively with testnet ETH for
local work.

## License

MIT — see [LICENSE](LICENSE).

## Credits

Developed by [DjimyNeitron](https://github.com/DjimyNeitron).
Art direction: Japanese yokai mythology × modern painterly aesthetic.
Audio: traditional Japanese instrument samples sourced under permissive
licences (see individual file metadata).
