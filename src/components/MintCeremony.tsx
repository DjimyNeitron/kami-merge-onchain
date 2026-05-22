"use client";

// MintCeremony — Stage 3.5d image-backed reveal scene. Same 8-phase
// state machine + timeline + audio cues + dev controls as before; the
// programmatic atmospheric layers (moon halo, magic circle + runes,
// light beam, radial rays, core pulse, lantern glows, stars, torii)
// are replaced by a single Midjourney background image
// (public/ceremony_bg.jpg — a moonlit lotus pond that already carries
// the warm lanterns + cool crescent moon + drifting motes we used to
// fake). A subtle top/bottom vignette overlay keeps the UI text legible.
//
// Bug fixes this stage:
//  • Aurora-always-on: removed the .cardWrapper::after "shine-sweep"
//    teal/violet overlay that held at opacity 0.5 on the revealed card
//    (the real culprit 3.5c missed — NOT the NFTCard holo, which is
//    correctly hidden at rest).
//  • Frame-on-tilt: same ::after was a flat rectangle that didn't tilt
//    with the 3D card; removing it clears the artefact too.
// NFTCard is therefore left completely untouched.
//
// During the spin the silhouette displays the current tier's kanji
// full-card-size; after the land, NFTCard fades in with
// interactive=true so the player can touch-drag for holo + 3D tilt.
//
// NFTCard / yokai.ts / useInventory / ceremonySound / audioManager
// are all consumed read-only.

import { useCallback, useEffect, useRef, useState } from "react";
import NFTCard from "@/components/NFTCard";
import styles from "./MintCeremony.module.css";
import { TIER_ORDER, type Tier, type YokaiName } from "@/config/yokai";
import { useInventory, type InventoryNFT } from "@/hooks/useInventory";
import { playTick, playChime, playMintSuccess } from "@/lib/ceremonySound";

export type CeremonyPhase =
  | "intro"
  | "spinning"
  | "card-materializing"
  | "aurora-rising"
  | "tier-banner"
  | "mint-ready"
  | "minting"
  | "success";

interface MintCeremonyProps {
  yokai: YokaiName;
  tier: Tier;
  score: number;
  onMintComplete?: (nft: InventoryNFT) => void;
  onClose?: () => void;
  cardWidth?: number;          // default 200 (smaller than PR #37 — scene needs the breathing room)
  soundEnabled?: boolean;
  onPhaseChange?: (phase: CeremonyPhase) => void;
}

// ─── Timing constants (ms) — unchanged from PR #37 ──────────────────
const INTRO_MS = 1500;
const MATERIALIZE_MS = 500;
const AURORA_MS = 600;
const BANNER_MS = 250;
const MINT_MOCK_MS = 2000;
const SUCCESS_HOLD_MS = 2000;

// Spin sequence: [tierIndex, durationMs]. 12 fast cycles, 4
// decelerating steps, then a 500 ms landing on the real tier
// (~2.16 s total).
function buildSpinSequence(target: Tier): Array<[number, number]> {
  const targetIdx = TIER_ORDER.indexOf(target);
  const seq: Array<[number, number]> = [];
  for (let i = 0; i < 12; i++) seq.push([i % 4, 70]);
  seq.push([0, 110], [1, 160], [2, 230], [3, 320]);
  seq.push([targetIdx, 500]);
  return seq;
}

const TIER_LABEL: Record<Tier, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};
const TIER_KANJI: Record<Tier, string> = {
  common: "大",
  rare: "中",
  epic: "上",
  legendary: "神",
};

// Fireflies — a sparse 8-mote layer of gentle animated parallax over
// the background image. Reduced from 14 (3.5c) because ceremony_bg.jpg
// already carries warm motes of its own; a denser overlay competed
// with the art. Edge-biased so they read against the darker margins.
type FireflyTone = "gold" | "amber";
// prettier-ignore
const FIREFLIES: Array<{ x: number; y: number; size: number; delay: number; tone: FireflyTone }> = [
  { x: 18, y: 22, size: 1.5, delay: 0,   tone: "gold"  }, { x: 82, y: 25, size: 1.3, delay: 0.5, tone: "gold"  },
  { x: 15, y: 38, size: 1.2, delay: 1,   tone: "amber" }, { x: 86, y: 40, size: 1.6, delay: 1.5, tone: "gold"  },
  { x: 22, y: 50, size: 1.1, delay: 2,   tone: "amber" }, { x: 80, y: 53, size: 1.4, delay: 2.5, tone: "gold"  },
  { x: 15, y: 65, size: 1.3, delay: 3,   tone: "amber" }, { x: 85, y: 68, size: 1.2, delay: 3.5, tone: "gold"  },
];

// Sakura gradient defs — rendered once off-screen; the petal variants
// reference them by id (single defs, many refs = valid + cheap).
const SAKURA_DEFS = (
  <svg className={styles.sakuraDefs} aria-hidden="true">
    <defs>
      <linearGradient id="sakuraFront" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#ffd4de" /><stop offset="60%" stopColor="#ffb8c8" /><stop offset="100%" stopColor="#ff9ab0" />
      </linearGradient>
      <linearGradient id="sakuraSide" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#ffc4d6" /><stop offset="100%" stopColor="#ffa0b8" />
      </linearGradient>
    </defs>
  </svg>
);

// 3 petal silhouettes — front (full bloom), side (narrower), edge (thin
// slip). Default preserveAspectRatio keeps each undistorted in the box;
// random per petal so the fall reads as real tumbling blossoms.
const SAKURA_VARIANTS = [
  <svg key="f" viewBox="0 0 16 22" width="100%" height="100%" aria-hidden="true">
    <path d="M 8 1 C 12.5 4, 13 13, 9 19 L 8.5 17 L 8 19 L 7.5 17 L 7 19 C 3 13, 3.5 4, 8 1 Z" fill="url(#sakuraFront)" />
    <path d="M 8 4 C 5.5 7, 5.5 13, 7 17 L 8 16 Z" fill="#ffe8ee" opacity="0.5" />
  </svg>,
  <svg key="s" viewBox="0 0 12 22" width="100%" height="100%" aria-hidden="true">
    <path d="M 6 1 C 9 5, 9.5 14, 7 19 L 6 17 L 5 19 C 2.5 14, 3 5, 6 1 Z" fill="url(#sakuraSide)" />
  </svg>,
  <svg key="e" viewBox="0 0 8 22" width="100%" height="100%" aria-hidden="true">
    <path d="M 4 1 C 5.5 6, 5.5 16, 4 21 C 2.5 16, 2.5 6, 4 1 Z" fill="#ffb0c5" opacity="0.85" />
  </svg>,
];

// One falling petal — randomised position / size / drift / timing.
interface PetalSpec {
  key: string;
  left: number; // %
  topOffset: number; // px below container top
  size: number; // px width
  rotation: number; // deg
  drift: number; // px horizontal drift
  duration: number; // s
  delay: number; // s
  opacityMax: number;
  variant: number; // index into SAKURA_VARIANTS
}

// 3.5f: smaller (10–20px), slower (8–12s), staggered. The `seed` makes
// keys unique across spawns (a fresh Replay remount restarts them).
function makePetals(n: number, seed: number): PetalSpec[] {
  return Array.from({ length: n }, (_, i) => ({
    key: `p${seed}-${i}`, left: Math.random() * 100, topOffset: -(20 + Math.random() * 40),
    size: 10 + Math.random() * 10, rotation: Math.random() * 360, drift: (Math.random() - 0.5) * 120,
    duration: 8 + Math.random() * 4, delay: Math.random() * 1.5, opacityMax: 0.55 + Math.random() * 0.35,
    variant: Math.floor(Math.random() * SAKURA_VARIANTS.length),
  }));
}

export default function MintCeremony({
  yokai,
  tier,
  score,
  onMintComplete,
  onClose,
  cardWidth = 200,
  soundEnabled = true,
  onPhaseChange,
}: MintCeremonyProps) {
  const [phase, setPhase] = useState<CeremonyPhase>("intro");
  const [spinIdx, setSpinIdx] = useState(0);
  const timers = useRef<number[]>([]);
  const inventory = useInventory();

  const soundRef = useRef(soundEnabled);
  soundRef.current = soundEnabled;

  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase, onPhaseChange]);

  // Mount-driven timeline — identical to PR #37. Replay = remount.
  useEffect(() => {
    const ids = timers.current;
    const at = (fn: () => void, ms: number) => {
      ids.push(window.setTimeout(fn, ms));
    };

    const runSpin = () => {
      const seq = buildSpinSequence(tier);
      let i = 0;
      const step = () => {
        if (i >= seq.length) {
          if (typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate(30);
          }
          if (soundRef.current) playChime(tier);
          setPhase("card-materializing");
          at(() => setPhase("aurora-rising"), MATERIALIZE_MS);
          at(() => setPhase("tier-banner"), MATERIALIZE_MS + AURORA_MS);
          at(
            () => setPhase("mint-ready"),
            MATERIALIZE_MS + AURORA_MS + BANNER_MS
          );
          return;
        }
        const [tierIdx, dur] = seq[i];
        setSpinIdx(tierIdx);
        if (soundRef.current) playTick();
        i += 1;
        ids.push(window.setTimeout(step, dur));
      };
      step();
    };

    at(() => {
      setPhase("spinning");
      runSpin();
    }, INTRO_MS);

    return () => {
      ids.forEach((id) => window.clearTimeout(id));
      ids.length = 0;
    };
  }, [tier]);

  const handleMint = useCallback(() => {
    if (phase !== "mint-ready") return;
    setPhase("minting");
    const id = window.setTimeout(() => {
      inventory._devAddMock(yokai, tier, score);
      const nft: InventoryNFT = {
        tokenId: `mock_${yokai}_${tier}_${Date.now()}`,
        yokai,
        tier,
        mintedAt: Date.now(),
        score,
      };
      if (soundRef.current) playMintSuccess();
      setPhase("success");
      const holdId = window.setTimeout(() => {
        onMintComplete?.(nft);
      }, SUCCESS_HOLD_MS);
      timers.current.push(holdId);
    }, MINT_MOCK_MS);
    timers.current.push(id);
  }, [phase, yokai, tier, score, inventory, onMintComplete]);

  const handleButton = () => {
    if (phase === "success") onClose?.();
    else handleMint();
  };

  // Silhouette kanji + tier accent: intro shows the central 神
  // placeholder; once the spin starts the drum-index drives both the
  // kanji glyph and the per-tier border colour via --tier-current.
  const silhouetteTier: Tier =
    phase === "intro" ? "legendary" : TIER_ORDER[spinIdx];
  const silhouetteKanji = TIER_KANJI[silhouetteTier];

  // 3.5f: petals live in state so each completes its full fall even as
  // the phase advances. Spawned once on entering card-materializing;
  // each removes itself on animationend (see removePetal). A Replay
  // remounts the component, so the list resets to [] automatically.
  const [petals, setPetals] = useState<PetalSpec[]>([]);
  useEffect(() => {
    if (phase === "card-materializing") setPetals(makePetals(20, Date.now()));
  }, [phase]);
  const removePetal = useCallback((key: string) => {
    setPetals((prev) => prev.filter((p) => p.key !== key));
  }, []);

  const silhouetteStyle = {
    ["--tier-current"]: `var(--tier-${silhouetteTier})`,
  } as React.CSSProperties;
  const tierBannerStyle = {
    ["--tier-current"]: `var(--tier-${tier})`,
  } as React.CSSProperties;

  return (
    <div className={styles.ceremonyScene} data-phase={phase}>
      {/* 1 — Midjourney background image + legibility vignette */}
      <div className={styles.bgImage} aria-hidden="true" />
      <div className={styles.bgOverlay} aria-hidden="true" />

      {/* 10a — card silhouette during intro + spinning */}
      <div
        className={styles.cardSilhouette}
        style={{ ...silhouetteStyle, width: cardWidth }}
      >
        <span className={styles.silhouetteKanji}>{silhouetteKanji}</span>
      </div>

      {/* 10b — revealed NFTCard (interactive — touch tilt + holo) */}
      <div
        className={styles.cardWrapper}
        style={{ width: cardWidth, ["--card-width"]: `${cardWidth}px` } as React.CSSProperties}
      >
        <NFTCard
          yokai={yokai}
          tier={tier}
          width={cardWidth}
          interactive={true}
        />
      </div>

      {/* 11a — sakura petals (state-driven; each self-removes on end) */}
      {SAKURA_DEFS}
      <div className={styles.sakuraContainer} aria-hidden="true">
        {petals.map((p) => (
          <PetalEl key={p.key} p={p} onDone={() => removePetal(p.key)} />
        ))}
      </div>

      {/* 11b — 8 warm fireflies (gold + amber tones) over the image */}
      <div className={styles.firefliesContainer} aria-hidden="true">
        {FIREFLIES.map((f, i) => {
          const haloClass =
            f.tone === "gold" ? styles.fireflyHaloGold : styles.fireflyHaloAmber;
          const coreClass =
            f.tone === "gold" ? styles.fireflyCoreGold : styles.fireflyCoreAmber;
          return (
            <div
              key={i}
              className={styles.firefly}
              style={
                {
                  left: `${f.x}%`,
                  top: `${f.y}%`,
                  ["--size"]: `${f.size}`,
                  animationDelay: `${f.delay}s`,
                } as React.CSSProperties
              }
            >
              <div className={`${styles.fireflyHalo} ${haloClass}`} />
              <div className={`${styles.fireflyCore} ${coreClass}`} />
            </div>
          );
        })}
      </div>

      {/* 12a — header (Run complete + score, bilingual) */}
      <div className={styles.headerContainer}>
        <div className={styles.headerRunComplete}>Run complete</div>
        <div className={styles.headerRunCompleteJp}>完了</div>
        <div className={styles.headerScore}>Score {score.toLocaleString()}</div>
      </div>

      {/* 12b — tier banner (─ 上 EPIC ─) */}
      <div className={styles.tierBanner} style={tierBannerStyle}>
        <div className={styles.tierBannerDash} />
        <span className={styles.tierBannerKanji}>{TIER_KANJI[tier]}</span>
        <span className={styles.tierBannerText}>{TIER_LABEL[tier]}</span>
        <div className={styles.tierBannerDash} />
      </div>

      {/* 12c — wood mint button + bilingual subtext */}
      <div className={styles.mintButtonContainer}>
        <button
          type="button"
          className={`wood-btn ${styles.mintButton}`}
          onClick={handleButton}
          disabled={phase === "minting"}
        >
          {phase === "minting" ? (
            <>
              <span className={styles.spinner} />
              鋳造中…
            </>
          ) : phase === "success" ? (
            "View collection →"
          ) : (
            "Mint to wallet"
          )}
        </button>
        <p className={styles.mintSub}>Free · gas only ~$0.001</p>
        <p className={styles.mintSubJp}>無料</p>
      </div>

      {/* 12d — success banner (top overlay, doesn't cover card) */}
      <div className={styles.successBanner}>
        <div className={styles.successKanji}>完</div>
        <div className={styles.successText}>NFT MINTED</div>
        <div className={styles.successSubtext}>Added to your collection</div>
      </div>
    </div>
  );
}

// Inline petal — per-instance CSS custom properties drive the fall +
// wobble keyframes; the SVG shape is one of the 3 shared variants.
// onAnimationEnd fires when the (finite, forwards) petal-fall completes
// — the inner wobble is infinite so it never triggers it — letting the
// parent drop this petal from state. The target===currentTarget guard
// ignores any animationend bubbling up from the child spinner.
function PetalEl({ p, onDone }: { p: PetalSpec; onDone: () => void }) {
  const s = {
    left: `${p.left}%`, top: `${p.topOffset}px`,
    ["--size"]: `${p.size}px`, ["--rotation"]: `${p.rotation}deg`,
    ["--drift"]: `${p.drift}px`, ["--duration"]: `${p.duration}s`,
    ["--delay"]: `${p.delay}s`, ["--opacity-max"]: `${p.opacityMax}`,
  } as React.CSSProperties;
  return (
    <div
      className={styles.petal}
      style={s}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) onDone();
      }}
    >
      <div className={styles.petalSpinner}>{SAKURA_VARIANTS[p.variant]}</div>
    </div>
  );
}
