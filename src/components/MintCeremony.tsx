"use client";

// MintCeremony — post-run NFT reveal ceremony.
//
// Sequence (Brief v13 locked, refined by Stage 3.5 polish): intro →
// decelerating tier slot-drum spin → a 3-beat reveal (card
// materialises matte → aurora rises → tier banner) → mock mint. The
// long anticipation (~2.16 s of spinning) is deliberate gacha pacing.
//
// State machine: a CeremonyPhase drives everything. JS only flips the
// phase + (on each spin step) the drum index; every fade / scale /
// slide is CSS (MintCeremony.module.css). The timeline is mount-
// driven — to replay, the caller remounts with a fresh key.
//
// The reveal is intentionally split into three phases so the player
// reads three distinct beats: "card revealed → magic awakens → tier
// confirmed". The card is the Stage 3.3 NFTCard (interactive=false,
// holo always on); the matte→full transition is a CSS saturate()
// filter on the wrapper, so the NFTCard itself is untouched.
//
// Sound: three procedural Web Audio cues (see src/lib/ceremonySound).
// Gated on the soundEnabled prop. Mint is mocked via
// useInventory._devAddMock; real wagmi writes are Stage 7.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import NFTCard from "@/components/NFTCard";
import styles from "./MintCeremony.module.css";
import { TIER_ORDER, type Tier, type YokaiName } from "@/config/yokai";
import { useInventory, type InventoryNFT } from "@/hooks/useInventory";
import { playTick, playChime, playMintSuccess } from "@/lib/ceremonySound";

export type CeremonyPhase =
  | "intro" // 0.0–1.5 s — header + "you earned an NFT"
  | "spinning" // ~2.16 s — tier slot drum
  | "card-materializing" // 0.5 s — card fades/unblurs in, still matte
  | "aurora-rising" // 0.6 s — saturation rises, holo "awakens"
  | "tier-banner" // 0.25 s — tier banner snaps in
  | "mint-ready" // mint button available
  | "minting" // mock tx in flight
  | "success"; // mint complete

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

// Drum geometry — one slot tall window, slots stacked inside.
const SLOT_H = 24;

// Spin sequence: [tierIndex, durationMs]. 12 fast cycles, 4
// decelerating steps, then a 500 ms landing on the real tier.
// Total ≈ 840 + 820 + 500 = 2160 ms (Stage 3.5 polish: ~20 % slower
// than the original 1.78 s).
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
const TIER_CLASS: Record<Tier, string> = {
  common: styles.tierCommon,
  rare: styles.tierRare,
  epic: styles.tierEpic,
  legendary: styles.tierLegendary,
};

const CONFETTI_COLORS = [
  "#ffd700",
  "#e8c840",
  "#ffa500",
  "#7f77dd",
  "#5dcaa5",
  "#ff6b9d",
];
const CONFETTI_COUNT = 40;

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

  // soundEnabled read through a ref so toggling it mid-ceremony
  // doesn't restart the mount-driven timeline effect.
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
          // Spin landed — kick off the 3-beat reveal.
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

  // Confetti — positions / colours / delays randomised once, stable
  // across re-renders.
  const confetti = useMemo(
    () =>
      Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
        key: i,
        left: Math.random() * 100,
        delay: Math.random() * 600,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      })),
    []
  );

  const shownTier = TIER_ORDER[spinIdx];

  return (
    <div className={styles.ceremony} data-phase={phase}>
      <div className={styles.header}>
        <p className={styles.runComplete}>Run complete</p>
        <p className={styles.score}>Score {score.toLocaleString()}</p>
      </div>

      <p className={styles.earned}>You earned an NFT</p>

      <div className={styles.stage} style={{ width: cardWidth }}>
        {/* Silhouette card — placeholder kanji + the slot drum. The
         *  data-tier attribute drives the per-tier frame border so the
         *  silhouette gives visual feedback as the drum cycles. */}
        <div className={styles.silhouetteCard} data-tier={shownTier}>
          <span className={styles.placeholderKanji}>神</span>
          {/* Slot drum — 4 stacked tier labels, one visible at a time.
           *  translateY slides the inner stack; CSS transition gives
           *  the mechanical slot feel during deceleration. */}
          <div className={styles.tierDrum}>
            <div
              className={styles.tierDrumInner}
              style={{ transform: `translateY(${-spinIdx * SLOT_H}px)` }}
            >
              {TIER_ORDER.map((t) => (
                <div key={t} className={styles.tierSlot}>
                  {TIER_LABEL[t]}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Revealed NFTCard. interactive=false → static art, holo on.
         *  The matte→full transition is a saturate() filter on this
         *  wrapper (see .revealCard in the CSS module) — the NFTCard
         *  itself is untouched. */}
        <div className={styles.revealCard}>
          <NFTCard
            yokai={yokai}
            tier={tier}
            width={cardWidth}
            interactive={false}
          />
        </div>
      </div>

      <div className={`${styles.tierBanner} ${TIER_CLASS[tier]}`}>
        ─ {TIER_LABEL[tier]} ─
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.mintButton}
          onClick={handleButton}
          disabled={phase === "minting"}
        >
          {phase === "minting" ? (
            <>
              <span className={styles.spinner} />
              Minting…
            </>
          ) : phase === "success" ? (
            "View collection →"
          ) : (
            "Mint to wallet"
          )}
        </button>
        <p className={styles.mintSub}>Free mint · gas ~$0.001</p>
      </div>

      {/* Success banner — large centred announcement, scale-pops in
       *  then auto-dismisses after 1.5 s (CSS chained animation). */}
      <div className={styles.successBanner}>
        <div className={styles.successIcon}>✓</div>
        <div className={styles.successText}>NFT MINTED</div>
        <div className={styles.successSubtext}>Added to your collection</div>
      </div>

      <div className={styles.confetti} aria-hidden="true">
        {confetti.map((c) => (
          <span
            key={c.key}
            className={styles.confettiBit}
            style={{
              left: `${c.left}%`,
              background: c.color,
              animationDelay: `${c.delay}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
