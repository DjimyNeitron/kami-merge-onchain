# Kami Merge — Codebase Audit

**Date:** 2026-05-28
**Branch:** `main`
**HEAD:** `0ecd865` — `fix(stage-3.5k): remove redundant score badge + ghost button single-line copy`
**Supersedes:** previous CODEBASE_AUDIT.md dated 2026-05-17 (pre-Stage 3.5).

---

## Quick reference

Kami Merge is a Suika-style yokai merge puzzle shipped as a Soneium-L2 Mini App (Next.js 16 + React 19 + TypeScript + Tailwind v4 + Matter.js + wagmi v2). Stage 3.5 (mint ceremony) is merged — 11 PRs landed (`#35 → #43`), with **PR #44 (3.5L wire-up) open, mergeable, awaiting merge**. The ceremony itself is feature-complete; #44 attaches it to the real game-over so a score ≥ 500 in production now triggers it. Engine, NFTCard, and the tier-roll matrix are the project's three locked surfaces — everyone else builds around them via callbacks / wrappers.

---

## Project structure

```
kami-merge/
├── app/                                Next.js App Router routes
│   ├── layout.tsx       (130 ll)       Root layout — fc:miniapp meta, OG, splash
│   ├── page.tsx         ( 62 ll)       Main game shell — atmospheric lantern/firefly glows + <GameCanvasLoader>
│   ├── globals.css      (414 ll)       Design tokens, wood-btn, scroll-panel, animations
│   └── dev/                            Dev-only routes (production-gated via notFound())
│       ├── layout.tsx              SEGMENT_OVERRIDE — undoes game route's body lock for scrollable dev pages
│       ├── mint-ceremony/          /dev/mint-ceremony — ceremony preview + force controls
│       ├── inventory/              /dev/inventory — inventory grid preview
│       └── nft-cards/              /dev/nft-cards — single-card playground
│
├── src/
│   ├── components/
│   │   ├── GameCanvas.tsx           (765 ll)   Main game shell — wraps engine, renders UI overlay
│   │   ├── GameCanvasLoader.tsx     ( 37 ll)   Dynamic-import gate (Matter.js is browser-only)
│   │   ├── MintCeremony.tsx         (488 ll)   Stage 3.5 final — 8-phase reveal overlay
│   │   ├── MintCeremony.module.css  (650 ll)   Scoped CSS for the ceremony
│   │   ├── NFTCard.tsx              (347 ll)   ★ LOCKED — asset-first card with holo + 3D tilt
│   │   ├── NFTCard.module.css       (314 ll)   ★ LOCKED — holo + tier vars
│   │   ├── Inventory.tsx            (289 ll)   /dev/inventory grid + detail (mock NFTs)
│   │   ├── Inventory.module.css     (486 ll)
│   │   ├── CardDetail.tsx           (177 ll)   Inventory detail screen
│   │   ├── SplashScreen.tsx         (583 ll)   Splash + wallet gate + Mini-App detect
│   │   ├── Settings.tsx             (456 ll)   Sound/Music toggles + audio prefs
│   │   ├── SeasonBadge.tsx          ( 43 ll)   (currently disabled — see app/page.tsx)
│   │   ├── SeasonTint.tsx           ( 37 ll)   (currently disabled)
│   │   ├── YokaiDetail.tsx          (109 ll)   Lore detail
│   │   ├── YokaiDetailCard.tsx      (245 ll)
│   │   ├── YokaiOverviewCard.tsx    (120 ll)
│   │   ├── FarcasterUserBadge.tsx   (179 ll)
│   │   ├── DebugConsole.tsx         ( 58 ll)   Eruda gate (?debug=1)
│   │   ├── Web3Provider.tsx         ( 68 ll)   wagmi + RainbowKit shell
│   │   ├── dev/DevPanel.tsx         (146 ll)   Dev controls panel
│   │   └── icons/                              SuzuIcon, MonIcon, FurinIcon, TaikoIcon
│   │
│   ├── game/
│   │   ├── engine.ts                (999 ll)   ★ LOCKED — Matter.js physics + merge logic + game-over
│   │   ├── audio.ts                 (806 ll)   AudioManager — marimba samples + bowl synthesis + reverb
│   │   ├── particles.ts             (384 ll)   Particle/firefly spawner used by engine VFX layer
│   │   ├── seasons.ts               ( 89 ll)   Season cycle (currently no-op'd via app/page.tsx)
│   │   └── bgmTracks.ts             ( 95 ll)   BGM track registry + localStorage persistence
│   │
│   ├── lib/
│   │   ├── ceremonySound.ts         (103 ll)   playTick / playChime / playMintSuccess (bowls)
│   │   ├── tierFromScore.ts         ( 77 ll)   ★ LOCKED — Brief v13 drop matrix
│   │   └── wagmi.ts                 ( 91 ll)   wagmi config (Soneium + Farcaster connector)
│   │
│   ├── config/
│   │   ├── yokai.ts                 (296 ll)   ★ LOCKED — YOKAI_CHAIN + KANJI + lore + tier types
│   │   └── constants.ts             ( 34 ll)   GAME_WIDTH/HEIGHT, GAME_OVER_LINE_Y, physics
│   │
│   ├── hooks/
│   │   ├── useInventory.ts          (202 ll)   localStorage-backed mock inventory + _devAddMock
│   │   ├── useMiniAppContext.ts     (184 ll)   Mini-App detect + sdk.actions.ready()
│   │   ├── useActualChainId.ts      (211 ll)   EIP-1193 chain read (bypasses wagmi's default-fallback)
│   │   ├── useDevMode.ts            ( 41 ll)   ?dev=1 gate
│   │   ├── useDevSkipWallet.ts      (126 ll)   Dev wallet bypass
│   │   └── useWallet.ts             ( 32 ll)   Thin wagmi wrapper
│   │
│   └── types/
│       └── supabase.ts              (317 ll)   Generated types (Phase-future, unused by gameplay)
│
├── public/                          See "Asset inventory" below
├── docs/design/                     Design notes (auxiliary)
├── contracts/                       (empty; Phase 7 chain work)
├── supabase/                        (unused by gameplay)
├── CLAUDE.md                        Project handoff notes
├── CODEBASE_AUDIT.md                This file
├── DESIGN_SYSTEM.md                 ⚠️ NOT YET CREATED — flagged in prompt; tokens inlined below
└── package.json / tsconfig.json / next.config.ts
```

**Total source LoC (`src/` + `app/`):** ~11,822.

---

## Critical components

### `src/components/MintCeremony.tsx` (488 ll, Stage 3.5 final)
- **Purpose:** ceremony overlay shown on a successful run (score ≥ 500). 8-phase state machine.
- **Props:** `yokai: YokaiName`, `tier: Tier`, `score: number`, `cardWidth?: number` (default 200), `soundEnabled?: boolean`, `onMintComplete?: (nft) => void`, `onClose?: () => void`, `onPhaseChange?: (phase) => void`.
- **Phases:** `intro → spinning → card-materializing → aurora-rising → tier-banner → mint-ready → minting → success`.
- **Audio:** calls `playTick` / `playChime(tier)` / `playMintSuccess` from `src/lib/ceremonySound.ts` (singing-bowl synthesis).
- **Mock mint:** "Bind the Spirit" calls `useInventory()._devAddMock(yokai, tier, score)` after a 2 s mock delay; writes to `kami_inventory_mock_v1` localStorage.
- **Visual layers:** background image (`/ceremony_bg.jpg`), vignette overlay, card silhouette with cycling tier kanji, revealed `<NFTCard>`, sakura petal system (state-driven, self-cleaning via `onAnimationEnd`, continuous spawn every 450 ms, cap 25), 8 fireflies, anticipation subtitle, tier banner, ghost button on success, golden flash + 12 burst sparkles + 4 drifting sparkles + breathing aura + parchment "完 BLESSING RECEIVED" banner.
- **Caps held under:** TSX 488 (<500), CSS 650 (<700).
- See `MintCeremony.module.css` for keyframes (petal-fall linear, petal-drift, petal-wobble using the CSS `rotate` property, success-aura-breathe, drift-sparkle, success-flash, sparkle-burst, fade-in-soft, etc.).

### `src/components/GameCanvas.tsx` (765 ll on main)
- **Purpose:** main game shell — wraps `GameEngine`, renders score / next / sound + settings buttons / wallet gate / game-over panel.
- **State:** `score`, `highScore`, `current`/`next` yokai, `gameOver`, `finalScore`, `reached: number[]`, `unlockedIds`, `sfxEnabled`, `bgmEnabled`, `currentTrack`, `showSplash`, `showSettings`, `godMode`.
- **Engine callbacks:** `onScoreChange`, `onNextChange`, `onGameOver`, `onReachedChange`, `onUnlockChange`. The callbacks are captured inside the engine-init `useEffect` at mount, so closures see initial state only — **the stale-closure pitfall** (see "State management").
- **Game-over panel (on main):** conditional wood-scroll overlay (`zIndex: 20`) — "GAME OVER / 終 / Final Score / Best / Restart" — currently shown to **all** game-overs regardless of score. PR #44 splits this into ceremony-vs-Restart by score threshold.
- **No CSS module on main yet.** Styled almost entirely via Tailwind utility classes; PR #44 adds `GameCanvas.module.css` for the ceremony overlay container, dismiss button, and motivational message.

### `src/game/engine.ts` (999 ll) ★ LOCKED
- Matter.js physics; world, walls, bodies, collision handler.
- Yokai spawn (`SPAWNABLE_IDS = [1, 2, 3, 4, 5]`), drop with 500 ms cooldown, merge detection (same id → spawn next tier at midpoint with small upward velocity).
- **Score:** `private score = 0`. Only mutator is line 507:
  ```ts
  this.score += Math.round(next.score * mult);
  ```
  …where `mult` comes from `comboMultiplier()` (line 443): `comboCount ≥ 3 → 2.0`, `=== 2 → 1.5`, else `1.0`. Combo window 1500 ms.
- **Game-over (lines 525-561):** any yokai with `topY < GAME_OVER_LINE_Y (=120)` and `speed < 0.6` for `GAME_OVER_GRACE_MS = 500` ms triggers `triggerGameOver()` → `onGameOver(this.score)`.
- **Callbacks** (`EngineCallbacks` type, lines 49-55): `onScoreChange`, `onNextChange`, `onGameOver`, `onReachedChange`, `onUnlockChange`. Read-only consumption from React — do **not** modify the engine directly.
- **Reached tracking:** `private reached = new Set<number>()` of tier ids; emitted via `onReachedChange`.
- **`godMode` dev bypass** — skips the game-over check entirely (see DevPanel).

### `src/game/audio.ts` (806 ll)
- `class AudioManager` with one private `AudioContext` + private `sfxGain` bus.
- **Sample pipeline (in-game):** `playMergeWithCombo()` indexes into `mergeBuffers[]` (the five pre-tuned marimba samples `merge_1.mp3 … merge_5.mp3`, C5 D5 E5 G5 A5) and creates a bare `BufferSource` — direct path, dry, no reverb.
- **Sample pipeline (ceremony — backward-compat only):** `playSampleAt(index, { volume, pitch, attack, release, useReverb, reverbWet })` lets non-game surfaces play the same buffers with optional envelope + reverb. Defaults preserve original behaviour. Currently **unused on `main`** (ceremony switched to bowl synthesis in 3.5h) but kept intact per spec.
- **Synthesis pipeline (ceremony — primary):** `playBowlTone({ frequency, duration, volume, attack, useReverb, reverbWet })` — sine fundamental + two inharmonic overtones (×2.76 and ×5.4, the signature of a struck metal bowl) routed through a lowpass at `frequency × 5`, gated by a slow attack + exponential decay master gain. Optional wet/dry split through `getCeremonyReverb()`, a lazily-built `ConvolverNode` with a 2.5 s decaying-noise impulse (synthetic, no asset).
- **Mute semantics:** `setSoundEnabled(false)` flips `sfxGain` to 0 (cuts tails in flight); BGM is a separate `HTMLAudioElement` with independent mute via `setMusicEnabled`.
- **iOS unlock:** `unlock()` must be called inside a user-gesture handler (touchstart/click) before any audio plays.

### `src/lib/ceremonySound.ts` (103 ll)
- Thin wrapper around `audioManager.playBowlTone`:
  - **`playTick()`** — A3, duration 1.5 s, volume 0.035, attack 0.05 s.
  - **`playChime(tier)`** — ascending pentatonic sequence (`A3,D4` → `G3,A3,B3,D4` → `E3,G3,A3,B3,D4`), 380 ms cadence, **3.5 s ring, 35 % wet**, attack 0.3 s.
  - **`playMintSuccess()`** — overlapping `MINT_CHORD` (E3 @ 0 ms, G3 @ 80, B3 @ 160, D4 @ 320), **7 s ring, 60 % wet**, attacks 0.5–0.7 s.
- Engine merge SFX use the separate `playMergeWithCombo` path → unaffected by any ceremony tuning.

### `src/lib/tierFromScore.ts` (77 ll) ★ LOCKED
- **`MIN_MINT_SCORE = 500`** — confirmed via a separate score-floor analysis (zero-merge troll game-over scores 0; bad-player runs land 50-300; 500 cleanly separates "engaged" from "didn't try").
- **Brief v13 drop matrix:**

  | Score bracket | common | rare | epic | legendary |
  |---|---|---|---|---|
  | 500-1499 | 50 % | 37 % | 11 % | 2 % |
  | 1500-2999 | 22 % | 48 % | 25 % | 5 % |
  | 3000-4999 | 5 % | 25 % | 50 % | 20 % |
  | 5000+ | 1 % | 9 % | 35 % | 55 % |

- **`tierFromScore(score, seed?)`** — returns `Tier | null`. Optional `seed` uses FNV-1a hash for determinism; without it, `Math.random()`. Returns **`null` when** `score < 500`.

### `src/config/yokai.ts` (296 ll) ★ LOCKED
- `YOKAI_CHAIN: YokaiType[]` — 11 entries (id 1-11).
- Per-yokai fields: `id, name, kanji, radius, color, score, sprite, description`.
- **Score ladder:** 1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66.
- **Radii:** 20, 28, 37, 44, 55, 64, 76, 87, 101, 117, 138.
- `SPAWNABLE_IDS = [1, 2, 3, 4, 5]` — tiers 6-11 are merge-only.
- `TIER_ORDER = ["common","rare","epic","legendary"]`, `YOKAI_ORDER` (lowercase names), `KANJI`, `ELEMENT_MAP`, `AURORA_OPACITY`, `BASE_LORE`, `TIER_FLAVOR`, `buildNFTDescription`.
- ⚠️ `CLAUDE.md`'s yokai radii and game dimensions are stale vs the real code (`constants.ts` has 470×720, not 390×600; Kodama radius 20, not 17). **Code is the truth.**

### `src/components/NFTCard.tsx` (347 ll) ★ LOCKED
- Asset-first card: full-bleed `<img>` of `/nft_assets/static/{yokai}_{tier}.png` (or `…/animated/{yokai}_{tier}.webp` on interact).
- **Props:** `yokai`, `tier`, `size? = "md"`, `width?`, `interactive? = true`, `showLore? = false`, `className?`.
- Holo (three layers: aurora / streak / sparkles) fades in on `.isInteracting`. 3D tilt via inline `transform` written from `applyTilt(clientX, clientY)` (mouse OR touch).
- `data-yokai` + `data-tier` attributes + `role="img"` so outside-overlays can target it.
- ⚠️ Do **not** modify directly. Need to overlay? Use a parent wrapper with `position: absolute` (e.g. 3.5j's score-badge experiment was reverted in 3.5k for exactly this reason — header score is sufficient).

---

## Audio system in depth

| Surface | Path | Pitch | Envelope | Reverb |
|---|---|---|---|---|
| In-game merge | `playMergeWithCombo()` → direct `BufferSource` | C5–A5 (`merge_1…5.mp3`, native) | none | **dry** |
| In-game drop | `playDrop()` → `dropBuffer` (`/sfx/drop.mp3`) | native | none | dry |
| In-game game-over | `playGameOver()` → `gameoverBuffer` (`/sfx/gameover.mp3`) | native | baked-in | dry |
| Ceremony tick (per spin step) | `playTick()` → `playBowlTone(A3 …)` | A3 (~220 Hz) | 50 ms attack | 40 % wet |
| Ceremony reveal chime | `playChime(tier)` → ascending bowls | E3–D4 | 0.3 s attack, 3.5 s ring | **35 % wet** (discovery, drier) |
| Ceremony mint success | `playMintSuccess()` → overlapping `MINT_CHORD` | E3+G3+B3+D4 chord | 0.5–0.7 s attack, **7 s ring** | **60 % wet** (resolution, wetter) |

**Why the differentiation:** reveal = melody (notes arrive one at a time → "discovery"), mint = harmony (notes stack into a sustained chord → "resolution / amen"). Same singing-bowl timbre family across both; opposite musical gesture.

**Reverb implementation:** `getCeremonyReverb(ctx)` lazily builds a `ConvolverNode` with a 2-channel impulse buffer filled with decaying noise (`Math.pow(1 − i/len, 2.5)` envelope, 2.5 s). Cached after first build. Wet/dry split happens per `playBowlTone` call: `dry.gain.value = 1 − wet`, `wet.gain.value = wet`, both summed back into `sfxGain`.

---

## Asset inventory (`public/`)

| File | Size | Purpose / status |
|---|---|---|
| `ceremony_bg.jpg` | **655 KB** | Moonlit lotus pond, ceremony background — compressed in 3.5h from 8 MB ✓ |
| `bg_game.jpg` | 494 KB | Main game scene background ✓ |
| `image.png` | **1.5 MB** | `fc:miniapp` / OG embed image ⚠️ **compress to ~400 KB** before next deploy |
| `splash.png` | 29 KB | Mini-App splash icon ✓ |
| `icon.png` | 370 KB | Source icon (kodama-green) ✓ |
| `icon-16 / 32 / 48 / 192 / 512.png` | small | App icon ladder ✓ |
| `apple-touch-icon.png` | 56 KB | iOS web-clip ✓ |
| `kami_merge_splash_mobile.mp4` | 2.0 MB | Splash video ✓ |
| `kodydeverik_…_lotus_pond_….png` | 8.0 MB | ⚠️ Raw Midjourney source — duplicate of compressed `ceremony_bg.jpg`. **Untracked.** Add to `.gitignore` or delete locally. |
| `nft_assets/static/*.png` | ×44 | 11 yokai × 4 tiers, 2048×2867 RGBA cards ✓ |
| `nft_assets/animated/*.webp` | ×44 | 11 yokai × 4 tiers, 36-frame loops ✓ |
| `sfx/merge_1…5.mp3` | 29 KB each | Marimba pentatonic C5–A5 ✓ |
| `sfx/drop.mp3` | 24 KB | Yokai drop ✓ |
| `sfx/gameover.mp3` | 97 KB | 4-note minor cadence ✓ |
| `audio/` (subdir) | — | BGM tracks (see `bgmTracks.ts`) |
| `.well-known/farcaster.json` | small | Mini App manifest — ⚠️ **old Farcaster v1 shape**, needs Startale 2.3 update (`startale` sibling key + `heroImageUrl` under `frame`) before listing |

---

## Design tokens (inline — `DESIGN_SYSTEM.md` not yet created)

Defined in `app/globals.css`:

| Token | Value | Use |
|---|---|---|
| `--bg-base` | `#0f0f1e` | Page background fallback |
| `--gold-50` | `#f5e6c8` | Highlight / parchment text |
| `--gold-200` | `#c8a04c` | Default UI gold |
| `--gold-700` | `#8a6f28` | Borders, dividers |
| `--gold-rgb` | `200 160 76` | For `rgba(var(--gold-rgb) / 0.3)` |
| `--wood-light` | `#5c3a1e` | Button base |
| `--wood-dark` | `#3d2510` | Button bottom |
| `--wood-rgb` | `92 58 30` | For shadows / overlays |
| `--torii-red` | `#c0392b` | Sacred kanji (e.g. `完`) |
| `--tier-common / rare / epic / legendary` | `#b49656 / #d2a769 / #ebc36e / #ffda6e` | Per-tier accent |
| `--tracking-spaced` / `--tracking-extra` | letter-spacing utilities | Labels, headers |
| `--shadow-glow-gold` | `0 0 24px rgba(...)` | Premium glow |

**Fonts:** Georgia / "Times New Roman" for Latin; Hiragino Mincho ProN / Yu Mincho / Noto Serif CJK JP for kanji. **Ceremony scene background:** `#0e1a2e` literal (deeper than `--bg-base`, set in `MintCeremony.module.css`).

**Reusable button classes** (`app/globals.css`): `.wood-btn` (primary, wood gradient + gold border + brightness hover), `.scroll-panel` (parchment), `.wooden-rod` (decorative).

---

## State management patterns

- **Persistent prefs:** localStorage with try/catch — `kami_sound_enabled`, `kami_music_enabled`, `kami_unlocked_yokai`, `kami_inventory_mock_v1`, `HIGH_SCORE_KEY`, BGM track id.
- **Engine ↔ React:** engine emits via callbacks (`EngineCallbacks`), React owns derived state via `useState`. The callback object is **captured at mount** inside the engine-init `useEffect`.
- **★ Stale-closure pitfall:** any state read inside `onGameOver` / `onReachedChange` / etc. is whatever was in scope at engine-creation time, **not** the current value. Fixes:
  - Use `setX(prev => …)` setter functions where possible.
  - Mirror critical state to `useRef` (e.g. PR #44 introduces `reachedRef` so `onGameOver` reads the latest `reached[]`).
- **Inventory:** `useInventory()` returns mock NFT list + `_devAddMock`; backed by `kami_inventory_mock_v1`; safe to call from any component.
- **Mini-App detect:** `useMiniAppContext()` returns `{ isMiniApp, isReady }` after racing `sdk.context` against a 1500 ms timeout, then calls `sdk.actions.ready()` only when truly inside a host.
- **Chain detect:** `useActualChainId()` reads the EIP-1193 provider directly (wagmi's `useChainId()` silently falls back to the configured default on unknown chains, defeating wrong-chain detection).

---

## Build + dev

```bash
# Dev server (network-exposed for mobile testing)
npm run dev -- -H 0.0.0.0
# Routes:
#   /                          Main game
#   /dev/mint-ceremony         Ceremony preview (DemoClient + force controls)
#   /dev/inventory             Inventory dev preview
#   /dev/nft-cards             Single-card playground

# Production build
npm run build
# Expected: 4 routes (one static `/`, three `ƒ` dynamic dev routes), TS clean.
# Known noise: `TypeError: this.localStorage.getItem is not a function` ×N
# during `Generating static pages` — pre-existing wagmi/RainbowKit SSR
# chatter, ignore.

# Local network IP for mobile (hotspot-dependent)
# Example: http://172.20.10.4:3000/ — change with your network.
```

**`next.config.ts`** has `allowedDevOrigins` whitelisting localhost + `172.20.10.0/24` + `192.168.0.0/16` + `10.0.0.0/8` (a wildcard `"*"` did **not** match bare IPs — explicit ranges only). HMR breaks on mobile without this.

**`?debug=1`** loads Eruda from jsDelivr (DebugConsole.tsx). **`?dev=1`** opens the dev panel + skip-wallet bypass.

---

## Halt-on-touch rules (locked files)

| File | Why locked | Workaround |
|---|---|---|
| `src/components/NFTCard.tsx` + `.module.css` | Finalised in Stage 3.3 (PRs #16-#34). Asset-first card — adding any CSS text overlay duplicates baked PNG content. Consumed by Inventory, dev-cards, MintCeremony. | Overlay from parent with `position: absolute`. Need a per-context tweak? Scope via `:global([role="img"])` from the parent's CSS module (e.g. 3.5e fixed black corners that way). |
| `src/game/engine.ts` | Matter.js + game loop. State mutations belong here only; React reads via callbacks. | Consume `EngineCallbacks`. Need a new event? Add to the type + emit; never reach in for internal state. |
| `src/lib/tierFromScore.ts` | Brief v13 locked drop matrix. Balance change. | Discuss before modifying — affects every mint flow. |
| `src/config/yokai.ts` | YOKAI_CHAIN drives spawn, merge, scoring, asset paths. | Adding lore/cosmetic fields is fine; renaming or reordering breaks everything. |

When a fix seems to need an unlocked file, halt and report the diagnosis first (the 3.5c→3.5e arc shows why — three "modify NFTCard" temptations all dissolved into MintCeremony-side wrapper fixes).

---

## Conventions

**Branches.** `feat/stage-X-description` for features, `fix/stage-X-description` for fixes, `chore/...` / `docs/...` for non-feature work.

**Commits.** `feat(stage-X): description`, `fix(stage-X): description`, `docs: …`, `chore: …`. Atomic — one logical change per commit. Always include the `Co-Authored-By` trailer when assisted by Claude.

**PR flow.**
1. Branch off main (or off the previous PR for stacked work).
2. Implement → build clean → commit.
3. `git push -u origin <branch>`.
4. `gh pr create --base <base> --title … --body …`.
5. Squash-merge.

**Stacked-PR caveat — learned the hard way (Stage 3.5 close):** `gh pr merge --squash --delete-branch` deletes the head branch on merge. If the next stacked PR's base **is** that deleted branch, GitHub **closes** it (auto-retarget requires the base PR's head branch to survive). Two recoveries:
- **Preemptive (recommended):** before merging the first PR, retarget all downstream PRs to `main` via `gh pr edit <n> --base main`.
- **Cherry-pick recovery:** `git checkout main && git pull && git cherry-pick <commit-sha>` for each follow-up commit, then push main; close the orphaned PRs with `--delete-branch`.

**Direct-to-main allowed** for docs-only commits (CODEBASE_AUDIT.md, README, etc.) to avoid PR overhead.

---

## Stage 3.5 PR ledger

| PR | Stage | Title (summary) | State |
|---|---|---|---|
| #35 | 3.5 | mint ceremony component + tier slot reveal + mock mint | merged |
| #36 | 3.5 | layout + slot drum + sound design + multi-stage reveal | merged |
| #37 | 3.5 | design-token alignment + reuse marimba samples | merged |
| #38 | 3.5b | replace parchment with dramatic moonlit scene | merged |
| #39 | 3.5c–3.5g (bundle) | warm palette · image bg · aurora/frame fix · success celebration · ceremonial text | merged |
| #40 | 3.5h | overlaps + continuous sakura + singing-bowl synthesis + bg compression (8 MB → 655 KB) | closed; delivered via cherry-pick (stacked-merge recovery) |
| #41 | 3.5i | banner clip fix + reveal/mint audio differentiation | closed; cherry-picked |
| #42 | 3.5j | success-phase polish (banner, aura, sparkles, header evolution, ghost button) | closed; cherry-picked |
| #43 | 3.5k | remove redundant score badge + ghost button copy refinement | closed; cherry-picked |
| **#44** | **3.5L** | **wire MintCeremony into game-over flow with 500 score threshold** | **OPEN — mergeable — awaiting merge** |

---

## Pending merges

### PR #44 — `feat/stage-3.5L-ceremony-wireup → main`
- Adds ceremony eligibility logic to `GameCanvas.tsx`: on `onGameOver(final)`, rolls a tier via `tierFromScore(final, \`${final}-${Date.now()}\`)` (re-rolls per run), picks the highest-id reached yokai, caches `{ yokai, tier, score }` in `ceremonyRun` state so re-renders don't re-roll.
- New state: `ceremonyRun`, `ceremonyDismissed`, plus a `reachedRef` mirror to defeat the stale-closure pitfall on the engine callback.
- JSX gates the existing wood-scroll panel and the new ceremony overlay as **mutually exclusive**: `gameOver && ceremonyRun && !ceremonyDismissed` → ceremony; `gameOver && (!ceremonyRun || ceremonyDismissed)` → Restart panel (with a new "Score 500+ to earn an NFT / もう一度 · Try again" line below Best when `finalScore < MIN_MINT_SCORE`).
- New file: `src/components/GameCanvas.module.css` (79 ll) — overlay container, × skip button, motivational message + a uniquely-named `ceremony-overlay-in` keyframe to avoid colliding with MintCeremony's scoped `fade-in-soft`.
- Constraint-clean: engine, MintCeremony, NFTCard, audio, ceremonySound, tierFromScore, useInventory all git-clean on the branch.

After merge: the ceremony reaches real players.

---

## Known issues + TODO

| # | Item | Priority |
|---|---|---|
| 1 | `public/image.png` is **1.5 MB** — `fc:miniapp` / OG embed image. Compress to ~400 KB (same lesson as `ceremony_bg.jpg` 8 MB → 655 KB in 3.5h). | 🟡 before Mini-App submission |
| 2 | `public/.well-known/farcaster.json` is on the **old Farcaster v1 shape** — needs Startale 2.3 update: add `startale` sibling key with `manifestVersion: "2.3"`, `screenCompatibility`, `featuredBannerImageUrl`, `projectWebsite`, `socialLinks`; add `heroImageUrl` under `frame`. | 🟡 before Mini-App submission |
| 3 | No production `/inventory` route — "Visit the Shrine" on the success screen currently just closes the ceremony. Future PR. | 🟢 future |
| 4 | Ceremony uses `navigator.vibrate(30)` (Web Vibration). Farcaster SDK haptics (`impactOccurred` / `notificationOccurred` / `selectionChanged`) would be richer on host devices. | 🟢 nice-to-have |
| 5 | Build emits `TypeError: this.localStorage.getItem is not a function` during static-page generation — pre-existing wagmi/RainbowKit SSR noise, not from our code. | 🟢 ignore |
| 6 | `public/kodydeverik_…_lotus_pond_….png` (8 MB) sits untracked in `public/`. Duplicate of `ceremony_bg.jpg`. Add to `.gitignore` or delete locally. | 🟢 cleanup |
| 7 | `CLAUDE.md` quotes stale yokai radii (e.g. Kodama 17) and game dimensions (390×600). Real values are in `src/config/yokai.ts` + `constants.ts` (Kodama 20, 470×720). Update CLAUDE.md. | 📝 doc drift |
| 8 | Spec text says "score ≥ 1,000 minimum" but `MIN_MINT_SCORE = 500` (locked, audited). Update the spec to match code, not the other way around — see score-floor analysis: 500 is the well-calibrated value. | 📝 doc drift |
| 9 | `DESIGN_SYSTEM.md` is referenced by the audit prompt as "just created — single source of truth" but does **not** yet exist. Tokens inlined above as a stopgap. | 📝 missing doc |
| 10 | `audioManager.playSampleAt` (added in 3.5d) has no callers on `main` since 3.5h switched the ceremony to `playBowlTone`. Kept intact per spec for backward compat. Optional cleanup later if confirmed unused long-term. | 🟢 future |

---

*End of audit. Re-generate after the next major merge or substantive refactor.*
