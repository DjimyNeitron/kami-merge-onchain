"use client";

// NFTCard — atomic React component for rendering a Kami Merge NFT card
// with tier-scaled aurora holo + drag-to-tilt (mouse OR touch). Visual
// spec from Brief v13 Session A; lore strings from src/config/yokai.ts
// (per Session B).
//
// Asset filename convention is owned by scripts/stage2_render.py and
// matches the YOKAI_ORDER × TIER_ORDER cross-product:
//   /nft_assets/static/{yokai}_{tier}.png       (2048×2867, RGBA)
//   /nft_assets/animated/{yokai}_{tier}.webp    (1024×1434, 36-frame loop)
//
// Asset-first rendering: every Stage 2-rendered bitmap already contains
// the yokai name, kanji, tier label, and gold frame border baked into
// the pixels. The component does NOT render CSS text overlays or a CSS
// frame border on top of those (we tried in PR #20 — produced visible
// duplication + misalignment). React only adds dynamic layers: the
// hover-triggered holo and the optional lore overlay.
//
// Interaction model (PR #23 — drag-tilt, replaces PR #20 gyro):
//
//                       | static | swap → animated | holo visible | tilt
//   interactive=false   |   ✓    |       ✗         |    ✓         |  no
//   interactive=true,   |   ✓    |  on hover       |  on hover    |  mouse
//     no input          |        |                 |              |
//   interactive=true,   |   ✗    |  on hover       |    ✓         |  mouse
//     mouse over        |        |                 |              |
//   interactive=true,   |   ✗    |  on touch       |    ✓         |  finger
//     finger on card    |        |                 |              |
//
// A single `applyTilt(clientX, clientY)` helper drives the transform
// regardless of input source. Mouse and touch handlers both feed it
// the pointer position; the helper computes the perspective-rotation
// and writes directly to cardRef.current.style.transform (no React
// state churn at ~120 Hz). The matching reset() snaps the transform
// back to neutral on leave / touchend / touchcancel.
//
// touch-action: pan-y on .card lets vertical swipes pass through to
// the parent (page scroll). Horizontal / diagonal drags get captured
// by the card for tilt. iOS may briefly fire onTouchMove before
// claiming a vertical gesture for scrolling — onTouchCancel handles
// that case by resetting the transform so the card doesn't stay
// tilted after the browser claims the gesture.
//
// `isInteracting` is the single flag for "card is actively engaged."
// It drives both the holo visibility (.isInteracting class) and the
// animated-webp swap. Seeded `!interactive` so static thumbnails
// in non-interactive mode always show the holo without a pointer
// event. This component owns no wallet, no metadata fetching, no
// mint logic — those belong to Stage 3.4+ (Inventory) and 3.5+
// (mint flow). Constraint: must not touch wagmi / Mini App / Splash.

import { useEffect, useRef, useState } from "react";
import styles from "./NFTCard.module.css";
import {
  BASE_LORE,
  TIER_FLAVOR,
  type Tier,
  type YokaiName,
} from "@/config/yokai";

export interface NFTCardProps {
  yokai: YokaiName;
  tier: Tier;
  /** Pixel-width preset. Aspect-ratio (5:7) is fixed in CSS. Default 'md' (240px). */
  size?: "sm" | "md" | "lg";
  /** When false: disables tilt + hover-swap, renders flat static-only card. Default true. */
  interactive?: boolean;
  /** When true: render translucent bottom overlay with `BASE_LORE[yokai] + TIER_FLAVOR[tier]`. Default false. */
  showLore?: boolean;
  /** Escape hatch for grid sizing in Inventory etc. Applied to the card root. */
  className?: string;
}

const TILT_MAX = 12; // degrees — matches Brief v13 spec
const STATIC_BASE = "/nft_assets/static";
const ANIM_BASE = "/nft_assets/animated";

// Title-case helper for display strings. Avoids importing a util for one-liner.
function toTitle(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function NFTCard({
  yokai,
  tier,
  size = "md",
  interactive = true,
  showLore = false,
  className,
}: NFTCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  // Single interaction flag — true while mouse is hovering OR a finger
  // is on the card. Drives the .isInteracting class for holo fade-in
  // AND the animated-webp swap. Seeded `!interactive` so static
  // previews (Inventory thumbs, mint ceremony, etc) always show the
  // holo without any pointer event.
  const [isInteracting, setIsInteracting] = useState(!interactive);

  // ─── Unified tilt helper ───────────────────────────────────────────
  // Maps any (clientX, clientY) point inside the card rect to a
  // perspective rotation. Normalised so the centre of the card is
  // neutral (0/0) and the corners are ±TILT_MAX. Mutates style.transform
  // directly via ref — pointer-move / touch-move can fire ~120 Hz and
  // routing through React state would cost real frames on mobile.
  //
  // -deltaY for rotateX gives the natural feel: pointer at top of
  // card tilts top of card AWAY from viewer (negative pitch).
  function applyTilt(clientX: number, clientY: number): void {
    if (!interactive) return;
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deltaX = (clientX - centerX) / (rect.width / 2); // -1..1
    const deltaY = (clientY - centerY) / (rect.height / 2);
    const rotateY = Math.max(
      -TILT_MAX,
      Math.min(TILT_MAX, deltaX * TILT_MAX)
    );
    const rotateX = Math.max(
      -TILT_MAX,
      Math.min(TILT_MAX, -deltaY * TILT_MAX)
    );
    card.style.transform =
      `perspective(800px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`;
  }

  function resetTilt(): void {
    const card = cardRef.current;
    if (!card) return;
    // CSS `transition: transform 120ms ease-out` on .card handles
    // the easing on the way out.
    card.style.transform = "perspective(800px) rotateX(0deg) rotateY(0deg)";
  }

  // ─── Mouse handlers ────────────────────────────────────────────────
  const handleMouseEnter = () => {
    if (!interactive) return;
    setIsInteracting(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive) return;
    applyTilt(e.clientX, e.clientY);
  };

  const handleMouseLeave = () => {
    if (!interactive) return;
    setIsInteracting(false);
    resetTilt();
  };

  // ─── Touch handlers ────────────────────────────────────────────────
  // Touch events are parallel to mouse events — both feed the same
  // applyTilt / resetTilt helpers so behaviour is identical regardless
  // of input source. touch-action: pan-y on .card (CSS) routes vertical
  // swipes to the parent scroller, so a user swiping the grid vertically
  // gets natural page scroll instead of tilting the card.
  //
  // onTouchCancel matters: iOS / Android fire it when the browser
  // decides the gesture belongs to a parent scroll container after
  // touchstart. Without resetting tilt there, the card would stay
  // frozen at the last touchmove angle until the next touchstart.

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const touch = e.touches[0];
    if (!touch) return;
    setIsInteracting(true);
    applyTilt(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const touch = e.touches[0];
    if (!touch) return;
    applyTilt(touch.clientX, touch.clientY);
  };

  const handleTouchEnd = () => {
    if (!interactive) return;
    setIsInteracting(false);
    resetTilt();
  };

  const handleTouchCancel = () => {
    if (!interactive) return;
    setIsInteracting(false);
    resetTilt();
  };

  // ─── Asset path selection ──────────────────────────────────────────
  const staticSrc = `${STATIC_BASE}/${yokai}_${tier}.png`;
  const animSrc = `${ANIM_BASE}/${yokai}_${tier}.webp`;

  // Preload static image on mount. Without this the first touch on a
  // never-yet-rendered card had a visible flash: aurora gradient (pure
  // CSS) lit up instantly while the PNG was still being fetched, so
  // for ~100-300ms the card frame showed an empty rectangle with only
  // the holo glow inside. `new Image()` creates an off-DOM image
  // element the browser caches; by the time the user actually
  // interacts the bitmap is already decoded and ready. The <img>
  // below also drops `loading="lazy"` and adds `fetchPriority="high"`
  // so the in-DOM tag gets fetched at the same priority.
  //
  // Animated webp intentionally NOT preloaded — it's heavier
  // (~1.8 MB each × 44 cards would be ~80 MB on grid mount), and the
  // flash matters less for the hover/touch swap (the user has
  // already engaged the card, micro-delays read as responsiveness
  // rather than glitch). Animated.webp lazy-loads on first swap and
  // caches from there.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const img = new window.Image();
    img.src = staticSrc;
  }, [staticSrc]);

  // Animated webp shown when card is interactive AND actively engaged.
  // For interactive=false (Inventory thumbnails) the swap never fires
  // even though isInteracting is seeded true — the interactive gate
  // wins. Hover / touch start triggers animated; mouseleave / touchend
  // returns to static.
  const useAnimated = interactive && isInteracting;
  const artSrc = useAnimated ? animSrc : staticSrc;

  const displayName = toTitle(yokai);

  // ─── className composition ─────────────────────────────────────────
  const sizeClass =
    size === "sm" ? styles.sizeSm : size === "lg" ? styles.sizeLg : styles.sizeMd;
  const tierClass =
    tier === "common"
      ? styles.tierCommon
      : tier === "rare"
        ? styles.tierRare
        : tier === "epic"
          ? styles.tierEpic
          : styles.tierLegendary;
  const interactiveClass = interactive ? "" : styles.nonInteractive;
  const interactingClass = isInteracting ? styles.isInteracting : "";

  return (
    <div
      ref={cardRef}
      className={[
        styles.card,
        sizeClass,
        tierClass,
        interactiveClass,
        interactingClass,
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      data-tier={tier}
      data-yokai={yokai}
      role="img"
      aria-label={`${displayName} — ${tier} tier NFT card`}
    >
      {/* The <img> is keyed on its src so swapping static ↔ animated
       *  triggers a fresh image element and lets the browser decode
       *  the next one in parallel instead of flashing through a
       *  half-decoded frame.
       *
       *  Eager loading + high fetch priority (was loading="lazy"):
       *  the demo grid renders 44 cards at once, all in the initial
       *  viewport on a typical desktop monitor. Lazy-loading delayed
       *  bitmaps that aren't actually off-screen, producing a
       *  visible flash where the holo gradient lit up an empty
       *  frame while the PNG was still being fetched. Eager + high
       *  priority + the new Image() preload above keep the
       *  bitmaps in cache before the user can interact. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={artSrc}
        src={artSrc}
        alt=""
        className={styles.art}
        fetchPriority="high"
        decoding="async"
        draggable={false}
      />
      {/* No CSS text overlays — yokai name, kanji, tier label, and the
       *  gold frame border are all baked into the asset PNG/WebP at
       *  Stage 2 render time. The card defers to the asset entirely
       *  for those surfaces; React only adds the dynamic layers
       *  (interaction-triggered holo + 3D tilt) on top. */}
      {showLore && (
        <div
          className={`${styles.loreOverlay} ${interactive ? styles.interactive : ""}`}
        >
          <p className={styles.loreText}>
            {BASE_LORE[yokai]}
            {"\n\n"}
            {TIER_FLAVOR[tier]}
          </p>
        </div>
      )}
      {/* Holo composition — three stacked layers inside a masked
       *  container that trims corner bleed. All start at opacity 0;
       *  the .isInteracting class on the card root fades them in over
       *  400ms when a mouse hovers OR a finger touches. */}
      <div className={styles.holoWrap} aria-hidden="true">
        <div className={`${styles.holoLayer} ${styles.layerAurora}`} />
        <div className={`${styles.holoLayer} ${styles.layerAuroraStreak}`} />
        <div className={`${styles.holoLayer} ${styles.layerSparkles}`} />
      </div>
    </div>
  );
}
