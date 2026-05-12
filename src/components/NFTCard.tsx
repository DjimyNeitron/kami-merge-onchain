"use client";

// NFTCard — atomic React component for rendering a Kami Merge NFT card
// with tier-scaled aurora holo + mouse tilt. Visual spec from Brief v13
// Session A; lore strings from `src/config/yokai.ts` (per Session B).
//
// Asset filename convention is owned by `scripts/stage2_render.py` and
// matches the YOKAI_ORDER × TIER_ORDER cross-product:
//   /nft_assets/static/{yokai}_{tier}.png       (2048×2867, RGBA)
//   /nft_assets/animated/{yokai}_{tier}.webp    (1024×1434, 36-frame loop)
//
// Interactivity matrix:
//                       | static |  hover-swap → animated | autoplay animated
//   interactive=false   |   ✓    |          ✗            |        ✗
//   interactive=true,   |   ✓    |          ✓            |        ✗
//     coarse=false      |        |  (desktop hover)      |
//   interactive=true,   |   ✗    |          ✗            |        ✓
//     coarse=true       |        |                       |  (touch device)
//
// The animated webp is heavier (~1.8 MB avg per Stage 2 render report)
// so we hold off loading it until either the user hovers a card on
// desktop or we detect a coarse pointer (touch) — never both at once.
// Once loaded the browser caches it, so subsequent hovers are instant.
//
// This component is pure UI and intentionally has no side effects beyond
// pointer-driven transforms. It owns no wallet, no metadata fetching,
// no mint logic — those belong to Stage 3.4+ (Inventory) and 3.5+ (mint
// flow). Constraint: must not touch wagmi / Mini App / Splash code.

import { useEffect, useRef, useState } from "react";
import styles from "./NFTCard.module.css";
import {
  BASE_LORE,
  TIER_FLAVOR,
  type Tier,
  type YokaiName,
} from "@/config/yokai";
import { useGyroTilt } from "@/hooks/useGyroTilt";

// KANJI import removed — all yokai name / kanji / tier text is now
// baked directly into the PNG/WebP assets at Stage 2 render time
// (see scripts/stage2_render.py + dev-reference/nft_card_render.html).
// Verified visually for all 44 assets: each has KODAMA/AMATERASU/etc
// top-LEFT, kanji top-RIGHT, tier label bottom-CENTRE, and a gold
// frame border drawn into the bitmap. CSS text overlays in PR #20
// duplicated this content in DIFFERENT positions (tier badge TR,
// kanji bottom), creating both a visual duplicate AND misalignment.
// This component now defers to the asset entirely for text + frame.

// AURORA_OPACITY is no longer consumed here — the per-tier holo CSS vars
// (--aurora-op, --aurora-streak-op, --sparkle-op) live entirely in the
// tier classes inside NFTCard.module.css. AURORA_OPACITY stays exported
// from yokai.ts as the canonical source for Stage 7 metadata generation
// (the "Aurora Opacity" attribute on the NFT manifest).

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

// Title-case helper for the romaji label. Avoids importing a util just
// for one-liner.
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
  // Coarse-pointer (touch) detection. SSR-safe: defaults to false on the
  // server, then flips on mount if the matchMedia query resolves coarse.
  // We also subscribe to the change event so a user docking an iPad into
  // a keyboard / trackpad mid-session transitions correctly.
  const [isCoarse, setIsCoarse] = useState(false);
  // Hover state drives BOTH the desktop hover-swap to animated.webp AND
  // the `.isHovered` class that fades the holo layers in via CSS.
  // Initial seed: `false` for interactive cards (idle = static art only),
  // `true` for non-interactive cards (static previews always show the
  // holo, since there's no cursor to trigger it). Touch devices bypass
  // this entirely — see the `@media (hover: none)` block in the CSS
  // module — so we don't seed it from isCoarse here.
  const [isHovered, setIsHovered] = useState(!interactive);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(pointer: coarse)");
    setIsCoarse(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsCoarse(e.matches);
    // addEventListener is the modern shape; older Safari aliases to
    // addListener but we're already at 16.4+ for @property support so
    // we can rely on the modern shape exclusively.
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Gyroscope tilt for touch devices. The hook stays dormant on
  // desktop (returns isActive: false) so the mouse-driven tilt below
  // continues to own the transform. On Android it auto-attaches at
  // mount; on iOS we hold off until the user taps a card (handleTap
  // below fires requestPermission). When active, the effect block
  // below writes the smoothed orientation directly to the card's
  // style.transform — same ref-mutation pattern as the mouse handler
  // so React doesn't re-render at 60 Hz.
  const gyro = useGyroTilt();
  const useGyro = isCoarse && gyro.isActive;
  useEffect(() => {
    if (!useGyro) return;
    const card = cardRef.current;
    if (!card) return;
    card.style.transform =
      `perspective(800px) rotateX(${gyro.rotateX.toFixed(2)}deg) rotateY(${gyro.rotateY.toFixed(2)}deg)`;
  }, [useGyro, gyro.rotateX, gyro.rotateY]);

  // Reset transform to neutral when gyro deactivates (e.g. permission
  // revoked, matchMedia flips back to fine pointer after dock). Without
  // this, a stale tilted transform would persist.
  useEffect(() => {
    if (useGyro) return;
    if (isCoarse) {
      const card = cardRef.current;
      if (!card) return;
      card.style.transform = "perspective(800px) rotateX(0deg) rotateY(0deg)";
    }
  }, [useGyro, isCoarse]);

  // Pointer-move handler. Maps cursor position inside the card rect to
  // a perspective rotation around X (pitch) and Y (yaw). Negating the
  // X-component on the Y axis inverts the natural-feeling tilt (mouse
  // moves up → card tilts back, not forward).
  //
  // We mutate `card.style.transform` directly via the ref rather than
  // routing through React state because pointer-move can fire ~120
  // times/sec and the inline-style write is ~free, while a React
  // re-render at that rate would cost real frames on mobile.
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive || isCoarse) return;
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / rect.width; // 0..1
    const cy = (e.clientY - rect.top) / rect.height; // 0..1
    const rotY = (cx - 0.5) * TILT_MAX * 2; // -TILT_MAX..TILT_MAX
    const rotX = -(cy - 0.5) * TILT_MAX * 2;
    card.style.transform =
      `perspective(800px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg)`;
  };

  const handleMouseLeave = () => {
    if (!interactive || isCoarse) return;
    setIsHovered(false);
    const card = cardRef.current;
    if (!card) return;
    // Smooth reset to neutral — the CSS `transition: transform 120ms`
    // on .card handles the easing without us doing it in JS.
    card.style.transform = "perspective(800px) rotateX(0deg) rotateY(0deg)";
  };

  const handleMouseEnter = () => {
    if (!interactive || isCoarse) return;
    setIsHovered(true);
  };

  // iOS permission gate: any tap on a card on iOS fires the system
  // permission prompt for DeviceOrientationEvent (if not already
  // granted). Implicit pattern — no explicit "Enable motion" button
  // per spec. On Android / desktop / already-granted, this is a no-op.
  // Wired to onClick rather than onTouchStart so click semantics from
  // assistive tech and keyboard activation also work.
  const handleTap = () => {
    if (gyro.needsPermission) {
      void gyro.requestPermission();
    }
  };

  const staticSrc = `${STATIC_BASE}/${yokai}_${tier}.png`;
  const animSrc = `${ANIM_BASE}/${yokai}_${tier}.webp`;

  // Pick the asset per interactivity matrix above. The animated webp
  // path always wins on touch (where there's no hover affordance) or
  // on desktop hover (where the user is actively engaging the card).
  // Defaults to static everywhere else, including the non-interactive
  // mode used by static thumbnail grids.
  const useAnimated = interactive && (isCoarse || isHovered);
  const artSrc = useAnimated ? animSrc : staticSrc;

  const displayName = toTitle(yokai);

  // Build className. CSS modules give us a unique class per name so we
  // compose with template literals; the optional `className` escape
  // hatch wins last for parent-driven sizing. The .isHovered class
  // gates the holo layers — on desktop it follows mouseenter/leave,
  // on touch the CSS @media (hover: none) block makes the class
  // irrelevant (holo shows always), and on !interactive we seeded
  // isHovered=true at mount so it stays on permanently.
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
  const hoveredClass = isHovered ? styles.isHovered : "";

  return (
    <div
      ref={cardRef}
      className={[
        styles.card,
        sizeClass,
        tierClass,
        interactiveClass,
        hoveredClass,
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleTap}
      data-tier={tier}
      data-yokai={yokai}
      role="img"
      aria-label={`${displayName} — ${tier} tier NFT card`}
    >
      {/* The <img> is keyed on its src so swapping static ↔ animated
       *  triggers a fresh image element and lets the browser decode
       *  the next one in parallel instead of flashing through a
       *  half-decoded frame. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={artSrc}
        src={artSrc}
        alt=""
        className={styles.art}
        loading="lazy"
        decoding="async"
        draggable={false}
      />
      {/* No CSS text overlays — yokai name, kanji, tier label, and the
       *  gold frame border are all baked into the asset PNG/WebP at
       *  Stage 2 render time. The card defers to the asset entirely
       *  for those surfaces; React only adds the dynamic layers
       *  (hover-triggered holo + 3D tilt) on top. */}
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
       *  the `.isHovered` class on the card root fades them in over
       *  400ms (or they show always on touch / non-interactive cards
       *  via the CSS module's @media + .isHovered seeded by React). */}
      <div className={styles.holoWrap} aria-hidden="true">
        <div className={`${styles.holoLayer} ${styles.layerAurora}`} />
        <div className={`${styles.holoLayer} ${styles.layerAuroraStreak}`} />
        <div className={`${styles.holoLayer} ${styles.layerSparkles}`} />
      </div>
      {/* No CSS frame border — the gold frame is baked into the asset
       *  PNG/WebP. Adding a CSS box-shadow on top would double-print
       *  the border slightly off-position (the asset frame sits inset
       *  from the bitmap edge by a few pixels, where CSS box-shadow
       *  would sit right at edge), creating a visible misalignment. */}
    </div>
  );
}
