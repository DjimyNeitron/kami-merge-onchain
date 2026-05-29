# Kami Merge — Design System

**Version:** 1.0
**Date:** 2026-05-28
**Main HEAD:** `de88471` — *Stage 3.5L: wire MintCeremony into game-over flow*

> **Single source of truth — reconciled to `app/globals.css` @ `de88471`.**
> Every hex / value in this document is verbatim from shipped CSS. Aspirational tokens
> live in the [FUTURE](#future--not-shipped) section, never above it. See the
> [Divergence log](#divergence-log) for what was reconciled away from the pre-ship draft.

---

## 1. Color tokens

All defined in `app/globals.css` `:root`.

### 1.1 Background ramp

| Token | Value | Used for |
|---|---|---|
| `--bg-deepest` | `#050510` | body fallback (behind `bg_game.jpg`) |
| `--bg-base` | `#0f0f1e` | page bg |
| `--bg-elev` | `#1a1a2e` | cards, modals, elevated surfaces |

### 1.2 Foreground

| Token | Value | Used for |
|---|---|---|
| `--fg-base` | `#e8e0d0` | default text on dark bg |

### 1.3 Gold scale (single canonical UI gold)

| Token | Value | Used for |
|---|---|---|
| `--gold-50` | `#f5e6c8` | highlight gold / parchment text |
| `--gold-200` | `#c8a04c` | **DEFAULT UI gold ★** — buttons, labels, accents |
| `--gold-700` | `#8a6f28` | dark gold — borders, dividers |

The three-stop scale powers the gradient-clip title (`.kami-title`: `gold-50 → gold-200 → gold-700`). Pre-merge drift was `#c8a84e` / `#c8a04a`; both were folded into `#c8a04c`.

### 1.4 Wood scale (frame, buttons)

| Token | Value | Used for |
|---|---|---|
| `--wood-light` | `#5c3a1e` | wood gradient top |
| `--wood-dark` | `#3d2510` | wood gradient bottom |

Consumed by `.wood-btn`, `.wooden-rod`, `.scroll-panel` overlay.

### 1.5 NFT tier accents — **ascending gold warmth, common → legendary**

| Token | Value | Tier role |
|---|---|---|
| `--tier-common` | `#b49656` | dim bronze-gold |
| `--tier-rare` | `#d2a769` | mid gold |
| `--tier-epic` | `#ebc36e` | bright gold |
| `--tier-legendary` | `#ffda6e` | fully saturated gold |

Consumed by MintCeremony's slot drum + tier banner, and any future tier-coloured UI. Set per-instance via `--tier-current` (e.g. `["--tier-current"]: \`var(--tier-${tier})\``) so a single component can paint per rarity. **There is no multi-hue rarity system shipped** — see the Divergence log.

### 1.6 Cultural / status accents

| Token | Value | Used for |
|---|---|---|
| `--torii-red` | `#c0392b` | sacred-gate red — cultural accent, **not** semantic danger |
| `--accent-success` | `#6fd28a` | success |
| `--accent-warning` | `#e87d3e` | warning |
| `--accent-error` | `#d96b6b` | error / semantic danger |

### 1.7 RGB-triple helpers (for `rgba(var(--x) / a)` syntax)

| Token | Value |
|---|---|
| `--gold-rgb` | `200 160 76` |
| `--wood-rgb` | `92 58 30` |
| `--indigo-rgb` | `15 15 30` |
| `--black-rgb` | `0 0 0` |

No `--gold-50-rgb`. Two call-sites in `globals.css` use the literal triple `245 230 200` for highlight-gold alpha (`.wooden-rod`'s inset top-light + `.wood-btn`'s inset highlight) — see [FUTURE](#future--not-shipped).

---

## 2. Typography

### 2.1 Font stacks

| Class | Stack |
|---|---|
| `body` (root) | `Georgia, "Times New Roman", "Hiragino Sans", "Yu Gothic", serif` |
| `.kami-serif` | `Georgia, "Times New Roman", "Hiragino Sans", "Yu Gothic", serif` |
| `.kami-title` | `Georgia, "Times New Roman", serif` (no CJK fallback; Latin-only — used on gradient-clipped game title) |
| Ceremonial kanji (e.g. `.silhouetteKanji`, `.rune`, `.successKanjiInline` in `MintCeremony.module.css`) | `"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif CJK JP", serif` |

**Design intent:**
- Global root: Latin serif (Georgia) with **sans** CJK fallback (Hiragino Sans / Yu Gothic) — keeps incidental Japanese like `設定` or `妖怪` readable in a clean sans face when no explicit stack is set.
- Ceremonial: explicitly opt into **Mincho** (CJK serif) inside ceremony modules to treat kanji as ritual / art.

There are **no `--font-*` CSS variables**; font stacks are inline literals.

### 2.2 Letter-spacing (`--tracking-*`)

| Token | Value |
|---|---|
| `--tracking-normal` | `0.02em` |
| `--tracking-wide` | `0.05em` |
| `--tracking-extra` | `0.1em` |
| `--tracking-label` | `0.15em` |
| `--tracking-cap` | `0.2em` |
| `--tracking-spaced` | `0.3em` |

### 2.3 Line-height

| Token | Value | Notes |
|---|---|---|
| `--leading-tight` | `1.25` | |
| `--leading-body` | `1.625` | matches Tailwind `leading-relaxed` |

`.kami-title` overrides `line-height: 1.15` locally (descender room under `background-clip: text`).

---

## 3. Shadows

| Token | Value |
|---|---|
| `--shadow-sm` | `0 2px 8px rgba(var(--black-rgb) / 0.3)` |
| `--shadow-md` | `0 8px 24px rgba(var(--black-rgb) / 0.5)` |
| `--shadow-lg` | `0 16px 48px rgba(var(--black-rgb) / 0.65)` |
| `--shadow-glow-gold` | `0 0 24px rgba(var(--gold-rgb) / 0.3)` |
| `--shadow-glow-legendary` | `0 0 32px rgba(255 215 130 / 0.45)` |

`--shadow-glow-legendary` uses a literal RGB triple `255 215 130` (a touch lighter than `--tier-legendary` `#ffda6e` = `255 218 110`) — accepted as glow-specific drift.

---

## 4. Component classes (`globals.css`)

| Class | Behaviour summary |
|---|---|
| `.app-shell` | Full-viewport flex column, `100dvh`, safe-area insets, hidden overflow, transparent bg over `body`'s `bg_game.jpg` layer |
| `.kami-serif` | Shared Latin serif + CJK sans fallback |
| `.kami-title` | Gold gradient-clip text (`gold-50 → gold-200 → gold-700`), `tracking-normal`, `line-height: 1.15`, `text-shadow: 0 2px 8px rgba(var(--gold-rgb) / 0.25)` |
| `.icon-btn` | Hover `scale(1.05)`, active `scale(0.97)`, `transition: opacity 0.15s, transform 0.15s` |
| `.track-arrow-btn` | Chevron — dims on hover/active, `cursor: not-allowed` when disabled |
| `.scroll-panel` | Parchment background — woven `wood-rgb` stripe pattern over `linear-gradient(gold-50 → #ede0c0 → #e5d6b0)`, `box-shadow: inset 0 0 20px rgba(var(--wood-rgb) / 0.15), var(--shadow-md)` |
| `.wooden-rod` | Vertical `linear-gradient(wood-light → wood-dark)`, drop shadow + inset top highlight |
| `.wood-btn` | Vertical `linear-gradient(wood-light → wood-dark)`, `color: var(--gold-200)`, `border: 1px solid rgba(var(--gold-rgb) / 0.35)`, **hover `filter: brightness(1.18)`**, **active `filter: brightness(0.55)` + `translateY(1px)`** |
| `.score-plate` | `rgba(var(--indigo-rgb) / 0.55)` bg, gold border `rgba(var(--gold-rgb) / 0.4)`, `backdrop-filter: blur(4px)` |
| `.lantern-glow` | 60 px radial orange glow, flickers via `lantern-flicker` |
| `.firefly-glow` | 20 px radial warm glow, drifts via `firefly-drift` |
| `.splash-pulse` | Infinite 2 s opacity pulse (tap-to-start button) |
| `.animate-splash-fade` | One-shot 0.4 s opacity fade-in |
| `.season-badge-anim` | Fade + slide-in via `season-badge-in` (currently dormant per `app/page.tsx`) |
| `.yokai-card-fade-in` / `.yokai-card-fade-out` | Lore-card enter/exit (drives nested `.scroll-panel-wrapper`) |

Two parchment shades inside `.scroll-panel` are literal (`#ede0c0`, `#e5d6b0`) — intentional darkening of `--gold-50` to give the woven-paper sheen; tokenising adds two near-whites for no consumer.

### 4.1 Parchment literals (intentional, scoped)

| Hex | Use | Why literal |
|---|---|---|
| `#ede0c0` | `.scroll-panel` mid stop | Slight darkening of `--gold-50`; single-use |
| `#e5d6b0` | `.scroll-panel` bottom stop | Slight darkening of `--gold-50`; single-use |

---

## 5. Component CSS modules (scoped)

Three component-scoped stylesheets:

### 5.1 `NFTCard.module.css`
Owns the holo + tier-opacity vars (`--aurora-op`, `--aurora-streak-op`, `--sparkle-op`) on `.tierCommon/Rare/Epic/Legendary`. Card root carries `data-tier` + `data-yokai` + `role="img"` so outside overlays can scope styles via `:global([role="img"])` without modifying the (locked) component.

### 5.2 `MintCeremony.module.css`
- **Scene-level literals** outside the token system:

| Hex | Use |
|---|---|
| `#0e1a2e` | `.ceremonyScene` background — deeper than `--bg-base` for the moonlit pond mood |
| `#fff8e0` | `.fireflyCoreGold` core — warm white |
| `#ffd9a8` | `.fireflyCoreAmber` core — warm peach |

- **Tier system usage:** every tier-coloured element reads `var(--tier-current, var(--gold-700))` or `var(--tier-current, var(--gold-200))`; `--tier-current` is set per-render in TSX as `var(--tier-${tier})`.
- **Vignette** uses `rgba(6, 10, 22, …)` literals at four alpha stops — a scene-specific cool-near-black not in `:root`.
- **Module-only keyframes:** `petal-fall`, `petal-drift`, `petal-wobble`, `success-aura-breathe`, `drift-sparkle`, `success-flash`, `sparkle-burst`, `success-overlay-in`, `fade-in`, `fade-in-soft`, `anticipation-fade`, `card-success-pulse`, `spin`, `mint-pulse`, `firefly-pulse`.

### 5.3 `GameCanvas.module.css` *(added in PR #44)*
Owns the ceremony **wrapper** (the MintCeremony itself is mounted as a child):

| Class | Role |
|---|---|
| `.ceremonyOverlay` | Fixed full-viewport container, `rgba(0,0,0,0.6)` + `backdrop-filter: blur(4px)`, **z-index 25** |
| `.ceremonyDismissBtn` | × button top-right, `rgba(15,22,38,0.6)` bg, `rgba(245,230,200,0.3)` border, **z-index 26**, hover lifts to `0.8` / `0.5` |
| `.motivationalMessage` | Below-`Best` line on the wood-scroll panel when `finalScore < MIN_MINT_SCORE` |
| `.motivationalJp` | Japanese subtitle (`もう一度 · Try again`) under it |

Module-only keyframe: `ceremony-overlay-in` (0.3 s fade-in).

---

## 6. Z-index map

| Layer | z |
|---|---|
| Body + `bg_game.jpg` | (default) |
| `.lantern-glow` / `.firefly-glow` | between body and canvas |
| Game HUD + main content | default in flow |
| Game-over wood-scroll panel | **20** |
| In-play mini Restart button | **21** (raised within the panel) |
| Ceremony overlay container | **25** |
| Ceremony × dismiss button | **26** |
| Settings modal | **(set by component, above all)** |
| Success banner (inside ceremony) | **100** (scoped to ceremony) |

Inside the ceremony module: card silhouette 9, card wrapper 10, header 13, tier banner 14, success banner 100, success flash 5, drifting sparkles 8. Those are scoped under the ceremony container — they stack relative to it, not the page.

---

## 7. Motion (keyframes inventory)

### 7.1 Global (`app/globals.css`)
`yokaiCardEnter`, `yokaiCardExit`, `backdropEnter`, `backdropExit`, `season-badge-in`, `splash-pulse`, `splash-fade`, `lantern-flicker`, `firefly-drift`.

### 7.2 MintCeremony module
`fade-in`, `fade-in-soft`, `anticipation-fade`, `success-flash`, `sparkle-burst`, `success-aura-breathe`, `drift-sparkle`, `card-success-pulse`, `petal-fall` (pure linear `translateY`), `petal-drift`, `petal-wobble` (CSS `rotate` property), `firefly-pulse`, `spin`, `mint-pulse`.

### 7.3 GameCanvas module
`ceremony-overlay-in`.

All motion respects `@media (prefers-reduced-motion: reduce)` in the modules where it exists.

---

## 8. Spacing & layout

- **Game zone:** 470 × 720 logical (`GAME_WIDTH × GAME_HEIGHT` in `src/config/constants.ts`).
- **Canvas:** 510 × 760 (zone + 20 px `PADDING` per side).
- **Game-over line:** `GAME_OVER_LINE_Y = 120` (zone top + 100 px).
- **Game-over grace:** `GAME_OVER_GRACE_MS = 500`.
- **Drop cooldown:** `DROP_COOLDOWN_MS = 500`.
- **Mint button container** sits at `bottom: 160px` (allowance for the 140 px Startale chrome zone).
- **Safe-area:** `.app-shell` applies `env(safe-area-inset-*)` padding (top/bottom min 4 px, left/right insets).

There is no `--space-*` token scale; spacing is via Tailwind utilities + occasional inline `style`.

---

## 9. Tier rendering convention

For any tier-coloured element:
```tsx
<div style={{ ["--tier-current"]: `var(--tier-${tier})` } as React.CSSProperties} />
```
Then in CSS:
```css
color: var(--tier-current, var(--gold-200));
border-color: var(--tier-current, var(--gold-700));
```
The fallback to `--gold-200` / `--gold-700` covers the pre-roll / unknown-tier render path so the element never goes uncoloured.

---

## FUTURE — not shipped

Tokens worth adding when the design has multiple consumers; **do not** add until then.

| Proposed | Why | Current workaround |
|---|---|---|
| `--gold-50-rgb` (= `245 230 200`) | Two `globals.css` call-sites and several module-scoped places spell out `rgba(245, 230, 200, α)` for highlight-gold alpha. | Spelled out inline. |
| `--scene-night` (= `#0e1a2e`) | The ceremony scene background is one literal hex deeper than `--bg-base`; would be reused by any future "night mode" surface. | `#0e1a2e` literal in `MintCeremony.module.css`. |
| `--firefly-gold-core` (= `#fff8e0`), `--firefly-amber-core` (= `#ffd9a8`) | Pure scene atmospherics today. | Literals in `MintCeremony.module.css`. |
| Multi-hue rarity (silver / blue / purple / gold) | The pre-ship draft proposed this; the shipped system is ascending gold warmth. **Not adopted.** | Tier classes use the gold-gradient `--tier-common…legendary`. |

---

## Divergence log

What was reconciled away from the pre-ship draft, with the **shipped** value winning per the *code is truth* principle.

1. **Tier color system — fully replaced.**
   - Draft: multi-hue — common `#C0C0C0` (silver), rare `#4FB8E0` (blue), epic `#B567E0` (purple), legendary `#F5B83C`.
   - Shipped: ascending gold warmth — common `#b49656`, rare `#d2a769`, epic `#ebc36e`, legendary `#ffda6e`.
   - **Reasoning:** the `globals.css` block carries an explicit comment *"NFT tier accents — ascending gold warmth, common → legendary"*. The MintCeremony's slot-drum + tier-banner consumes them as a single warmth gradient; substituting multi-hue would re-paint the entire ceremony.

2. **`--gold-200` value.**
   - Draft: `#EBC36E`.
   - Shipped: `#c8a04c`.
   - **Likely cause:** the draft's `#EBC36E` *is* the shipped `--tier-epic`; the two were probably confused in transcription. Shipped value is canonical.

3. **`--torii-red` value.**
   - Draft: `#B8362C`.
   - Shipped: `#c0392b`.
   - Close visually; shipped wins by 4 RGB units across each channel.

4. **`GameCanvas.module.css` inline fallback drift** (recorded, not fixed in this task):
   - `color: var(--gold-200, #ebc36e);` (line 66) — the fallback `#ebc36e` does NOT match the actual `--gold-200` (`#c8a04c`); it matches `--tier-epic`. Runtime is fine because `--gold-200` is defined globally and wins; the fallback would only paint epic-gold if `globals.css` failed to load. Not a real bug, but a future cleanup (out of scope here — `GameCanvas.module.css` is locked from this docs-only task).
   - The sibling fallback `color: var(--gold-50, #f5e6c8);` on lines 41 / 76 matches `--gold-50` correctly.

5. **Font stacks — confirmed dual-track:**
   - Global root + `.kami-serif` use a **Hiragino *Sans* / Yu Gothic** CJK fallback.
   - Ceremonial kanji inside `MintCeremony.module.css` explicitly opt into **Hiragino Mincho ProN / Yu Mincho / Noto Serif CJK JP** (a CJK serif).
   - Earlier audits described the global stack as "Hiragino Mincho" — that was incorrect; only the ceremony uses Mincho.

6. **No `--font-*` token system.** All font stacks are inline literals; no central font register. Not a divergence from "draft" — but worth recording as the intentional shape of typography today.

7. **No `--space-*` token scale.** Spacing is utility-class driven (Tailwind) + inline. Same.

8. **Parchment mid/bottom literals (`#ede0c0`, `#e5d6b0`)** in `.scroll-panel` are intentional gradient stops, not divergence. Documented under §4.1.

---

*End of design system. Update this file as the canonical reference when `globals.css` or any component CSS module changes shipped tokens.*
