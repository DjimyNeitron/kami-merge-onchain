"use client";

// MintCeremony — post-run NFT reveal ceremony.
//
// Sequence (Brief v13 locked): intro → decelerating tier slot-drum
// spin → 3-beat reveal (card materialises matte → aurora rises →
// tier banner) → mock mint. State machine + phase timeline + drum
// mechanic are unchanged from PR #35/#36 — Stage 3.5 design-
// alignment touched only styling, audio source, layout, and
// particles (per the alignment spec's explicit "NOT changing" list).
//
// Design-system alignment (this revision):
//  - Slot drum + tier banner show kanji + English, parchment styling
//  - Mint button reuses the game's global .wood-btn class
//  - Success banner is a parchment paper card with kanji 完
//  - Confetti replaced by CSS sakura petals
//  - Ceremony audio reuses the game's marimba samples (ceremonySound)
//  - NFTCard rendered interactive — aurora hover + 3D touch tilt
//  - Dynamic Island safe-area inset + Startale danger-zone padding
//
// Mint is mocked via useInventory._devAddMock; real wagmi writes are
// Stage 7. NFTCard / yokai.ts / useInventory.ts are consumed
// read-only — none are modified.

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
  /** Fired ~2 s after a successful mint, with the new NFT record. */
  onMintComplete?: (nft: InventoryNFT) => void;
  /** Fired when the user taps the success-state "View collection" button. */
  onClose?: () => void;
  /** Revealed-card pixel width. Default 280. */
  cardWidth?: number;
  /** Ceremony sound cues. Default true. */
  soundEnabled?: boolean;
  /** Dev-route hook — fires on every phase transition for the inspector. */
  onPhaseChange?: (phase: CeremonyPhase) => void;
}

// ─── Timing constants (ms) ──────────────────────────────────────────
const INTRO_MS = 1500;
const MATERIALIZE_MS = 500;
const AURORA_MS = 600;
const BANNER_MS = 250;
const MINT_MOCK_MS = 2000;
const SUCCESS_HOLD_MS = 2000;

// Drum geometry — one slot tall window, 4 slots stacked inside. 56 px
// per slot fits the stacked kanji + English label.
const SLOT_H = 56;

// Spin sequence: [tierIndex, durationMs]. 12 fast cycles, 4
// decelerating steps, then a 500 ms landing on the real tier (~2.16 s).
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
// Tier kanji — 大 (big) → 中 (middle) → 上 (high) → 神 (divine).
const TIER_KANJI: Record<Tier, string> = {
  common: "大",
  rare: "中",
  epic: "上",
  legendary: "神",
};

// Five-petal sakura, drawn once and reused across all falling petals.
const SAKURA_SVG = (
  <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
    <g transform="translate(12 12)">
      <ellipse cx="0" cy="-6" rx="3.5" ry="5.5" fill="#ffc4d6" />
      <ellipse
        cx="0"
        cy="-6"
        rx="3.5"
        ry="5.5"
        fill="#ffc4d6"
        transform="rotate(72)"
      />
      <ellipse
        cx="0"
        cy="-6"
        rx="3.5"
        ry="5.5"
        fill="#ffb0c8"
        transform="rotate(144)"
      />
      <ellipse
        cx="0"
        cy="-6"
        rx="3.5"
        ry="5.5"
        fill="#ffc4d6"
        transform="rotate(216)"
      />
      <ellipse
        cx="0"
        cy="-6"
        rx="3.5"
        ry="5.5"
        fill="#ffb0c8"
        transform="rotate(288)"
      />
      <circle cx="0" cy="0" r="1.5" fill="#ffe0ec" />
    </g>
  </svg>
);
const SAKURA_COUNT = 30;

export default function MintCeremony({
  yokai,
  tier,
  score,
  onMintComplete,
  onClose,
  cardWidth = 280,
  soundEnabled = true,
  onPhaseChange,
}: MintCeremonyProps) {
  const [phase, setPhase] = useState<CeremonyPhase>("intro");
  const [spinIdx, setSpinIdx] = useState(0);
  const timers = useRef<number[]>([]);
  const inventory = useInventory();

  // soundEnabled via ref so toggling it mid-ceremony doesn't restart
  // the mount-driven timeline effect.
  const soundRef = useRef(soundEnabled);
  soundRef.current = soundEnabled;

  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase, onPhaseChange]);

  // Ceremony timeline — mount-driven. Replay = remount with a new key.
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
    if (phase === "success") {
      onClose?.();
    } else {
      handleMint();
    }
  };

  // Sakura petals — positions / timings randomised once, stable across
  // re-renders. Rendered only in the success phase.
  const petals = useMemo(
    () =>
      Array.from({ length: SAKURA_COUNT }, (_, i) => ({
        key: i,
        left: Math.random() * 95,
        duration: 3.5 + Math.random() * 2,
        delay: Math.random() * 0.8,
        drift: (Math.random() - 0.5) * 80,
      })),
    []
  );

  // Custom-property style objects — React.CSSProperties doesn't type
  // CSS vars, so cast through a string-indexed record.
  const tierBannerStyle = {
    ["--tier-current"]: `var(--tier-${tier})`,
  } as React.CSSProperties;

  return (
    <div className={styles.ceremony} data-phase={phase}>
      <div className={styles.header}>
        <p className={styles.runComplete}>Run complete</p>
        <p className={styles.score}>Score {score.toLocaleString()}</p>
      </div>

      <p className={styles.earned}>You earned an NFT</p>

      <div className={styles.stage} style={{ width: cardWidth }}>
        {/* Silhouette — dark frame + parchment inner holding the slot
         *  drum. Shown during intro + spinning, cross-fades out at
         *  reveal. */}
        <div className={styles.silhouetteCard}>
          <div className={styles.silhouetteInner}>
            <div className={styles.tierDrum}>
              <div
                className={styles.tierDrumInner}
                style={{ transform: `translateY(${-spinIdx * SLOT_H}px)` }}
              >
                {TIER_ORDER.map((t) => (
                  <div key={t} className={styles.tierSlot}>
                    <span className={styles.tierSlotKanji}>
                      {TIER_KANJI[t]}
                    </span>
                    <span className={styles.tierSlotEnglish}>
                      {TIER_LABEL[t]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Revealed NFTCard. interactive=true → after the reveal the
         *  player can touch-drag to tilt + summon the holo. The
         *  matte→full reveal is a saturate() filter on this wrapper
         *  (see .revealCard in the CSS module). */}
        <div className={styles.revealCard}>
          <NFTCard
            yokai={yokai}
            tier={tier}
            width={cardWidth}
            interactive={true}
          />
        </div>
      </div>

      {/* Tier banner — kanji + English in the tier's accent colour
       *  (set via the --tier-current custom property). */}
      <div className={styles.tierBanner} style={tierBannerStyle}>
        <span className={styles.tierBannerKanji}>{TIER_KANJI[tier]}</span>
        <span className={styles.tierBannerText}>{TIER_LABEL[tier]}</span>
      </div>

      <div className={styles.actions}>
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
        <p className={styles.mintSub}>Free mint · gas ~$0.001</p>
      </div>

      {/* Success banner — parchment paper card, kanji 完 ("complete"),
       *  scale-pops in then auto-dismisses after 1.5 s (CSS chained). */}
      <div className={styles.successBanner}>
        <div className={styles.successKanji}>完</div>
        <div className={styles.successText}>NFT MINTED</div>
        <div className={styles.successSubtext}>Added to your collection</div>
      </div>

      {/* Sakura petals — success only. Each falls + spins on its own
       *  randomised timing. */}
      {phase === "success" && (
        <div className={styles.sakuraContainer} aria-hidden="true">
          {petals.map((p) => (
            <div
              key={p.key}
              className={styles.sakuraPetal}
              style={
                {
                  left: `${p.left}%`,
                  ["--duration"]: `${p.duration}s`,
                  ["--delay"]: `${p.delay}s`,
                  ["--drift"]: `${p.drift}px`,
                } as React.CSSProperties
              }
            >
              <div className={styles.sakuraPetalInner}>{SAKURA_SVG}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
