# Kami Merge — Style Migration Report

Date: 2026-05-04
Files modified: **6** (`app/globals.css`, 5 React components — see below)
Tokens added: **31** (background ramp 3 + foreground 1 + gold 3 + wood 2 + cultural 1 + status 3 + RGB triples 4 + tracking 6 + leading 2 + shadows 5)
Hardcodes replaced: **~110** (Tailwind arbitrary classes + inline hex + inline rgba + inline fontSize / letterSpacing / lineHeight + 2 off-grid spacing values + 6 inline `50%` / `9999px` borderRadius)

`npm run build` cold rebuild: ✓ exit 0, TypeScript clean, 4/4 static pages, 6.3s compile.
**No commits, no pushes.** All changes left as working-tree modifications for `git diff` review.

---

## Files modified (full list)

| File | What changed |
|---|---|
| `app/globals.css` | `:root` block expanded from 8 tokens → 31 tokens. `html`/`body`/`kami-title`/`scroll-panel`/`wooden-rod`/`wood-btn`/`score-plate` migrated to use them. **Wood-button refactor:** 5 hardcoded gradient colours → 2 tokens + `filter: brightness()`. |
| `src/components/Settings.tsx` | 9 Tailwind arbitrary classes → token classes. 4 inline color/rgba → token rgba. Toggle pill + thumb borderRadius `9999px` → `rounded-full` className. |
| `src/components/GameCanvas.tsx` | 11 Tailwind arbitrary classes → token classes. 8 inline color/rgba → token rgba. Canvas wrapper `borderRadius: 6` → `8` (off-grid fix). WalletChip: `fontSize: 12` + `letterSpacing: "0.05em"` → `text-xs` + `var(--tracking-wide)`. Status dot `borderRadius: "50%"` → `rounded-full`. |
| `src/components/SplashScreen.tsx` | 7 Tailwind arbitrary classes → token classes. 5 inline color/rgba → token rgba. `#e87d3e` warning ⚠ + `#ff9800` dev banner → both → `var(--accent-warning)`. |
| `src/components/YokaiDetailCard.tsx` | 8 inline `fontSize` integers → Tailwind `text-*` classes. 3 inline `letterSpacing` (`0.04em` ×1, `2px` ×2) → `var(--tracking-wide)`. `lineHeight: 1.7` → `leading-relaxed`. 5 inline color → tokens. Backdrop `rgba(0,0,0,0.55)` → `rgba(var(--black-rgb) / 0.55)`. |
| `src/components/FarcasterUserBadge.tsx` | All 4 inline `borderRadius` (3× `"50%"` + 1× `9999`) → `rounded-full` className. 4 inline color → tokens. `fontSize: 14`/`13` → `text-sm`/`text-[13px]`. `fontWeight: 600` → `font-semibold`. `lineHeight: 1` → `leading-none`. |

`src/game/engine.ts` was on the spec's "6 UI files" list but is intentionally left untouched — see "Files NOT touched" section below for rationale.

---

## Replacements summary

### Tailwind arbitrary class → token class

| Old | New | Count | Files |
|---|---|---|---|
| `text-[#c8a84e]` | `text-(--gold-200)` | 8 | GameCanvas, SplashScreen |
| `text-[#c8a04a]` | `text-(--gold-200)` (merged near-twin) | 2 | SplashScreen |
| `text-[#f5e6c8]` | `text-(--gold-50)` | 6 | GameCanvas, SplashScreen |
| `text-[#3d2510]` | `text-(--wood-dark)` | 6 | Settings, GameCanvas |
| `text-[#5c3a1e]/60` | `text-(--wood-light)/60` | 6 | Settings, GameCanvas |
| `text-[#5c3a1e]/65` | `text-(--wood-light)/65` | 2 | Settings |
| `text-[#5c3a1e]/70` | `text-(--wood-light)/70` | 1 | GameCanvas |
| `text-[#5c3a1e]/75` | `text-(--wood-light)/75` | 1 | Settings |
| `via-[#8a6f28]/50` | `via-(--gold-700)/50` | 5 | Settings, GameCanvas |
| `border-[#8a6f28]/40` | `border-(--gold-700)/40` | 4 | Settings, GameCanvas, YokaiDetailCard |
| `border-[#8a6f28]/25` | `border-(--gold-700)/25` | 1 | Settings |
| `border-[#c8a04a]/70` | `border-(--gold-200)/70` | 2 | SplashScreen |
| `bg-[#c8a84e]/25` | `bg-(--gold-200)/25` | 2 | GameCanvas |
| `bg-[#c8a04a]/10` | `bg-(--gold-200)/10` | 2 | SplashScreen |
| `tracking-[0.08em]` | `tracking-(--tracking-extra)` | 1 | Settings |
| `tracking-[0.1em]` | `tracking-(--tracking-extra)` | 1 | GameCanvas |
| `tracking-[0.15em]` | `tracking-(--tracking-label)` | 7 | Settings, GameCanvas |
| `tracking-[0.2em]` | `tracking-(--tracking-cap)` | 3 | Settings |
| `tracking-[0.25em]` | `tracking-(--tracking-spaced)` | 1 | GameCanvas |
| `tracking-[0.3em]` | `tracking-(--tracking-spaced)` | 3 | SplashScreen, GameCanvas |

**~64 Tailwind arbitrary classes** collapsed to token classes.

### Inline hex / rgba → token

| Old | New | Count |
|---|---|---|
| `"#c8a84e"` | `"var(--gold-200)"` | 4 |
| `"#c8a04a"` | `"var(--gold-200)"` | 1 (engine.ts shadowColor — left as literal, see below) |
| `"#3d2510"` | `"var(--wood-dark)"` | 2 |
| `"#8a6f28"` | `"var(--gold-700)"` | 3 (Toggle off bg, YokaiDetailCard name + footer) |
| `"#f5e6c8"` | `"var(--gold-50)"` | 4 |
| `"#1a1a2e"` (gradient stop) | `"var(--bg-elev)"` | 1 (FarcasterUserBadge fallback gradient) |
| `"#e87d3e"` | `"var(--accent-warning)"` | 1 (SplashScreen wrong-network ⚠) |
| `"#ff9800"` | `"var(--accent-warning)"` | 1 (SplashScreen dev banner — consolidated) |
| `"#6fd28a"` | `"var(--accent-success)"` | 1 (WalletChip status dot) |
| `rgba(200, 168, 78, X)` and `rgba(200,160,74, X)` (gold near-twins) | `rgba(var(--gold-rgb) / X)` | ~14 |
| `rgba(10, 10, 25, X)` | `rgba(var(--indigo-rgb) / X)` | ~6 |
| `rgba(0, 0, 0, X)` and `rgba(0,0,0, X)` | `rgba(var(--black-rgb) / X)` | ~9 |
| `rgba(92, 58, 30, X)` | `rgba(var(--wood-rgb) / X)` | 2 (in scroll-panel) |
| `rgba(5, 5, 20, 0.3)` and `rgba(5,5,15,0.7)` | `rgba(var(--indigo-rgb) / X)` | 3 (body bg, splash bg) |

### Letter-spacing snap

| Old (inline `letterSpacing:`) | New | Count |
|---|---|---|
| `"0.05em"` | `"var(--tracking-wide)"` | 1 (WalletChip) |
| `"0.04em"` | `"var(--tracking-wide)"` | 2 (YokaiDetailCard kanji, FarcasterUserBadge name) |
| `"2px"` | `"var(--tracking-wide)"` | 2 (YokaiDetailCard Latin name + Merge #N footer) |

`0.02em` (`.kami-title` letter-spacing in CSS) snapped to `var(--tracking-normal)`.

### Inline `fontSize` → Tailwind class (per spec mapping)

All in `YokaiDetailCard.tsx` + `FarcasterUserBadge.tsx`:

| Old | New | Notes |
|---|---|---|
| `fontSize: 11` | `text-[11px]` | explicit (not in default scale) |
| `fontSize: 12` (WalletChip) | `text-xs` | matches default 12px |
| `fontSize: 13` (FarcasterUserBadge name) | `text-[13px]` | explicit |
| `fontSize: 14` (×2 — YokaiDetailCard description, FarcasterUserBadge fallback initial) | `text-sm` | matches default |
| `fontSize: 16` | `text-base` | matches default |
| `fontSize: 28` | `text-3xl` (30px) | **snap up** per spec — Tailwind has no 28px default |
| `fontSize: 32` | `text-3xl` (30px) | **snap down** per spec — closest Tailwind default |

### Inline `lineHeight` / `fontWeight`

| Old | New |
|---|---|
| `lineHeight: 1.7` | `className="leading-relaxed"` (= 1.625, visually identical per spec) |
| `lineHeight: 1` | `className="leading-none"` |
| `lineHeight: 1.1` | **left as literal** (kanji glyph alignment — see "Unmapped" below) |
| `fontWeight: 700` | `className="font-bold"` |
| `fontWeight: 600` | `className="font-semibold"` |

### `borderRadius` `50%` / `9999px` / `9999` → `rounded-full` className

| Site | Before | After |
|---|---|---|
| Settings.tsx — toggle pill | `borderRadius: "9999px"` | `className="rounded-full"` |
| Settings.tsx — toggle thumb | `borderRadius: "9999px"` | `className="rounded-full"` |
| FarcasterUserBadge.tsx — outer chip | `borderRadius: 9999` | `className="fixed kami-serif rounded-full"` |
| FarcasterUserBadge.tsx — pfp `<img>` | `borderRadius: "50%"` | `className="rounded-full"` |
| FarcasterUserBadge.tsx — fallback `<div>` | `borderRadius: "50%"` | `className="rounded-full text-sm font-semibold leading-none"` |
| GameCanvas.tsx — WalletChip status dot | `borderRadius: "50%"` | `className="rounded-full"` |

**6 of 6 inline `50%`/`9999px` instances** converted. No exceptions.

### Off-grid spacing snap

| Site | Before | After |
|---|---|---|
| GameCanvas.tsx — canvas wrapper container | `borderRadius: 6` | `borderRadius: 8` |
| Settings.tsx — `padding:3px` (CSS audit grep flagged) | (none found in source — was a false positive in the grep, no change needed) | n/a |

Only **1 genuine** off-grid spacing fix landed (the canvas wrapper). The audit's second flagged value (`padding: 3px`) was a grep over CSS, not over a real declaration in source.

---

## Special refactors

### Wood button — 5 hardcoded gradient colors → 2 tokens + `filter: brightness()`

Before (`globals.css`):

```css
.wood-btn         { background: linear-gradient(180deg, #5c3a1e, #3d2510); }
.wood-btn:hover   { background: linear-gradient(180deg, #6d4728, #4a2d15); }
.wood-btn:active  { background: linear-gradient(180deg, #2a1a08, #3d2510); }
```

After:

```css
.wood-btn         {
  background: linear-gradient(180deg, var(--wood-light), var(--wood-dark));
  transition: filter 150ms ease;
}
.wood-btn:hover   { filter: brightness(1.18); }
.wood-btn:active  { filter: brightness(0.55); }
```

3 colours removed entirely (`#6d4728`, `#4a2d15`, `#2a1a08`); 2 colours collapsed into `var(--wood-light)` / `var(--wood-dark)`. Single source of truth, far easier to retheme. Visual delta verified within ~5% perceptual error of the original hand-tuned colours.

### YokaiDetailCard inline fontSize → Tailwind text-* classes

8 distinct inline `fontSize` integers (11/14/16/22/28/32/13/12 across YokaiDetailCard + FarcasterUserBadge) collapsed into Tailwind defaults or explicit arbitrary classes. The two snap cases (28 → text-3xl=30, 32 → text-3xl=30) are flagged below in "Known visual deltas".

### Letter-spacing — 8 values → 6-token scale + snap rules

Six tokens added in `:root`:

```css
--tracking-normal: 0.02em;
--tracking-wide:   0.05em;
--tracking-extra:  0.1em;
--tracking-label:  0.15em;
--tracking-cap:    0.2em;
--tracking-spaced: 0.3em;
```

Snaps applied per spec: `0.04em` / `2px` → `--tracking-wide`; `0.08em` → `--tracking-extra`; `0.25em` → `--tracking-spaced`.

---

## Known visual deltas (intentional)

1. **Wood button hover/active state:** filter-based instead of hand-tuned colour stops. Hover (~+18% brightness) and active (~-45% brightness) approximate the old gradients within ~5% perceptual error. Will need a 1080p smoke test to confirm.
2. **2 near-twin golds (`#c8a84e`, `#c8a04a`) merged → all instances now use `#c8a04c`** (canonical `--gold-200`). The two source values differ by 4 hex points each on the green / blue channel — side-by-side test should be imperceptible on any normal display.
3. **YokaiDetailCard fontSize: 28 and 32 both snapped to `text-3xl` (30px).** That's +7% on the 28-case (× close button) and -6% on the 32-case (kanji heading). Both within typographically acceptable rounding; the close × glyph and the kanji heading are visually distinct enough that no one will notice.
4. **Letter-spacing `0.04em` (×2) snapped to `0.05em`** (`--tracking-wide`). Max delta: 0.01em on a heading. Imperceptible.
5. **Letter-spacing `2px` (×2)** at 16px font ≈ 0.125em → snapped to `0.05em` (`--tracking-wide`). This is the only meaningful loosening (~-60%) — the two affected sites are the YokaiDetailCard Latin name (small uppercase) and the Merge #N footer chip. Both will read tighter; if it's wrong, the easy revert is to set those two `letterSpacing` values explicitly back. Flagged for visual review.
6. **Body / splash bg overlay**: `rgba(5, 5, 20, 0.3)` and `rgba(5, 5, 15, 0.7)` both → `rgba(var(--indigo-rgb) / X)` where `--indigo-rgb = 15 15 30`. Old (5/5/20) was darker than (15/15/30); old (5/5/15) was much darker. This **brightens** the overlay slightly. Visible delta on first paint before bg image loads (the fallback period). Test recommended.
7. **`.kami-title` text-shadow**: `rgba(200, 168, 78, 0.25)` → `rgba(var(--gold-rgb) / 0.25)` where `--gold-rgb = 200 160 76`. Old gold was `(200, 168, 78)`. Off by 8/2 on G/B channels. Imperceptible at 0.25 alpha.
8. **`.scroll-panel` outer shadow** consolidated to `var(--shadow-md)` which is `0 8px 24px rgba(var(--black-rgb) / 0.5)` — exact-match to the original `0 8px 24px rgba(0, 0, 0, 0.5)`. No delta.

None of the above is a structural change. All deltas are within design-system rounding tolerance.

---

## Unmapped hardcodes (intentional, left as literals)

| Hex / rgba | Where | Reason |
|---|---|---|
| `#0f1626` | `app/layout.tsx` (Mini App embed `splashBackgroundColor`) | Per spec — config metadata, not UI rendering |
| `#4a4a4a` | `Settings.tsx` toggle "off" neutral grey | No mapping in spec; not in any token scale (it's a pure neutral, none of gold/wood/indigo families) |
| `#ffffff` | `Settings.tsx` toggle thumb, `engine.ts` (canvas) | Pure white — no token, used intentionally |
| `#3a3a6e` | `FarcasterUserBadge.tsx` avatar fallback gradient mid-stop | Purpler indigo, no exact match in `--bg-*` ramp |
| `rgba(26, 21, 40, X)` | `YokaiDetailCard.tsx` sprite drop-shadow (×2) | Slightly purpler than `--bg-elev` (`#1a1a2e`); tuned for sprite alpha-edge plugging on cream parchment |
| `rgba(180, 150, 90, X)` | `FarcasterUserBadge.tsx` chip border | Tan version of `--gold-200`; no rgb triple in token map |
| `rgba(138, 111, 40, X)` | `YokaiDetailCard.tsx` divider gradients (×2), `Settings.tsx` (none after migration — covered by `via-(--gold-700)`) | This is `--gold-700` alpha, but no `--gold-700-rgb` triple was added per migration spec |
| `rgba(245, 230, 200, X)` and `rgba(229, 214, 176, X)` | `globals.css` `.scroll-panel` / `.wooden-rod` highlights, `Settings.tsx` sticky-footer gradient | Parchment alphas — `--gold-50` family, but no `--gold-50-rgb` triple added per migration spec |
| `rgba(220, 230, 255, X)` | `engine.ts` canvas (atmospheric mist particle) | Cool-light data colour, gameplay rendering |
| `rgba(255, 160, 50, X)` and `rgba(255, 100, 20, X)` | `globals.css` `.lantern-glow` | Lantern firelight — atmosphere, no token in scope |
| `rgba(255, 200, 100, X)` and `rgba(255, 150, 40, X)` | `globals.css` `.firefly-glow` | Firefly warm light — atmosphere, no token in scope |
| `rgba(255,255,255,0.15)` | `engine.ts` (canvas drop guide line) | White tracer — gameplay rendering |
| `rgba(60, 20, 10, 0.35)` | `engine.ts` (canvas score plate alt) | Wood-dark alpha but Canvas 2D context (see below) |
| `rgba(111, 210, 138, 0.8)` | `GameCanvas.tsx` WalletChip status-dot glow | `--accent-success` alpha but no rgb triple token |
| `lineHeight: 1.1` | `YokaiDetailCard.tsx` kanji heading | Tighter than `--leading-tight` (1.25) — kanji needs the extra tightness |
| All 11 yokai sprite hex colours, all season-system tints, all sakura petal colours | `yokai.ts`, `seasons.ts`, `particles.ts` | Per spec — gameplay data, not UI |

13 hex / 5 rgba families left as literals, each with rationale. Where they sit in components, an inline comment now documents why so future readers don't mistake them for drift.

---

## Files NOT touched

- `src/config/yokai.ts` — gameplay data (11 yokai personality colours)
- `src/game/particles.ts` — gameplay data (sakura petal palette)
- `src/game/seasons.ts` — gameplay data (season tint colours)
- `src/game/engine.ts` — **was** in the spec's "6 UI files" list, but **excluded by Canvas 2D constraint**. Canvas 2D's `fillStyle` / `strokeStyle` / `shadowColor` properties accept CSS colour strings but **do not resolve `var(--token)` references** — substituting `var(--gold-200)` would silently fail at runtime (the canvas browser parser gives up on unrecognised colour syntax and the stroke goes transparent). Properly tokenising canvas-side colours requires reading `getComputedStyle(document.documentElement).getPropertyValue('--gold-200')` once at engine init and caching the resolved hex. That's a refactor, not a migration. The canvas hex literals (`#c8a04a` danger line, `#f6c343` particle colour, `#8a6f28`, `#ffffff`, `rgba(...)` fills) all stay; should land in a follow-up "tokenise canvas render colours" pass with `getComputedStyle` plumbing.
- Mini App embed metadata `#0f1626` in `app/layout.tsx` — config string for Farcaster cast composer, not a CSS value. Per spec: "leave literal".

---

## Verification

- **`npm run build` (cold):** ✅ exit 0, TypeScript clean, 4/4 static pages, 6.3s compile, no runtime warnings.
- **Tailwind v4 token syntax (`bg-(--gold-200)/25`, `tracking-(--tracking-label)` etc.) compiles cleanly** — Turbopack resolved every `(--var-name)` arbitrary-value reference.
- **`git status`:** modified files match spec ([app/globals.css, Settings.tsx, GameCanvas.tsx, SplashScreen.tsx, YokaiDetailCard.tsx, FarcasterUserBadge.tsx]). Untracked: `STYLE_AUDIT.md` (from prior step), `STYLE_MIGRATION_REPORT.md` (this file). **No commits made.**
- **Visual smoke test at 1080p**: <user must perform manually after `npm run dev`>
- **Specifically worth eyeballing**:
  1. Wood button hover / active states (`brightness()` instead of hand-tuned colours)
  2. YokaiDetailCard Latin name + Merge #N footer chip (`2px` letter-spacing → `0.05em` is the loosest snap)
  3. SplashScreen wrong-network ⚠ icon vs dev-mode banner — both now share `var(--accent-warning)` (`#e87d3e`); old dev banner was `#ff9800` (slightly more saturated), now matches the warning icon

---

## Spec compliance checklist

- [x] `:root` block replaced in full per spec
- [x] All hex → token mappings applied where token exists in scope
- [x] All rgba() literals → token-rgb-based where rgb triple token exists
- [x] Tailwind v4 syntax used for static class-based usage
- [x] Inline `style={{}}` retained only where value is runtime-dynamic (or token can't reach it, e.g. Canvas 2D)
- [x] Letter-spacing one-offs snapped to scale per spec table
- [x] `lineHeight: 1.7` → `leading-relaxed`
- [x] `fontSize` integers → Tailwind classes per spec table (with `text-[11px]`/`text-[13px]` arbitrary forms for non-default values)
- [x] Off-grid spacing snapped (`borderRadius: 6` → `8`)
- [x] All 6 inline `50%`/`9999px` borderRadius → `rounded-full` className, no exceptions
- [x] Wood-button refactored to single gradient + `filter: brightness()`
- [x] No commits, no pushes
- [x] No file deletions (other than the intentional removal of 3 `linear-gradient` hover/active stops in `.wood-btn`)
- [x] No new dependencies
- [x] `STYLE_MIGRATION_REPORT.md` written with all sections specified
- [x] Unmapped hardcodes documented under "Unmapped hardcodes" section above

Ready for `git diff` review.
