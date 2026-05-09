# Kami Merge — Style Audit Report

Generated: 2026-05-04
Files scanned: **31** (in `app/` + `src/`; configs: `postcss.config.mjs`. Tailwind v4 — no `tailwind.config.*` file, theme imported via `@import "tailwindcss"` directive.)

---

## Summary

- **47 unique hex colors** (top 5 below; full table further down)
- **50 unique `rgba()` literals**
- **2 unique font-family stacks** (Georgia serif + ui-monospace) — both system, no `next/font`, no Google Fonts
- **20 unique font-size signals** mixing Tailwind `text-xs..6xl`, inline px integers (11/12/13/14/16/22/28/32), and arbitrary `text-[0.6rem]` / `text-[0.65rem]`
- **8 unique letter-spacing values** spread across `tracking-wider`, six `tracking-[Xem]` arbitraries, and four inline strings
- **5 unique line-height literals** (`leading-tight`/`-none`/`-relaxed` + inline `1`/`1.1`/`1.7`/`0`)
- **Spacing:** Tailwind scale used cleanly (every numeric utility is `0.5 / 1 / 1.5 / 2 / …` — all multiples of 4px). Off-grid `px` literals are confined to **borders (1–2 px)**, **animation offsets (5 px)**, and a handful of one-off inline values (`borderRadius: 6`, `padding: 3px`, wooden-rod heights `8 / 14`).
- **Border-radius:** 6 idioms (`rounded-full`, `rounded-md`, `rounded`, `rounded-lg`, `rounded-t-md`, plus inline `50%` / `9999px` / `6`).
- **Shadows:** 5 unique `boxShadow` strings + 5 multi-line CSS `box-shadow` stacks + 6 `drop-shadow()` filters + 2 `text-shadow` declarations. No collisions / no near-duplicates.

### Top finding — token drift

`app/globals.css` declares **8 CSS custom properties** in `:root`. Only **one** (`--foreground`) is read anywhere in the codebase. The other seven (`--background`, `--gold`, `--gold-bright`, `--torii-red`, `--wood-dark`, `--wood-light`, `--parchment`) are **declared but never referenced** — every component re-encodes the same hex values inline.

| Declared token | Hex value | Hardcoded usage of the same hex | `var(--token)` usage |
|---|---|---|---|
| `--background` | `#0f0f23` | 1× (Tailwind `bg-[#0f0f1e]` — *note 1e ≠ 23, near-twin*) | 0 |
| `--foreground` | `#e8e0d0` | 1× | 1 |
| `--gold` | `#c8a84e` | **19×** | 0 |
| `--gold-bright` | `#f5e6c8` | **13×** (also `--parchment` is the *same hex*) | 0 |
| `--torii-red` | `#c0392b` | 1× | 0 |
| `--wood-dark` | `#3d2510` | **13×** | 0 |
| `--wood-light` | `#5c3a1e` | **13×** | 0 |
| `--parchment` | `#f5e6c8` | (same as `--gold-bright`) | 0 |

That's **~59 individual hardcoded inline encodings** of values for which a token already exists. This is the single highest-impact migration — replacing the literals with `var(--gold)` / `var(--wood-dark)` etc. would land 59 cleanups for a 6-token introduction (and collapse `--gold-bright` / `--parchment` duplication).

### Existing tokens (`app/globals.css:3–12`)

```css
:root {
  --background: #0f0f23;
  --foreground: #e8e0d0;
  --gold: #c8a84e;
  --gold-bright: #f5e6c8;
  --torii-red: #c0392b;
  --wood-dark: #3d2510;
  --wood-light: #5c3a1e;
  --parchment: #f5e6c8;   /* duplicate of --gold-bright */
}
```

---

## 1. Colors

### Most-used colors (top 12)

| Hex | Count | Sample locations | Suggested token | Drift? |
|---|---|---|---|---|
| `#c8a84e` | 19× | `globals.css:6` (token), `Settings.tsx`, `SplashScreen.tsx`, `GameCanvas.tsx`, `YokaiDetailCard.tsx`, `wood-btn` rule | `--gold-500` | ✅ existing `--gold` |
| `#8a6f28` | 14× | `Settings.tsx` (dividers), `SplashScreen.tsx` (wrong-network panel), `globals.css:222` (kami-title gradient stop), `YokaiDetailCard.tsx` | `--gold-700` | ❌ no token |
| `#f5e6c8` | 13× | `globals.css:7` (`--gold-bright`) + `:11` (`--parchment`), `SplashScreen.tsx`, `Settings.tsx`, `GameCanvas.tsx`, `FarcasterUserBadge.tsx`, gradients in `kami-title`, `scroll-panel`, `wooden-rod` | `--gold-50` | ✅ existing `--gold-bright` AND `--parchment` (duplicate) |
| `#5c3a1e` | 13× | `globals.css:10` (`--wood-light`), `wood-btn` rule, `Settings.tsx`, `YokaiDetailCard.tsx` | `--wood-700` | ✅ existing `--wood-light` |
| `#3d2510` | 13× | `globals.css:9` (`--wood-dark`), `wood-btn` rule, `Settings.tsx`, `YokaiDetailCard.tsx`, `FarcasterUserBadge.tsx` | `--wood-900` | ✅ existing `--wood-dark` |
| `#c8a04a` | 10× | `SplashScreen.tsx` wrong-network panel, danger line in `engine.ts`, several Tailwind arbitraries | `--gold-500` (collapse with `#c8a84e`?) | **near-twin** of `--gold` |
| `#ffffff` | 5× | particle highlights in `particles.ts`, kanji label in `engine.ts`, score plate fallbacks | n/a — pure white | — |
| `#f6c343` | 3× | merge particle colour, season tints | n/a — gameplay data | — |
| `#1a1a2e` | 3× | mainnet-launch dark indigo (CLAUDE.md spec, Mini App splashBackgroundColor) | `--bg-700` | **near-twin** of `--background` (`#0f0f23`) and `#0f0f1e` |
| `#f0a030` | 2× | Kitsune yokai sprite swatch in data registry | n/a — gameplay data | — |
| `#0f0f1e` | 2× | `app/layout.tsx` `<meta theme-color>`, `bg-[#0f0f1e]` body class | `--bg-900` | **near-twin** of `--background` (`#0f0f23`) |
| `#050510` | 2× | body fallback in `globals.css`, `bg_game.jpg` fallback | `--bg-1000` | — |

### Outliers — used **once**, candidates for consolidation or culling (33 total)

Yokai personality colours (data registry — keep, not UI tokens):

| Hex | Where | Notes |
|---|---|---|
| `#7ec87e` | `src/config/yokai.ts:21` (Kodama) | gameplay data |
| `#7ecae8` | `:32` (Hitodama) | gameplay data |
| `#c49a6c` | `:43` (Tanuki) | gameplay data |
| `#3a9e6e` | `:54` (Kappa) | gameplay data |
| `#9b59b6` | `:76` (Jorogumo) | gameplay data |
| `#e74c3c` | `:87` (Tengu) | gameplay data |
| `#8b1a1a` | `:98` (Oni) | gameplay data |
| `#f1c40f` | `:109` (Raijin) | gameplay data |
| `#5b8dcc` | `:120` (Ryujin) | gameplay data |
| `#ffefd5` | `:131` (Amaterasu) | gameplay data |

Season-system tints (data — keep):

| Hex | Where | Notes |
|---|---|---|
| `#ffb3d9`, `#ffb366`, `#b3d9c4`, `#cce6ff` | `seasons.ts` | season-tint colours |
| `#d14d2a`, `#c23a1c`, `#e07138`, `#eb9c4a` | `seasons.ts` | season particle tints |
| `#ffb7c5`, `#ff9eb5`, `#ffc1cc` | `particles.ts:22` | sakura petal palette |

Genuine UI outliers worth flagging:

| Hex | Where | Suggested action |
|---|---|---|
| `#ff9800` | `SplashScreen.tsx:390` (dev-mode banner) | tokenise as `--accent-warning` (only place it appears) |
| `#e87d3e` | `SplashScreen.tsx:323` (wrong-network ⚠ icon) | tokenise as `--accent-danger` or collapse with `#c0392b` (`--torii-red`) |
| `#6fd28a` | `GameCanvas.tsx:758` (WalletChip green status dot) | tokenise as `--accent-success` |
| `#3a3a6e` | `FarcasterUserBadge.tsx` (avatar fallback gradient mid-stop) | derive from `--bg-500` rather than literal |
| `#7a4e28` | `globals.css:249` (wooden-rod top stop) | wood scale `--wood-500` |
| `#6d4728`, `#4a2d15`, `#2a1a08` | `globals.css:270, 274` (wood-btn hover/active gradients) | wood scale: collapse to a `:hover` filter brightness offset rather than 3 dedicated stops |
| `#0f1626` | `app/layout.tsx:23` (Mini App splashBackgroundColor metadata) | **near-twin** of `--background` (`#0f0f23`) — pick one |
| `#4a4a4a` | `Settings.tsx` toggle off background | tokenise as `--neutral-600` or collapse with `--wood-900` |

### Full unique-hex count: **47**

Excluding the 11 yokai data colours and the 7 season/particle data colours, **29 colours are UI chrome**. Of those, the gold/wood/parchment/indigo families collapse cleanly into ~5 tokens each (see migration plan).

### `rgba()` outliers

50 unique `rgba()` literals. The recurrent base colours are:

- **Gold alpha tints** — 22 instances of `rgba(200, 168, 78, X)` or `rgba(200, 160, 74, X)` with X in `{0.12, 0.15, 0.18, 0.25, 0.3, 0.35, 0.4, 0.5, 0.55, 0.75}`. Two near-twin RGB triples (`200,168,78` = `#c8a84e` = `--gold`; `200,160,74` = `#c8a04a`). Suggested: tokenise as `rgba(var(--gold-rgb) / X)` or `color-mix(in srgb, var(--gold) X%, transparent)`.
- **Black scrims** — 13 instances of `rgba(0, 0, 0, X)` with X in `{0.3, 0.35, 0.4, 0.5, 0.55}`. Suggested: tokenise as `--scrim-{30,40,50}`.
- **Indigo plates** — `rgba(10, 10, 25, X)` with X in `{0.3, 0.4, 0.45, 0.55, 0.72}`. Suggested: collapse with the indigo background scale.
- **Wood alphas** — `rgba(92, 58, 30, X)` (`#5c3a1e` = `--wood-light`) and `rgba(138, 111, 40, X)` (`#8a6f28`). Should derive from `var(--wood-light-rgb)`.
- **Parchment alphas** — `rgba(245, 230, 200, X)` and `rgba(229, 214, 176, X)`. Should derive from `var(--gold-bright-rgb)`.

The "200, 168, 78" vs "200, 160, 74" near-twin gold (and the matching `#c8a84e` vs `#c8a04a` hex pair) is the single biggest source of accidental colour drift.

### Tailwind arbitrary-color frequency

| Class | Count |
|---|---|
| `text-[#5c3a1e]/60` | 6× |
| `text-[#3d2510]` | 6× |
| `via-[#8a6f28]/50` | 5× |
| `text-[#c8a84e]` | 4× |
| `text-[#f5e6c8]` | 3× |
| `border-[#8a6f28]/40` | 3× |
| `text-[#f5e6c8]/90` | 2× |
| `text-[#c8a84e]/60` | 2× |
| `text-[#c8a04a]` | 2× |
| `text-[#5c3a1e]/65` | 2× |
| `border-[#c8a04a]/70` | 2× |
| `bg-[#c8a84e]/25` | 2× |
| `bg-[#c8a04a]/10` | 2× |
| 9 single-occurrence variants | 1× each |

**Every** Tailwind arbitrary colour used today is a value already represented (or near-twin) in `:root`. Once tokens land, all 47 of these compress into `text-(--gold)/60` style references (Tailwind v4 supports `text-(--token)` arbitrary syntax) or into a `.text-gold-700` utility class.

---

## 2. Typography

### Font families found

| Family | Count | Files | Used for |
|---|---|---|---|
| `Georgia, "Times New Roman", "Hiragino Sans", "Yu Gothic", serif` | declared 2× in CSS (`html, body` + `.kami-serif` + `.kami-title`); applied via `kami-serif` class **across every component** | Latin + CJK fallback |
| `ui-monospace, Menlo, monospace` | 2× inline (`FarcasterUserBadge.tsx`, `GameCanvas.tsx` WalletChip) | wallet address (0x…) chips |

No `next/font` usage. No `<link>` to Google Fonts. No webfonts. Single design-system font family with a paired monospace for hex-address rendering.

### Font sizes found

Tailwind `text-*` utilities (count of usages):

| Tailwind class | Count |
|---|---|
| `text-sm` | 12× |
| `text-xs` | 11× |
| `text-base` | 8× |
| `text-xl` | 7× |
| `text-lg` | 6× |
| `text-4xl` | 3× |
| `text-2xl` | 2× |
| `text-3xl` | 1× |
| `text-5xl` | 1× |
| `text-6xl` | 1× |
| `text-[0.6rem]` | 4× |
| `text-[0.65rem]` | 4× |

Inline `style={{ fontSize: N }}` (raw px, all in `YokaiDetailCard.tsx`):

| Px | Count |
|---|---|
| 14 | 2× |
| 32, 28, 22, 16, 13, 12, 11 | 1× each |

**Issue:** `YokaiDetailCard.tsx` is the only component using inline numeric `fontSize`, and it uses **8 distinct sizes** (11, 12, 13, 14, 16, 22, 28, 32). These don't sit on a clean type scale (`14 → 16` is +14% but `22 → 28` is +27%). Likely candidates: collapse into the existing Tailwind scale (12 ≈ `text-xs`, 14 ≈ `text-sm`, 16 ≈ `text-base`, 22 ≈ `text-lg`/`text-xl`, 28 ≈ `text-2xl`, 32 ≈ `text-3xl`).

The `text-[0.6rem]` (≈ 9.6 px) and `text-[0.65rem]` (≈ 10.4 px) "very-small label" sizes don't have a Tailwind shorthand and could become a new role token (`--text-micro`) — they're consistently used for the "Made by Kody Productions" footer and the tiny "vN" version labels.

### Font weights found

| Weight | Count | Where |
|---|---|---|
| `font-bold` | 9× | `Settings.tsx`, `SplashScreen.tsx`, `kami-title`, headings throughout |
| `font-semibold` | 7× | `Settings.tsx`, `SplashScreen.tsx`, address display |
| `font-mono` | 2× | `Settings.tsx`, `DevPanel.tsx` |
| `font-medium` | 1× | `SplashScreen.tsx` (dev banner) |
| `font-light` | 1× | `SplashScreen.tsx` |
| inline `fontWeight: 700` | 1× | `YokaiDetailCard.tsx` (kanji heading) |
| inline `fontWeight: 600` | 1× | `FarcasterUserBadge.tsx` (avatar fallback initial) |

Effective set: **5 weights** (light, normal, medium, semibold, bold). Coverage looks intentional — only `font-light` (1×) is a one-off; could be removed.

### Letter-spacing

| Value | Count | Form |
|---|---|---|
| `0.05em` (`tracking-wider`) | 15× | Tailwind |
| `0.15em` (`tracking-[0.15em]`) | 7× | Tailwind arbitrary |
| `0.3em` (`tracking-[0.3em]`) | 3× | Tailwind arbitrary |
| `0.2em` (`tracking-[0.2em]`) | 3× | Tailwind arbitrary |
| `2px` (≈ 0.125em at 16px) | 2× | inline |
| `0.04em` | 2× | inline |
| `0.25em` (`tracking-[0.25em]`) | 1× | Tailwind arbitrary |
| `0.1em` (`tracking-[0.1em]`) | 1× | Tailwind arbitrary |
| `0.08em` (`tracking-[0.08em]`) | 1× | Tailwind arbitrary |
| `0.05em` | 1× | inline |
| `0.02em` | 1× (CSS, in `.kami-title`) | CSS |
| `tracking-tight` (-0.025em) | 1× | Tailwind |

**8+ unique values for a single design system.** The `0.15em` / `0.2em` / `0.3em` triplet alone covers 13 of 36 tracked uses and reads as a "label spacing scale". The inline `2px` and `0.04em` should fold into Tailwind tokens.

### Line-height

| Value | Count | Form |
|---|---|---|
| `leading-tight` (1.25) | 6× | Tailwind |
| `leading-none` (1) | 6× | Tailwind |
| `leading-relaxed` (1.625) | 1× | Tailwind |
| inline `1.7` | 1× | YokaiDetailCard description copy |
| inline `1.1` | 1× | YokaiDetailCard kanji heading |
| inline `1` | 1× | FarcasterUserBadge initial |
| inline `0` | 1× | track-arrow buttons (icon-only) |

`leading-relaxed` (1.625) and inline `1.7` are very close — could collapse.

---

## 3. Spacing

### Off-grid values (not divisible by 4)

The repo uses Tailwind's spacing scale faithfully (every numeric utility seen is `0.5 / 1 / 1.5 / 2 / 3 / 4 / 5 / 6 / 8`, all 4 px aligned). Off-grid `px` literals are confined to the categories below — most are **legitimate non-spacing usages** that don't need to honour a 4 px grid.

| Value | Count | Category | File:line | Suggested replacement |
|---|---|---|---|---|
| `1px` | 24× | hairline borders | many | keep — borders are exempt from spacing grid |
| `2px` | 12× | shadow offsets, focus rings | mostly `globals.css` | keep |
| `5px` | 5× | particle radius, firefly drift transform offsets | `particles.ts`, `globals.css:331` | gameplay/animation — keep |
| `6px` | 4× | `borderRadius: 6` (Settings track-arrow), shadow offsets | `Settings.tsx:160` | **8 px** would be on-grid (collapses with `rounded-md`) |
| `3px` | 4× | `padding:3px` (Settings inline), shadow blurs | `Settings.tsx:71`, `globals.css` | **4 px** for the padding case; shadow blurs OK |
| `10px` | 4× | drop-shadow blur radii | `YokaiDetailCard.tsx:84` etc. | keep — shadow blur exempt |
| `9999px` | 2× | rounded-pill borderRadius | `Settings.tsx`, `FarcasterUserBadge.tsx` | use `rounded-full` token |
| `14px` | 2× | wooden-rod heights (top: 8 / bottom: 14) | `YokaiDetailCard.tsx:113, 240` | **12 px or 16 px** for grid alignment, or document as design intent |
| `18px` | 1× | drop-shadow blur radius | YokaiDetailCard | keep |
| `30px` | 1× | season-badge animation translateY | seasons | keep |
| `50px` | 1× | swipe-distance threshold | YokaiDetailCard | gameplay code — keep |
| `138px` | 1× | Amaterasu yokai radius | yokai data | gameplay data — keep |

**Genuine spacing off-grid violations: 2 instances** (`borderRadius: 6` and `padding: 3px`). Both in `Settings.tsx`. Trivial to fix.

The 4 px grid is otherwise well-respected. No migration urgency.

---

## 4. Border radius

| Value | Count | Where |
|---|---|---|
| `rounded-full` | 9× | mute icon, settings gear, FarcasterUserBadge chip | 
| `rounded-md` | 6× | Tap-to-Start button, ToggleRow, DevPanel buttons |
| `rounded` (= 4 px) | 6× | Settings yokai tiles, secondary buttons |
| `rounded-lg` | 3× | YokaiDetailCard panel, Settings scroll panel |
| `rounded-t-md` | 1× | DevPanel pull tab |
| inline `borderRadius: "50%"` | 3× | avatar circles, status dot — **same as `rounded-full`** |
| inline `borderRadius: "9999px"` | 2× | toggle pill, FarcasterUserBadge — **same as `rounded-full`** |
| inline `borderRadius: 9999` | 1× | toggle thumb — **same as `rounded-full`** |
| inline `borderRadius: 6` | 1× | Settings track arrow — **off-grid; 4 or 8 instead** |
| `borderRadius: "medium"` | 1× | RainbowKit theme prop, not CSS |

**6 effective radii** (`full`, `lg`, `md`, base `4`, `t-md`, plus the off-grid `6`). 6 inline `50%` / `9999px` instances should swap to `rounded-full` for consistency. The single `borderRadius: 6` should become `4` or `8`.

---

## 5. Shadows

### Inline `boxShadow` values

| Value | Count |
|---|---|
| `0 0 14px rgba(200,160,74,0.18)` | 2× (Tap-to-Start button, glow ring) |
| `0 0 0 1px rgba(200, 168, 78, 0.4)` | 2× (FarcasterUserBadge avatar ring) |
| `0 1px 2px rgba(0, 0, 0, 0.3)` | 1× (toggle thumb) |
| `0 0 6px rgba(200,168,78,0.12)` | 1× (WalletChip pill) |
| `0 0 4px rgba(111,210,138,0.8)` | 1× (WalletChip green status dot) |

### CSS `box-shadow` stacks (multi-line, in `globals.css`)

| Selector | Shadow stack |
|---|---|
| `.scroll-panel` | `inset 0 0 20px rgba(92, 58, 30, 0.15), 0 8px 24px rgba(0, 0, 0, 0.5)` |
| `.wooden-rod` | `0 2px 4px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(245, 230, 200, 0.2)` |
| `.wood-btn` | `inset 0 1px 0 rgba(245, 230, 200, 0.15), 0 2px 4px rgba(0, 0, 0, 0.5)` |
| `.wood-btn:active` | `inset 0 1px 2px rgba(0, 0, 0, 0.5), 0 1px 2px rgba(0, 0, 0, 0.4)` |
| `.score-plate` | `inset 0 1px 0 rgba(200, 168, 78, 0.15), 0 2px 6px rgba(0, 0, 0, 0.4)` |

### `drop-shadow()` filters

| Value | Where |
|---|---|
| `drop-shadow(0 0 10px rgba(26,21,40,0.85)) drop-shadow(0 0 18px rgba(26,21,40,0.55))` | YokaiDetailCard sprite (alpha-aware glow) |
| `drop-shadow(0 0 4px rgba(200,168,78,0.4))` | yokai chain preview thumbnails |
| `drop-shadow(0 0 4px rgba(200,168,78,0.5))` | engine canvas next-up sprite |
| `drop-shadow(0 0 3px rgba(200,168,78,0.5))` | Settings catalogue tile |
| `drop-shadow(0 1px 2px rgba(0,0,0,0.5))` | particle text shadow in canvas |

### `text-shadow`

| Value | Where |
|---|---|
| `0 2px 8px rgba(200, 168, 78, 0.25)` | `.kami-title` |
| `0 1px 3px rgba(0,0,0,0.5)` | inline (TextShadow on score numbers) |

**Total unique shadow recipes: ~13.** No accidental near-duplicates worth collapsing — each shadow has a distinct visual purpose (rim glow vs ring vs base shadow). Tokenisation here is more about *naming* (`--shadow-glow-gold`, `--shadow-card-base`, `--shadow-press-inset`) than collapsing.

---

## Recommended migration plan

### 1. Color token set (proposed `:root` block to replace current 8-token block)

```css
:root {
  /* ── Background scale ── */
  --bg-1000: #050510;   /* body fallback                       — 2× */
  --bg-900:  #0f0f1e;   /* page bg / theme-color meta          — 2× */
  --bg-800:  #0f0f23;   /* (was --background) — collapse to 900? */
  --bg-700:  #1a1a2e;   /* CLAUDE.md spec, Mini App splash bg  — 3× */

  /* ── Foreground / text default ── */
  --fg-base: #e8e0d0;   /* was --foreground                    — 1× */

  /* ── Gold scale (warm-gold UI palette) ── */
  --gold-50:   #f5e6c8; /* was --gold-bright + --parchment     — 13× */
  --gold-200:  #c8a84e; /* (was --gold) — primary accent       — 19× */
  --gold-300:  #c8a04a; /* near-twin of gold-200 — keep? merge? — 10× */
  --gold-700:  #8a6f28; /* dark gold — borders, dividers       — 14× */

  /* ── Wood scale ── */
  --wood-500: #7a4e28;  /* (only in wooden-rod gradient)       — 1× */
  --wood-700: #5c3a1e;  /* was --wood-light                    — 13× */
  --wood-900: #3d2510;  /* was --wood-dark                     — 13× */

  /* ── Accent / status ── */
  --accent-success: #6fd28a;  /* WalletChip status dot        — 1× */
  --accent-warning: #ff9800;  /* dev-mode banner               — 1× */
  --accent-danger:  #c0392b;  /* was --torii-red               — 1× (live)
                                 + #e87d3e (1×) — collapse?    */

  /* ── Alpha helpers (to replace 50 unique rgba literals) ── */
  --gold-rgb:  200 168 78;
  --wood-rgb:   92 58 30;
  --black-rgb:   0  0  0;
  --indigo-rgb: 10 10 25;
}
```

Once the alpha helpers exist, the 50 unique `rgba()` literals collapse to `rgba(var(--gold-rgb) / 0.4)` style references, and Tailwind v4 arbitrary-token syntax (`bg-(--gold-200)/40`) lets the `bg-[#c8a84e]/25` class become `bg-(--gold-200)/25`.

**Decision points** (also see "Open questions" below):
- `#c8a84e` vs `#c8a04a` — keep both as `--gold-200` / `--gold-300` (visually distinct)? or merge to one `--gold-200`?
- `#0f0f23` vs `#0f0f1e` vs `#1a1a2e` vs `#0f1626` — these are 4 near-twin "dark indigo" backgrounds. The Mini App embed metadata uses `#0f1626`, the body fallback uses `#0f0f1e` / `#050510`, the CLAUDE.md spec calls for `#1a1a2e`, and the existing token says `#0f0f23`. **Pick one canonical and consolidate.**

### 2. Typography roles

Single font family — `kami-serif` is already the canonical class. Suggested role tokens:

| Role | Tailwind | Inline px | Inline rem | Used for |
|---|---|---|---|---|
| `--text-display` | `text-5xl/6xl` | 48–60 | 3–4 | Splash title (`.kami-title`) |
| `--text-h1` | `text-3xl/4xl` | 30–36 | ~2 | Settings panel heading, YokaiDetailCard kanji |
| `--text-h2` | `text-xl/2xl` | 20–24 | 1.25–1.5 | Section headings (Sound/Music/Yokai Collection) |
| `--text-h3` | `text-lg` | 18 | 1.125 | Subsection labels |
| `--text-body` | `text-base` | 16 | 1 | YokaiDetailCard description copy, default body |
| `--text-label` | `text-sm` | 14 | 0.875 | Track names, button labels |
| `--text-small` | `text-xs` | 12 | 0.75 | Cards' tiny labels, version text |
| `--text-micro` | `text-[0.65rem]` | ~10.4 | 0.65 | "Made by Kody Productions" footer, "v0.1" version |

Letter-spacing roles:

| Role | Value | Used for |
|---|---|---|
| `--tracking-tight` | -0.025em | n/a (1× outlier — could remove) |
| `--tracking-normal` | 0.02em | `.kami-title` |
| `--tracking-wide` | 0.05em (= `tracking-wider`) | default headings |
| `--tracking-label` | 0.15em | secondary labels |
| `--tracking-cap` | 0.2em | uppercase H2 |
| `--tracking-spaced` | 0.3em | kanji subtitles |

Line-height roles:

| Role | Value | Used for |
|---|---|---|
| `--leading-none` | 1 | icon-only, kanji glyph alignment |
| `--leading-tight` | 1.25 | headings |
| `--leading-body` | 1.6–1.7 | description paragraphs |

### 3. Spacing — already on 4 px grid

The Tailwind scale is used cleanly. Two genuine off-grid violations (`borderRadius: 6` and `padding: 3px` in `Settings.tsx`). Negligible migration cost — leave the grid as-is.

### 4. Top 10 files by hardcode count (refactor priority order)

| Rank | File | Hex count | Priority |
|---|---|---|---|
| 1 | `app/globals.css` | 26 | Highest — declares the tokens; refactor first to seed correct shape |
| 2 | `src/components/Settings.tsx` | 21 | High — most arbitrary Tailwind classes |
| 3 | `src/components/GameCanvas.tsx` | 21 | High — HUD chrome + WalletChip |
| 4 | `src/components/SplashScreen.tsx` | 15 | Medium — wrong-network panel + dev banner |
| 5 | `src/config/yokai.ts` | 11 | **Skip** — gameplay data, not UI |
| 6 | `src/game/particles.ts` | 9 | **Skip** — gameplay data |
| 7 | `src/game/engine.ts` | 7 | Medium — danger line, white kanji label |
| 8 | `src/components/YokaiDetailCard.tsx` | 7 | Medium — also has all 8 inline fontSize values |
| 9 | `src/components/FarcasterUserBadge.tsx` | 6 | Low — small component, isolated palette |
| 10 | `src/game/seasons.ts` | 4 | **Skip** — gameplay data |

After excluding the 3 "data" files, **6 UI files** carry the entire migration load. ~85 hardcoded encodings → ~12 tokens.

---

## Open questions for user

Ten specific decisions before refactor begins:

1. **Two near-twin golds** (`#c8a84e` 19× vs `#c8a04a` 10×) — keep both or merge to one? They're visually distinguishable side-by-side but probably look identical in flow.
2. **Two declared tokens hold the same hex** (`--gold-bright` and `--parchment` both = `#f5e6c8`). Pick one name and delete the other.
3. **Four dark-indigo near-twins** (`#0f0f23` `--background`, `#0f0f1e` body bg, `#1a1a2e` CLAUDE.md spec / Mini App splashBackgroundColor, `#0f1626` Mini App embed) — which is the **single canonical "page background"**?
4. **`--torii-red`** (`#c0392b`) was declared as a system colour but only used once. Compare with `#e87d3e` (warning ⚠ icon, also 1×) — collapse to a single `--accent-danger`, or keep separate?
5. **`text-[0.6rem]` (4×) and `text-[0.65rem]` (4×)** are both "very small". Are they meant to be the same role with two slightly-different values, or genuinely different? If the same, pick one and migrate.
6. **`YokaiDetailCard.tsx` inline font sizes** (8 distinct: 11/12/13/14/16/22/28/32) — collapse into the existing Tailwind scale, or treat the lore card as a special typography surface with its own scale?
7. **Letter-spacing scale: 8 values seen.** The `0.15em` / `0.2em` / `0.3em` triplet is consistent and frequent. Drop the one-offs (`0.04em`, `0.05em`, `0.08em`, `0.1em`, `0.25em`, `2px`)?
8. **`leading-relaxed` (1.625) vs inline `1.7`** (used in YokaiDetailCard description) — collapse to one body line-height token?
9. **Wood gradient stops** — `wood-btn` uses 4 distinct stops in three states (`#5c3a1e`/`#3d2510`/`#6d4728`/`#4a2d15`/`#2a1a08`). Keep all 5 wood stops, or replace hover/active gradients with `filter: brightness()` modifiers on the base gradient?
10. **Tailwind v4 token syntax** — once tokens land, do you want components to use `bg-(--gold-200)/40` style classes (Tailwind v4 native) or stay with the existing `style={{ background: "rgba(var(--gold-rgb) / 0.4)" }}` inline pattern? The first is more idiomatic with the current setup; the second keeps gradients/multi-line shadows clean.

---

*End of audit. Stopping here per task instructions — no source files modified.*
