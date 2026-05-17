<!-- Auto-generated: 2026-05-17. Reflects state at commit a87f756. -->

# Kami Merge — Codebase Audit

Structural reference for the Kami Merge codebase. Documents what **exists
now** (verified by reading source), not what handoffs or `CLAUDE.md`
describe. Regenerate after major architecture work.

> `CLAUDE.md` is stale on several physics/layout numbers — see
> [Appendix](#appendix--claudemd-discrepancies). Trust this file.

---

## 1. CSS Architecture

`app/globals.css` imports Tailwind v4 (`@import "tailwindcss";`). There is
**no `tailwind.config.*` file** and **no `@theme` block** — design tokens
are plain `:root` CSS custom properties, consumed through Tailwind v4
arbitrary-value syntax (`text-(--gold-200)`, `tracking-(--tracking-cap)`,
`bg-[rgb(var(--indigo-rgb))]`).

### 1.1 Design tokens (`:root`)

**Background ramp**

| Token | Value | Used for |
|---|---|---|
| `--bg-deepest` | `#050510` | body fallback |
| `--bg-base` | `#0f0f1e` | page background |
| `--bg-elev` | `#1a1a2e` | cards, modals, elevated surfaces |

**Foreground**

| Token | Value | Used for |
|---|---|---|
| `--fg-base` | `#e8e0d0` | default text on dark bg |

**Gold scale** (single canonical UI gold)

| Token | Value | Used for |
|---|---|---|
| `--gold-50` | `#f5e6c8` | highlight gold / parchment |
| `--gold-200` | `#c8a04c` | DEFAULT UI gold |
| `--gold-700` | `#8a6f28` | dark gold — borders, dividers |

**NFT tier accents** (ascending warmth, common → legendary)

| Token | Value | Used for |
|---|---|---|
| `--tier-common` | `#b49656` | MintCeremony drum + tier banner |
| `--tier-rare` | `#d2a769` | " |
| `--tier-epic` | `#ebc36e` | " |
| `--tier-legendary` | `#ffda6e` | " |

**Cultural / status**

| Token | Value | Used for |
|---|---|---|
| `--torii-red` | `#c0392b` | cultural accent (NOT semantic danger) |
| `--accent-success` | `#6fd28a` | |
| `--accent-warning` | `#e87d3e` | |
| `--accent-error` | `#d96b6b` | |

**RGB triple helpers** (for `rgba(var(--x) / a)` syntax)

| Token | Value |
|---|---|
| `--gold-rgb` | `200 160 76` |
| `--wood-rgb` | `92 58 30` |
| `--indigo-rgb` | `15 15 30` |
| `--black-rgb` | `0 0 0` |

**Wood scale**

| Token | Value | Used for |
|---|---|---|
| `--wood-light` | `#5c3a1e` | wood gradient top |
| `--wood-dark` | `#3d2510` | wood gradient bottom |

**Letter-spacing scale**

| Token | Value |
|---|---|
| `--tracking-normal` | `0.02em` |
| `--tracking-wide` | `0.05em` |
| `--tracking-extra` | `0.1em` |
| `--tracking-label` | `0.15em` |
| `--tracking-cap` | `0.2em` |
| `--tracking-spaced` | `0.3em` |

**Line-height**

| Token | Value |
|---|---|
| `--leading-tight` | `1.25` |
| `--leading-body` | `1.625` |

**Shadows**

| Token | Value |
|---|---|
| `--shadow-sm` | `0 2px 8px rgba(var(--black-rgb) / 0.3)` |
| `--shadow-md` | `0 8px 24px rgba(var(--black-rgb) / 0.5)` |
| `--shadow-lg` | `0 16px 48px rgba(var(--black-rgb) / 0.65)` |
| `--shadow-glow-gold` | `0 0 24px rgba(var(--gold-rgb) / 0.3)` |
| `--shadow-glow-legendary` | `0 0 32px rgba(255 215 130 / 0.45)` |

There are **no `--font-*` tokens** — font families are inline literals
project-wide (`Georgia, "Times New Roman", serif` for Latin;
`"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif CJK JP", serif` for CJK).

### 1.2 Reusable global classes

| Class | Visual effect |
|---|---|
| `.app-shell` | Full-viewport flex-column shell; `100dvh`, safe-area padding, hidden overflow |
| `.kami-serif` | Shared Latin serif stack for UI text |
| `.kami-title` | Gold vertical-gradient text-clip + text-shadow (game title) |
| `.icon-btn` | Icon-button hover affordance — scale 1.05 hover / 0.97 active |
| `.track-arrow-btn` | Borderless chevron — dims on hover/active, `not-allowed` when disabled |
| `.wood-btn` | Wooden plaque button — wood gradient, gold text/border, inset highlight; `brightness(1.18)` hover, `brightness(0.55)` + 1px translate active |
| `.wooden-rod` | Vertical wood gradient bar — book-binding ribbon |
| `.scroll-panel` | Parchment panel — woven-paper stripe over cream gradient, inset glow |
| `.score-plate` | Indigo translucent plate, gold border, backdrop-blur (HUD score) |
| `.lantern-glow` | 60px radial orange glow, flickers via `lantern-flicker` |
| `.firefly-glow` | 20px radial warm glow, drifts via `firefly-drift` |
| `.splash-pulse` | Infinite 2s opacity pulse (tap-to-start button) |
| `.animate-splash-fade` | One-shot 0.4s opacity fade-in |
| `.season-badge-anim` | Fade + slide-in via `season-badge-in` |
| `.yokai-card-fade-in` / `.yokai-card-fade-out` | Lore-card enter/exit (drives nested `.scroll-panel-wrapper`) |

`@keyframes` defined: `yokaiCardEnter`, `yokaiCardExit`, `backdropEnter`,
`backdropExit`, `season-badge-in`, `splash-pulse`, `splash-fade`,
`lantern-flicker`, `firefly-drift`.

### 1.3 CSS Modules

Three component-scoped stylesheets — `NFTCard.module.css`,
`Inventory.module.css` (shared by `Inventory`, `YokaiDetail`, `CardDetail`,
`YokaiOverviewCard`), `MintCeremony.module.css`.

---

## 2. Component Inventory

All components carry `"use client"`. No component uses `forwardRef` or
`useImperativeHandle` — `GameCanvas` / `MintCeremony` hold imperative
objects via `useRef` internally but expose no ref-based API.

#### `GameCanvas.tsx`
- **Purpose:** Main game component — hosts the Matter.js `GameEngine`, wires input, renders the full HUD.
- **Props:** no props.
- **Styling:** mix — Tailwind + inline styles.
- **Reuses:** `SplashScreen`, `Settings`, `dev/DevPanel`, `icons/SuzuIcon`, `icons/MonIcon`.
- **Notable:** Holds a `GameEngine` in `engineRef`; session watcher bounces to splash on disconnect / wrong chain. `DevPanel` double-gated on `NODE_ENV === "development"` + `isDev`.

#### `GameCanvasLoader.tsx`
- **Purpose:** Client wrapper that dynamically imports `GameCanvas` with SSR disabled.
- **Props:** no props.
- **Styling:** Tailwind.
- **Reuses:** `GameCanvas` (via `next/dynamic`, `ssr: false`).
- **Notable:** `loading` fallback + `.catch` → inline `ErrorFallback`.

#### `SplashScreen.tsx`
- **Purpose:** Wallet-gated splash — gates gameplay behind a connected wallet on Soneium mainnet (1868); two-video crossfade background.
- **Props:**
  ```tsx
  type Props = {
    onStart: () => void;
    onOpenSettings: () => void;
  };
  ```
- **Styling:** mix — Tailwind + inline styles.
- **Reuses:** `icons/MonIcon`.
- **Notable:** Chain ID read via `useActualChainId()` (direct EIP-1193), not wagmi. Dev-only `?dev=1` "Skip Wallet" bypass.

#### `Settings.tsx`
- **Purpose:** Full-screen settings modal — SFX/BGM toggles, BGM track picker, 4-column Yokai Collection grid.
- **Props:**
  ```tsx
  type Props = {
    sfxEnabled: boolean;
    bgmEnabled: boolean;
    unlockedIds: number[];
    currentTrack: BgmTrackId | null;
    onSelectTrack: (id: BgmTrackId) => void;
    onToggleSfx: () => void;
    onToggleBgm: () => void;
    onClose: () => void;
  };
  ```
- **Styling:** mix — Tailwind (arbitrary `text-(--token)`) + inline; global classes `wood-btn`, `wooden-rod`, `scroll-panel`, `kami-serif`.
- **Reuses:** `YokaiDetailCard`, `icons/SuzuIcon`, `icons/TaikoIcon`.
- **Notable:** Mirrors `localStorage` key `kami_unlocked_yokai` via a `storage` event listener.

#### `YokaiDetailCard.tsx`
- **Purpose:** Lore card for one unlocked yokai — parchment scroll panel with book-binding ribbons; swipe / arrow-key navigation across unlocked entries.
- **Props:**
  ```tsx
  type Props = {
    yokaiId: number;
    unlockedIds: number[];
    onClose: () => void;
    onNavigate: (newId: number) => void;
  };
  ```
- **Styling:** mix — Tailwind + inline; global classes `scroll-panel`, `wooden-rod`, `kami-serif`, `yokai-card-fade-in/out`.
- **Reuses:** none; imports `getYokai` from `@/config/yokai`.
- **Notable:** Two-phase close — plays a 300ms exit animation then calls `onClose`. Opened from the `Settings` collection grid.

#### `Web3Provider.tsx`
- **Purpose:** Wraps the app in wagmi v2 + react-query + RainbowKit, gated behind a client-mount flag.
- **Props:** `{ children }: { children: React.ReactNode }`.
- **Styling:** imports `@rainbow-me/rainbowkit/styles.css`.
- **Reuses:** none; imports `wagmiConfig` from `@/lib/wagmi`.
- **Notable:** `QueryClient` in a `useState` initializer (Strict-Mode safe). Renders children un-wrapped until `mounted`.

#### `FarcasterUserBadge.tsx`
- **Purpose:** Top-right Farcaster identity chip; shown only inside a Mini App host with a resolved user.
- **Props:** no props.
- **Styling:** mix — Tailwind + inline.
- **Reuses:** none.
- **Notable:** Mount-gated — renders `null` until `useEffect` flips `mounted`, then mounts the inner component that calls `useMiniAppContext`.

#### `DebugConsole.tsx`
- **Purpose:** Injects the Eruda on-device console (jsDelivr CDN) when `?debug=1` is in the URL.
- **Props:** no props.
- **Styling:** none — renders `null`.
- **Reuses:** none.
- **Notable:** All behavior in a `useEffect`; StrictMode-safe repeat-mount guard.

#### `NFTCard.tsx`
- **Purpose:** Atomic NFT card — renders the card bitmap with tier-scaled aurora holo + drag-to-tilt.
- **Props:**
  ```tsx
  export interface NFTCardProps {
    yokai: YokaiName;
    tier: Tier;
    size?: "sm" | "md" | "lg";   // default "md"
    width?: number;               // overrides size preset
    interactive?: boolean;        // default true
    showLore?: boolean;           // default false
    className?: string;
  }
  ```
- **Styling:** CSS module (`NFTCard.module.css`) + conditional inline `{ width, aspectRatio: "5 / 7" }` when `width` set.
- **Reuses:** none.
- **Notable:** Tilt written directly to `cardRef.current.style.transform` (no React state churn); preloads static PNG via `new Image()`. Asset paths: `/nft_assets/static/{yokai}_{tier}.png`, `/nft_assets/animated/{yokai}_{tier}.webp`.

#### `Inventory.tsx`
- **Purpose:** 3-screen collection orchestrator (overview grid → per-yokai tiers → card detail).
- **Props:**
  ```tsx
  export interface InventoryProps {
    initialScreen?: InventoryScreen;
    overviewCardWidth?: number;   // default 165
    tierCardWidth?: number;       // default 165
    detailCardWidth?: number;     // default 300
  }
  export type InventoryScreen =
    | { name: "overview" }
    | { name: "yokai"; yokai: YokaiName }
    | { name: "detail"; tokenId: string };
  ```
- **Styling:** CSS module (`Inventory.module.css`).
- **Reuses:** `YokaiOverviewCard`, `YokaiDetail`, `CardDetail`.
- **Notable:** Discriminated-union screen state machine; resets body scrollTop on screen change.

#### `YokaiOverviewCard.tsx`
- **Purpose:** Screen 1 tile — highest-owned-tier asset + "X/4" badge, or locked silhouette.
- **Props:**
  ```tsx
  interface YokaiOverviewCardProps {
    yokai: YokaiName;
    highestTier: Tier | null;   // null → locked
    ownedCount: number;          // 0–4
    width: number;
    onTap: () => void;
  }
  ```
- **Styling:** CSS module (`Inventory.module.css`) + inline `{ width, aspectRatio }`.
- **Reuses:** none — deliberately does NOT reuse `NFTCard` (avoids tilt/holo wiring for a glance-grid).
- **Notable:** Inlines its own SVG padlock.

#### `YokaiDetail.tsx`
- **Purpose:** Screen 2 — 2×2 grid of the 4 tier variants for one yokai.
- **Props:**
  ```tsx
  interface YokaiDetailProps {
    yokai: YokaiName;
    ownedTiers: Record<Tier, boolean>;
    tierCardWidth: number;
    tokenIdFor: (yokai: YokaiName, tier: Tier) => string | null;
    onSelectTier: (tier: Tier, tokenId: string) => void;
  }
  ```
- **Styling:** CSS module (`Inventory.module.css`).
- **Reuses:** `NFTCard`.
- **Notable:** `UNLOCK_HINT` copy is placeholder (Stage 7 swaps to real scoring).

#### `CardDetail.tsx`
- **Purpose:** Screen 3 — one large `NFTCard` + metadata table + lore section + Share / OpenSea buttons.
- **Props:**
  ```tsx
  interface CardDetailProps {
    nft: InventoryNFT;
    detailCardWidth: number;
    onShare?: (nft: InventoryNFT) => void;
  }
  ```
- **Styling:** CSS module (`Inventory.module.css`).
- **Reuses:** `NFTCard`.
- **Notable:** OpenSea button hardcoded `disabled`; `onShare` absent → `console.log` stub.

#### `MintCeremony.tsx`
- **Purpose:** Post-run NFT reveal ceremony — phase timeline (intro → slot-drum spin → 3-beat reveal → mock mint → success).
- **Props:**
  ```tsx
  interface MintCeremonyProps {
    yokai: YokaiName;
    tier: Tier;
    score: number;
    onMintComplete?: (nft: InventoryNFT) => void;
    onClose?: () => void;
    cardWidth?: number;          // default 280
    soundEnabled?: boolean;      // default true
    onPhaseChange?: (phase: CeremonyPhase) => void;
  }
  export type CeremonyPhase =
    | "intro" | "spinning" | "card-materializing" | "aurora-rising"
    | "tier-banner" | "mint-ready" | "minting" | "success";
  ```
- **Styling:** CSS module (`MintCeremony.module.css`) + inline (drum transform, sakura, `--tier-current`) + global `wood-btn`.
- **Reuses:** `NFTCard`.
- **Notable:** Mount-driven timer state machine; replay = remount with a new key. Mint mocked via `useInventory._devAddMock`. Audio via `@/lib/ceremonySound`.

#### `SeasonBadge.tsx`
- **Purpose:** Top-right kanji marker that swaps/fades on season change.
- **Props:** no props.
- **Styling:** inline + global `kami-serif`, `season-badge-anim`.
- **Reuses:** none.
- **Notable:** Subscribes to `@/game/seasons` store (note: season cycling is deactivated — see §7).

#### `SeasonTint.tsx`
- **Purpose:** Full-screen fixed color tint layer, cross-fades on season change.
- **Props:** no props.
- **Styling:** inline only.
- **Reuses:** none.
- **Notable:** Subscribes to `@/game/seasons`; fade driven by `TINT_FADE_MS`.

#### `dev/DevPanel.tsx`
- **Purpose:** Dev-only test overlay (`?dev=1`) — God Mode, Skip Wallet, Clear Field, Unlock All, per-yokai spawn.
- **Props:**
  ```tsx
  export type DevPanelProps = {
    onSpawn: (yokaiId: number) => void;
    onClearField: () => void;
    godMode: boolean;
    onToggleGodMode: () => void;
    onUnlockAll: () => void;
    allUnlocked: boolean;
  };
  ```
- **Styling:** pure Tailwind (red/neutral "service UI" palette, `font-mono`).
- **Reuses:** none.
- **Notable:** Ships in production bundles but never renders without `?dev=1`. Skip-Wallet toggle uses `sessionStorage` + a `CustomEvent`.

#### Icon components — `icons/`
All four are simple stroke SVG line-art (`viewBox 0 0 24 24`,
`stroke="currentColor"`, `aria-hidden`). No reuse, no CSS classes beyond
pass-through `className`.

| File | Purpose | Props |
|---|---|---|
| `FurinIcon.tsx` | Wind-chime; `enabled` adds sound-wave arcs | `{ enabled: boolean; size?: number; className?: string }` |
| `MonIcon.tsx` | Family-crest sakura emblem (Settings glyph) | `{ size?: number; className?: string }` |
| `SuzuIcon.tsx` | Temple bell ("sound" icon); `muted` adds strike | `{ muted?: boolean; size?: number; className?: string }` |
| `TaikoIcon.tsx` | Taiko drum ("music" icon); `muted` adds strike | `{ muted?: boolean; size?: number; className?: string }` |

---

## 3. Audio Architecture

`src/game/audio.ts` exports:
- `class AudioManager` — the audio manager.
- `const audioManager = new AudioManager()` — **shared singleton** for
  non-game UI (the MintCeremony, via `ceremonySound.ts`).

The game engine constructs its **own private** `AudioManager` instance
(`engine.ts:160`, `private audio = new AudioManager()`) — separate from
the singleton on purpose.

**`AudioManager` public methods:**

```tsx
unlock(): void
setSoundEnabled(enabled: boolean): Promise<void>
setMusicEnabled(enabled: boolean): Promise<void>
isSoundEnabled(): boolean
isMusicEnabled(): boolean
setMuted(muted: boolean): void
isMuted(): boolean
setSfxMuted(muted: boolean): void
isSfxMuted(): boolean
setBgmMuted(muted: boolean): void
isBgmMuted(): boolean
playBGM(src: string): void
stopBGM(): void
setBgmTrack(id: BgmTrackId): Promise<void>
getBgmTrack(): BgmTrackId | null
playDrop(): void                 // currently a no-op (disabled)
playMergeWithCombo(): void
playSampleAt(index: number, opts?: { volume?: number }): void
playGameOver(): void
```

**Sample storage** — private fields:
- `mergeBuffers: AudioBuffer[]` — 5 pre-tuned marimba notes (C5 D5 E5 G5 A5),
  indexed 0–4. `playSampleAt(index, …)` plays one by index;
  `playMergeWithCombo()` walks them as a pentatonic combo.
- `dropBuffer`, `gameoverBuffer` — single buffers.

**localStorage keys** (written via private `persistPref`, stored as
`"true"`/`"false"`): `kami_sound_enabled`, `kami_music_enabled`.
`AudioManager` itself never reads them back — consumers do.

**Initialization** — the constructor is side-effect-free (`AudioContext` +
sample decode are deferred to the first `unlock()`/play call), so the
eager singleton costs nothing until a cue fires.

---

## 4. Hooks Inventory

#### `useActualChainId`
- **Purpose:** Returns the actual EIP-1193 chain id from the wallet provider, bypassing wagmi's pinned configured-chain state.
- **Signature:** `useActualChainId(): number | undefined`
- **localStorage:** none.
- **Side effects:** Subscribes to `chainChanged` (`.on` / `.addEventListener` / 2s poll fallback); cleans up on unmount.

#### `useDevMode`
- **Purpose:** `true` when the URL contains `?dev=1`.
- **Signature:** `useDevMode(): boolean`. Also exports non-React `isDevModeActive(): boolean`.
- **localStorage:** none.

#### `useDevSkipWallet`
- **Purpose:** Dev-only splash wallet bypass — `true` only when `?dev=1` AND the DevPanel "Skip wallet" box is checked.
- **Signature:** `useDevSkipWallet(): boolean`. Also exports `readDevSkipWallet()` / `writeDevSkipWallet(value)`.
- **Storage:** `sessionStorage` key `kamiMerge_devSkipWallet` (not localStorage).
- **Side effects:** Subscribes to a `devSkipWalletChange` `CustomEvent`.

#### `useInventory`
- **Purpose:** Mock NFT-collection state (Stage 3.4), localStorage-backed; shape mirrors the future on-chain read.
- **Signature:** `useInventory(): UseInventoryReturn`
  ```tsx
  export interface UseInventoryReturn {
    nfts: InventoryNFT[];                 // sorted newest-first
    count: number;
    total: number;                        // always 44
    byYokai: Record<YokaiName, InventoryNFT[]>;
    highestTierFor: (yokai: YokaiName) => Tier | null;
    hasYokaiTier: (yokai: YokaiName, tier: Tier) => boolean;
    isLoading: boolean;
    _devAddMock: (yokai: YokaiName, tier: Tier, score?: number) => void;
    _devAddAll: () => void;
    _devClear: () => void;
  }
  export interface InventoryNFT {
    tokenId: string;
    yokai: YokaiName;
    tier: Tier;
    mintedAt: number;   // unix ms
    score: number;
  }
  ```
- **localStorage:** `kami_inventory_mock_v1`.
- **Side effects:** `_dev*` mutators are no-ops in production (`NODE_ENV` gated).

#### `useMiniAppContext`
- **Purpose:** Detects a Farcaster Mini App host and auto-connects the host wallet.
- **Signature:** `useMiniAppContext(): MiniAppContextValue`
  ```tsx
  export type MiniAppContextValue = {
    isMiniApp: boolean;
    isReady: boolean;
    user: FarcasterUser | null;
    location: MiniAppLocation | null;
  };
  export type FarcasterUser = {
    fid: number;
    username?: string;
    displayName?: string;
    pfpUrl?: string;
  };
  export type MiniAppLocation =
    | "cast_embed" | "notification" | "launcher" | "unknown";
  ```
- **localStorage:** none.
- **Side effects:** Races `sdk.context` against a 1500ms timeout; on a Mini App context calls wagmi `connect(...)` + `sdk.actions.ready()`.

#### `useWallet`
- **Purpose:** Thin facade over wagmi hooks for game components.
- **Signature:** `useWallet()` (inferred return):
  ```tsx
  {
    address: `0x${string}` | undefined;
    isConnected: boolean;
    isConnecting: boolean;
    chainId: number;
    isOnSoneium: boolean;
    switchToSoneium: () => void;
  }
  ```
- **localStorage:** none.

---

## 5. Config & Constants

### 5.1 `src/config/yokai.ts`

```tsx
export type Tier = "common" | "rare" | "epic" | "legendary";
export type YokaiName =
  | "kodama" | "hitodama" | "tanuki" | "kappa" | "kitsune"
  | "jorogumo" | "tengu" | "oni" | "raijin" | "ryujin" | "amaterasu";
```

| Export | Description |
|---|---|
| `interface YokaiType` | physics/display metadata: `id, name, kanji, radius, color, score, sprite, description` |
| `YOKAI_CHAIN: YokaiType[]` | 11-entry merge chain — physics source of truth |
| `SPAWNABLE_IDS` | `[1,2,3,4,5]` — only the first 5 can spawn |
| `getYokai(id)` | lookup by id → `YokaiType \| undefined` |
| `getNextYokai(id)` | entry with `id+1` |
| `getRandomSpawnable()` | random pick from `SPAWNABLE_IDS` |
| `YOKAI_ORDER: YokaiName[]` | canonical chain order, lowercase keys |
| `TIER_ORDER: Tier[]` | `["common","rare","epic","legendary"]` |
| `KANJI: Record<YokaiName, string>` | lowercase-keyed kanji |
| `ELEMENT_MAP: Record<YokaiName, string>` | yokai → element (Forest…Sun) |
| `AURORA_OPACITY: Record<Tier, number>` | `common 0.45 / rare 0.6 / epic 0.75 / legendary 0.9` |
| `BASE_LORE: Record<YokaiName, string>` | per-yokai lore strings |
| `TIER_FLAVOR: Record<Tier, string>` | per-tier description fragments |
| `buildNFTDescription(yokai, tier)` | `BASE_LORE[yokai] + "\n\n" + TIER_FLAVOR[tier]` |

### 5.2 `src/config/constants.ts`

```tsx
GAME_WIDTH = 470          GAME_HEIGHT = 720
WALL_THICKNESS = 20       PADDING = 20
CANVAS_WIDTH = 510        CANVAS_HEIGHT = 760
PLAY_OFFSET_X = 20        PLAY_OFFSET_Y = 20
GAME_OVER_LINE_Y = 120
GRAVITY = 1.5             BOUNCE = 0.45
FRICTION = 0.5            AIR_FRICTION = 0.01
DROP_COOLDOWN_MS = 500    GAME_OVER_GRACE_MS = 500
```

---

## 6. Routes

| Path | File | Notes |
|---|---|---|
| `/` | `app/page.tsx` | main game |
| `/dev/inventory` | `app/dev/inventory/page.tsx` → `DemoClient.tsx` | Stage 3.4 demo |
| `/dev/nft-cards` | `app/dev/nft-cards/page.tsx` → `DemoClient.tsx` | Stage 3.3 demo |
| `/dev/mint-ceremony` | `app/dev/mint-ceremony/page.tsx` → `DemoClient.tsx` | Stage 3.5 demo |

**Dev-route gating** — each `/dev/*` page is a thin Server Component with
`export const dynamic = "force-dynamic"` and
`if (process.env.NODE_ENV === "production") notFound()`. Vercel builds set
`NODE_ENV=production` → the public deployment serves 404 on these routes.
Each also sets `robots: { index: false, follow: false }`. The `dev/` prefix
is naming convention only; the runtime `notFound()` is the real gate.

`app/dev/layout.tsx` is **not a gate** — it injects a `<style>` block
(`!important` overrides) that undoes the game route's
`position:fixed; overflow:hidden` body lock so dev pages can scroll, and
forces a flat dark `#0a0d22` background.

`app/layout.tsx` (root) mounts, inside `<body>`: `<DebugConsole />`
(before the provider — self-gating on `?debug=1`), then `<Web3Provider>`
wrapping `<FarcasterUserBadge />` + `{children}`. `metadata` carries the
Farcaster `fc:miniapp` embed JSON, OpenGraph, Twitter card, PWA icons.

---

## 7. Game Engine Touchpoints

The UI↔engine boundary. `src/game/engine.ts` exports `class GameEngine`
and `type EngineCallbacks`.

```tsx
export type EngineCallbacks = {
  onScoreChange?: (score: number, highScore: number) => void;
  onNextChange?: (current: YokaiType, next: YokaiType) => void;
  onGameOver?: (finalScore: number) => void;
  onReachedChange?: (reachedIds: number[]) => void;
  onUnlockChange?: (unlockedIds: number[]) => void;
};

constructor(container: HTMLElement, callbacks: EngineCallbacks = {})
```

Callbacks are the **only** event mechanism — passed once at construction,
no add/remove listener API. The constructor fires the initial-state
callbacks immediately. **Score reaches the UI only via `onScoreChange`** —
there is no `getScore()`. Game-over is the `onGameOver(finalScore)`
callback (no polling getter).

UI-facing public methods:

```tsx
setSeasonSpawn(primary, fireflyMultiplier): void
setDropX(x: number): void
drop(): void
restart(): void
getCanvas(): HTMLCanvasElement
unlockAudio(): void
setBgmTrack(id): Promise<void>     getBgmTrack(): BgmTrackId | null
setMuted(b) / isMuted()
setSoundEnabled(b) / isSoundEnabled()
setMusicEnabled(b) / isMusicEnabled()
setSfxMuted(b) / isSfxMuted()
setBgmMuted(b) / isBgmMuted()
pause(): void                      resume(): void
destroy(): void                    // full teardown — call on unmount
// dev-only:
spawnYokaiById(id) / clearField() / setGodMode(b) / isGodMode() / unlockAll()
```

Engine reads `kamiMerge_highScore` from localStorage and seeds the
unlocked collection. Audio/BGM/season methods delegate to the engine's
private `AudioManager` / `ParticleSystem`.

**Other `src/game/` modules:**
- `bgmTracks.ts` — `type BgmTrackId`, `type BgmTrack`, `BGM_TRACKS` (4-track
  registry), `loadStoredTrack()` / `saveTrack()` (localStorage
  `kami_bgm_track`), `pickRandomTrack()`, `getBgmTrack(id)`.
- `particles.ts` — `abstract class Particle` + `SakuraPetal`, `Firefly`,
  `MapleLeaf`, `Snowflake`, and `class ParticleSystem`.
- `seasons.ts` — `enum Season`, `type ParticleKind`, `type SeasonConfig`,
  `SEASON_CONFIG`, `CYCLE_DURATION_SEC`, `TINT_FADE_MS`, `MAX_PARTICLES`,
  `getCurrentSeason()`, `cycleSeason()`, `subscribe(cb)`.
  **Season cycling is deactivated** — `getCurrentSeason()` always returns
  `Season.HARU`, `cycleSeason()` is a no-op, `subscribe()` never fires.

---

## 8. Build & Dependencies

### 8.1 `next.config.ts`

Only `allowedDevOrigins` (Turbopack cross-origin dev-resource allowlist):
`172.20.10.4`, `172.20.10.0/24`, `192.168.0.0/16`, `10.0.0.0/8`,
`localhost`, `127.0.0.1`. No `images` / `webpack` / `turbopack` /
`experimental` config.

### 8.2 `package.json`

**dependencies:** `@farcaster/miniapp-sdk ^0.2.3` ·
`@farcaster/miniapp-wagmi-connector ^1.1.1` ·
`@rainbow-me/rainbowkit ^2.2.10` · `@supabase/supabase-js ^2.105.1` ·
`@tanstack/react-query ^5.99.2` · `matter-js ^0.20.0` · `next 16.2.4` ·
`react 19.2.4` · `react-dom 19.2.4` · `viem ^2.48.2` · `wagmi ^2.19.5`

**devDependencies:** `@tailwindcss/postcss ^4` · `@types/matter-js ^0.20.2`
· `@types/node ^20` · `@types/react ^19` · `@types/react-dom ^19` ·
`supabase ^2.96.0` · `tailwindcss ^4` · `typescript ^5`

**scripts:** `dev` → `next dev` · `build` → `next build` · `start` →
`next start`

### 8.3 `tsconfig.json`

Path alias `"@/*": ["./src/*"]` — `@/` resolves to `src/`. `exclude`
lists `node_modules`, `supabase/functions`.

---

## Appendix — `CLAUDE.md` discrepancies

`CLAUDE.md` predates current code. Verified differences:

| `CLAUDE.md` says | Actual code |
|---|---|
| Yokai radii `17,24,32,38,48,56,66,76,88,102,120` | `20,28,37,44,55,64,76,87,101,117,138` (`yokai.ts`) |
| Game area `390×600` | `470×720` (`constants.ts`) |
| `BOUNCE` `0.3` | `0.45` |
| Game-over grace `3 s` | `GAME_OVER_GRACE_MS = 500` ms |
| Game-over line `y=110` | `GAME_OVER_LINE_Y = 120` |
| "Phase 0-1, no sprites/sound/wallet" | Real sprites, full audio (SFX+BGM), wallet/wagmi/Farcaster, mock NFT inventory, dev demo routes — Phases 2–3 work already shipped |
