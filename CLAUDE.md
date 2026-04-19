# CLAUDE.md — Kami Merge (神マージ)

## Project Overview

Kami Merge is a Suika Game-style physics merge puzzle with Japanese yokai theme, built as a Startale Mini App on Soneium (Ethereum L2 by Sony).

**Core mechanic:** Player drops round yokai balls into a container. Two identical yokai collide → merge into the next tier. 11 levels from tiny Kodama to legendary Amaterasu. Physics-based (balls roll, bounce, stack). Game over when yokai overflow the container.

**Reference game:** Suika Game (suikagame.com) — 11M+ downloads, #1 Japan for 2 years.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | Next.js + TypeScript + Tailwind CSS |
| Physics | Matter.js |
| NFT (Phase 3) | thirdweb SDK, ERC-721 on Soneium |
| Blockchain | Soneium (OP Stack, EVM compatible) |
| Payments (future) | USDSC (Startale stablecoin) |
| Art (Phase 2) | Midjourney — yokai ball sprites |
| Deploy | Vercel (frontend) + Soneium mainnet (contracts) |

## Project Structure

```
kami-merge/
├── CLAUDE.md
├── src/
│   ├── game/              # Matter.js engine, merge logic, game loop
│   │   └── engine.ts      # Core game engine class
│   ├── components/        # React UI components
│   │   └── GameCanvas.tsx  # Main game component
│   ├── assets/            # Yokai sprites (Phase 2), sounds
│   ├── blockchain/        # thirdweb integration (Phase 3)
│   ├── config/            # Yokai data, sizes, merge chain, constants
│   │   ├── yokai.ts       # 11-level merge chain definition
│   │   └── constants.ts   # Game dimensions, physics params
│   └── utils/             # Helpers
├── app/
│   ├── page.tsx           # Main game page
│   ├── layout.tsx         # Root layout
│   └── globals.css        # Global styles
├── public/
├── contracts/             # Smart contracts (Phase 3)
└── docs/
```

## Merge Chain (11 Yokai)

| # | Name | Kanji | Radius (px) | Color | Score |
|---|------|-------|-------------|-------|-------|
| 1 | Kodama | 木霊 | 17 | #7ec87e (green) | 1 |
| 2 | Hitodama | 人魂 | 24 | #7ecae8 (blue) | 3 |
| 3 | Tanuki | 狸 | 32 | #c49a6c (brown) | 6 |
| 4 | Kappa | 河童 | 38 | #3a9e6e (dark green) | 10 |
| 5 | Kitsune | 狐 | 48 | #f0a030 (orange/gold) | 15 |
| 6 | Jorogumo | 絡新婦 | 56 | #9b59b6 (purple) | 21 |
| 7 | Tengu | 天狗 | 66 | #e74c3c (red) | 28 |
| 8 | Oni | 鬼 | 76 | #8b1a1a (dark red) | 36 |
| 9 | Raijin | 雷神 | 88 | #f1c40f (gold) | 45 |
| 10 | Ryujin | 龍神 | 102 | #5b8dcc (blue/silver) | 55 |
| 11 | Amaterasu | 天照 | 120 | #ffefd5 (white/gold) | 66 |

Only yokai 1-5 (Kodama through Kitsune) can spawn randomly. Larger yokai are created only through merging.

## Game Rules & Physics

### Container
- Game area: 390×600px (mobile-first, ~9:16 aspect)
- Walls: bottom, left, right (20px thick)
- Drop zone: above y=100 line
- Game over line: y=110

### Physics Parameters (tune through playtesting)
- Gravity: 1.5 (Matter.js scale 0.001)
- Bounce (restitution): 0.3
- Friction: 0.5
- Air friction: 0.01

### Gameplay
- Player moves cursor/finger horizontally to aim
- Click/tap to drop the current yokai
- 500ms cooldown between drops
- Show "next yokai" preview
- Two identical yokai collide → both removed → next-tier spawns at collision midpoint
- Amaterasu (tier 11) cannot merge further
- Game over: any yokai stays above the line for 3+ seconds

### Scoring
- Each merge awards the score value of the NEW yokai created
- High score persisted in localStorage

## Controls
- **Desktop:** mouse X for position, click to drop
- **Mobile:** touch X for position, release to drop
- Show vertical guide line / ghost preview where yokai will fall

## Current Phase: 0-1 (Playable Prototype)

Build a fully playable prototype with placeholder graphics (colored circles with kanji labels):

1. Matter.js world with container walls and gravity
2. Click/tap to drop random yokai (from tier 1-5)
3. Merge logic: same yokai collide → spawn next tier at midpoint
4. Score system with high score (localStorage)
5. Game over detection (3-sec grace above line)
6. Next yokai preview
7. Desktop + mobile touch controls
8. Basic UI: score display, next preview, restart button
9. Drop cooldown (500ms)
10. Vertical guide line showing where yokai will land

### Placeholder Graphics
Colored circles with yokai name/kanji drawn as text on them. No image sprites yet — those come in Phase 2.

## Visual Style

- Background: dark indigo (#1a1a2e)
- Walls: darker purple (#2d2d5e)
- Game over line: dashed red line at y=110
- UI: clean, minimal, Japanese typography feel
- Font for kanji on balls: system sans-serif is fine for now

## Implementation Notes

- Tag Matter.js bodies: `(body as any).yokaiId = number` for yokai tier
- Prevent double-merge: track body IDs currently being merged in a Set
- Merge pop: give new yokai small upward velocity (y: -2) for satisfying feel
- Rendering: use Matter.js Render for initial setup. If custom drawing is needed (kanji on circles), use `Events.on(render, 'afterRender', ...)` to draw on top of the canvas
- Must work in mobile WebView (Startale Mini App target) — no desktop-only APIs
- Use `'use client'` directive on React components that use Matter.js (it's browser-only)

## Commands

```bash
npm run dev     # Dev server (localhost:3000)
npm run build   # Production build
npm run start   # Production server
```

## What NOT to Build Yet

- No image sprites (Phase 2)
- No sound (Phase 2)
- No blockchain/wallet/NFT (Phase 3)
- No Startale SDK integration (Phase 4)
- No analytics, share button, daily challenges (Phase 4)
