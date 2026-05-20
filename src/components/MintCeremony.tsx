"use client";

// MintCeremony — Stage 3.5c warm moonlit reveal scene. Same 8-phase
// state machine + timeline + audio cues + dev controls as PR #38;
// palette refined to match the game's warm-navy + amber-lantern world.
// Cold aurora ribbons removed; 4 amber corner lantern glows, denser
// gold/amber fireflies, and cool blue-white moonlight provide the new
// atmospheric balance.
//
// During the spin the silhouette displays the current tier's kanji
// full-card-size; after the land, NFTCard fades in with
// interactive=true so the player can touch-drag for holo + 3D tilt.
//
// NFTCard / yokai.ts / useInventory / ceremonySound / audioManager
// are all consumed read-only.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

// ─── Scene geometry (viewBox 424×695, the Startale Mini App frame) ──
const VIEW_W = 424;
const VIEW_H = 695;
const CIRCLE_CX = 212;
const CIRCLE_CY = 265;
const RUNE_R = 135;

// 8 kanji runes around the magic circle, percentage-positioned so the
// scene scales to non-424 viewports. Angles in degrees, -90° = top.
// prettier-ignore
const RUNES = ([
  { kanji: "天", angle: -90 }, { kanji: "海", angle: -45 },
  { kanji: "炎", angle: 0 }, { kanji: "影", angle: 45 },
  { kanji: "霊", angle: 90 }, { kanji: "月", angle: 135 },
  { kanji: "日", angle: 180 }, { kanji: "星", angle: -135 },
] as const).map((r, i) => {
  const rad = (r.angle * Math.PI) / 180;
  const x = CIRCLE_CX + Math.cos(rad) * RUNE_R;
  const y = CIRCLE_CY + Math.sin(rad) * RUNE_R;
  return { kanji: r.kanji, leftPct: (x / VIEW_W) * 100, topPct: (y / VIEW_H) * 100, delay: i * 0.4 };
});

// 10 fixed background stars + 14 fireflies (mix of gold + amber for
// warm-world consistency). Fireflies carry tone + pulse delay.
// prettier-ignore
const STARS = [
  { x: 8, y: 6, size: 2 }, { x: 28, y: 4, size: 1.5 }, { x: 56, y: 7, size: 1.5 },
  { x: 72, y: 3, size: 1.8 }, { x: 92, y: 8, size: 1.4 }, { x: 18, y: 14, size: 1.2 },
  { x: 50, y: 12, size: 1.2 }, { x: 80, y: 18, size: 1.6 }, { x: 6, y: 20, size: 1.3 },
  { x: 94, y: 22, size: 1.1 },
];
type FireflyTone = "gold" | "amber";
// prettier-ignore
const FIREFLIES: Array<{ x: number; y: number; size: number; delay: number; tone: FireflyTone }> = [
  { x: 18, y: 22, size: 1.5, delay: 0,   tone: "gold"  }, { x: 82, y: 25, size: 1.3, delay: 0.5, tone: "gold"  },
  { x: 15, y: 38, size: 1.2, delay: 1,   tone: "amber" }, { x: 86, y: 40, size: 1.6, delay: 1.5, tone: "gold"  },
  { x: 22, y: 50, size: 1.1, delay: 2,   tone: "amber" }, { x: 80, y: 53, size: 1.4, delay: 2.5, tone: "gold"  },
  { x: 15, y: 65, size: 1.3, delay: 3,   tone: "amber" }, { x: 85, y: 68, size: 1.2, delay: 3.5, tone: "gold"  },
  { x: 35, y: 30, size: 1.0, delay: 0.8, tone: "amber" }, { x: 68, y: 32, size: 0.9, delay: 1.3, tone: "amber" },
  { x: 30, y: 58, size: 1.1, delay: 1.8, tone: "gold"  }, { x: 72, y: 60, size: 1.0, delay: 2.3, tone: "amber" },
  { x: 40, y: 75, size: 0.8, delay: 2.8, tone: "amber" }, { x: 65, y: 78, size: 0.9, delay: 3.3, tone: "gold"  },
];

// Improved sakura — individual teardrop with a soft inner highlight
// (not the 5-petal flower stamp from PR #37). Drawn once, reused for
// every falling petal via JSX clone.
const SAKURA_PETAL_SVG = (
  <svg viewBox="0 0 12 18" width="100%" height="100%" aria-hidden="true">
    <path
      d="M 6 1 C 9.5 4, 10 11, 7 16 L 6.5 14 L 6 16 L 5.5 14 L 5 16 C 2 11, 2.5 4, 6 1 Z"
      fill="#ffc4d6"
    />
    <path
      d="M 6 3 C 4 6, 4 11, 5.5 14 L 6 13 Z"
      fill="#ffe0ec"
      opacity="0.6"
    />
  </svg>
);

const TORII_SVG = (
  <svg className={styles.torii} viewBox="0 0 280 200" aria-hidden="true">
    <polygon points="20,30 40,10 240,10 260,30" fill="#0d0a1a" />
    <rect x="14" y="30" width="252" height="12" fill="#0a0816" />
    <rect x="40" y="80" width="200" height="5" fill="#0a0816" opacity="0.7" />
    <rect x="48" y="42" width="14" height="158" fill="#0a0816" />
    <rect x="218" y="42" width="14" height="158" fill="#0a0816" />
    <rect x="136" y="42" width="6" height="158" fill="#06040d" opacity="0.7" />
  </svg>
);

const MAGIC_CIRCLE_SVG = (
  <svg className={styles.magicCircle} viewBox="0 0 424 695" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <g className={styles.magicCircleRotor}>
      <circle cx={CIRCLE_CX} cy={CIRCLE_CY} r="120" stroke="#c8a04c" strokeWidth="0.8" fill="none" opacity="0.85" />
      <circle cx={CIRCLE_CX} cy={CIRCLE_CY} r="105" stroke="#c8a04c" strokeWidth="0.6" fill="none" opacity="0.6" />
      <circle cx={CIRCLE_CX} cy={CIRCLE_CY} r="135" stroke="#c8a04c" strokeWidth="0.5" fill="none" opacity="0.35" strokeDasharray="3 4" />
    </g>
  </svg>
);

const RAYS_SVG = (
  <svg className={styles.rays} viewBox="0 0 424 695" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <g stroke="#ffda6e" strokeWidth="0.6" opacity="0.5">
      <line x1="212" y1="265" x2="140" y2="200" />
      <line x1="212" y1="265" x2="284" y2="200" />
      <line x1="212" y1="265" x2="120" y2="240" />
      <line x1="212" y1="265" x2="304" y2="240" />
      <line x1="212" y1="265" x2="120" y2="290" />
      <line x1="212" y1="265" x2="304" y2="290" />
      <line x1="212" y1="265" x2="140" y2="330" />
      <line x1="212" y1="265" x2="284" y2="330" />
    </g>
  </svg>
);

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
}

function makePetals(n: number, prefix: string): PetalSpec[] {
  return Array.from({ length: n }, (_, i) => ({
    key: `${prefix}${i}`, left: Math.random() * 100, topOffset: -(20 + Math.random() * 40),
    size: 10 + Math.random() * 6, rotation: Math.random() * 360, drift: (Math.random() - 0.5) * 100,
    duration: 4 + Math.random() * 3, delay: Math.random() * 2, opacityMax: 0.6 + Math.random() * 0.3,
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

  // Two memoised petal sets — drift is shown from card-materializing
  // onward (~30 petals), burst is the additional 30 that only mount
  // during the success phase. Each set has stable random parameters.
  const drift = useMemo(() => makePetals(30, "d"), []);
  const burst = useMemo(() => makePetals(30, "b"), []);

  const silhouetteStyle = {
    ["--tier-current"]: `var(--tier-${silhouetteTier})`,
  } as React.CSSProperties;
  const tierBannerStyle = {
    ["--tier-current"]: `var(--tier-${tier})`,
  } as React.CSSProperties;

  const showPetals =
    phase !== "intro" && phase !== "spinning";

  return (
    <div className={styles.ceremonyScene} data-phase={phase}>
      {/* 2 — background stars */}
      <div className={styles.stars} aria-hidden="true">
        {STARS.map((s, i) => (
          <span
            key={i}
            className={styles.star}
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
            }}
          />
        ))}
      </div>

      {/* 3 — distant torii silhouette */}
      {TORII_SVG}

      {/* 4 — warm amber lantern corner glows (replace PR #38 aurora ribbons) */}
      <div className={`${styles.lanternGlow} ${styles.lanternBottomLeft}`} aria-hidden="true" />
      <div className={`${styles.lanternGlow} ${styles.lanternBottomRight}`} aria-hidden="true" />
      <div className={`${styles.lanternGlow} ${styles.lanternTopLeft}`} aria-hidden="true" />
      <div className={`${styles.lanternGlow} ${styles.lanternTopRight}`} aria-hidden="true" />

      {/* 5 — moon halo (5 concentric layers) */}
      <div className={styles.moonHalo} aria-hidden="true">
        <div className={styles.moonLayer1} />
        <div className={styles.moonLayer2} />
        <div className={styles.moonLayer3} />
        <div className={styles.moonLayer4} />
        <div className={styles.moonLayer5} />
      </div>

      {/* 6 — magic circle + 8 kanji runes */}
      {MAGIC_CIRCLE_SVG}
      <div className={styles.runesContainer} aria-hidden="true">
        {RUNES.map((r) => (
          <span
            key={r.kanji}
            className={styles.rune}
            style={{
              left: `${r.leftPct}%`,
              top: `${r.topPct}%`,
              animationDelay: `${r.delay}s`,
            }}
          >
            {r.kanji}
          </span>
        ))}
      </div>

      {/* 7 / 8 — vertical light beam + radial rays */}
      <div className={styles.beamOuter} aria-hidden="true" />
      <div className={styles.beamMiddle} aria-hidden="true" />
      <div className={styles.beamCore} aria-hidden="true" />
      {RAYS_SVG}

      {/* 9 — bright core pulse */}
      <div className={styles.corePulse} aria-hidden="true">
        <div className={styles.coreOuter} />
        <div className={styles.coreInner} />
      </div>

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

      {/* 11a — sakura petals */}
      {showPetals && (
        <div className={styles.sakuraContainer} aria-hidden="true">
          {drift.map((p) => (
            <PetalEl key={p.key} p={p} />
          ))}
          {phase === "success" &&
            burst.map((p) => <PetalEl key={p.key} p={p} />)}
        </div>
      )}

      {/* 11b — 14 warm fireflies (gold + amber tones) */}
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
// spin keyframes; the teardrop SVG is shared (cloned via JSX reuse).
function PetalEl({ p }: { p: PetalSpec }) {
  const s = {
    left: `${p.left}%`, top: `${p.topOffset}px`,
    ["--size"]: `${p.size}px`, ["--rotation"]: `${p.rotation}deg`,
    ["--drift"]: `${p.drift}px`, ["--duration"]: `${p.duration}s`,
    ["--delay"]: `${p.delay}s`, ["--opacity-max"]: `${p.opacityMax}`,
  } as React.CSSProperties;
  return (
    <div className={styles.petal} style={s}>
      <div className={styles.petalSpinner}>{SAKURA_PETAL_SVG}</div>
    </div>
  );
}
