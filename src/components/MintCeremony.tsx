"use client";

// MintCeremony — post-run NFT reveal ceremony.
//
// Sequence (Brief v13 locked): a short intro, a decelerating tier
// "slot machine" spin, a card reveal with aurora, then a mock mint.
// The long anticipation phase (≈1.8 s of spinning) is deliberate —
// gacha research puts the dopamine peak in the anticipation, not the
// outcome, so the spin earns its length.
//
// State machine: a CeremonyPhase drives everything. JS only flips the
// phase; every fade / scale / cycle is a CSS transition or keyframe in
// MintCeremony.module.css (compositor-driven, survives a busy main
// thread). The timeline is entirely mount-driven — to replay, the
// caller remounts the component with a fresh key (see the dev route).
//
// Reuse: the revealed card is the Stage 3.3 NFTCard via its `width`
// prop. NFTCard / NFTCardProps / yokai.ts / useInventory.ts are all
// consumed read-only — none are modified (Stage 3.5 constraint).
//
// Mint is mocked: a 2 s delay then `useInventory._devAddMock`. Real
// wagmi contract writes are Stage 7.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import NFTCard from "@/components/NFTCard";
import styles from "./MintCeremony.module.css";
import { TIER_ORDER, type Tier, type YokaiName } from "@/config/yokai";
import { useInventory, type InventoryNFT } from "@/hooks/useInventory";

export type CeremonyPhase =
  | "intro" // 0.0–1.5 s — header + "you earned an NFT" text
  | "spinning" // tier slot animation
  | "revealing" // NFT card materialises with aurora
  | "mint-ready" // mint button available
  | "minting" // user tapped, mock tx in flight
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
  /** Dev-route hook — fires on every phase transition for the inspector. */
  onPhaseChange?: (phase: CeremonyPhase) => void;
}

// ─── Timing constants (ms) ──────────────────────────────────────────
const INTRO_MS = 1500;
const REVEAL_TO_MINT_MS = 1000;
const MINT_MOCK_MS = 2000;
const SUCCESS_HOLD_MS = 2000;

// Spin sequence: [tierIndex, durationMs] pairs. 15 fast cycles, then
// 4 decelerating steps, then a 400 ms landing on the real tier.
function buildSpinSequence(target: Tier): Array<[number, number]> {
  const targetIdx = TIER_ORDER.indexOf(target);
  const seq: Array<[number, number]> = [];
  for (let i = 0; i < 15; i++) seq.push([i % 4, 50]);
  seq.push([0, 80], [1, 120], [2, 180], [3, 250]);
  seq.push([targetIdx, 400]);
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

const CONFETTI_COLORS = ["#e8c840", "#9be8c8", "#8fb8ff", "#c89bff", "#f5d76e"];
const CONFETTI_COUNT = 14;

export default function MintCeremony({
  yokai,
  tier,
  score,
  onMintComplete,
  onClose,
  cardWidth = 280,
  onPhaseChange,
}: MintCeremonyProps) {
  const [phase, setPhase] = useState<CeremonyPhase>("intro");
  // Which tier index the slot indicator is currently showing.
  const [spinIdx, setSpinIdx] = useState(0);
  // Every setTimeout id, so unmount / remount cancels cleanly.
  const timers = useRef<number[]>([]);
  const inventory = useInventory();

  // Surface phase changes to the dev inspector.
  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase, onPhaseChange]);

  // Ceremony timeline — mount-driven. Replay = remount with a new key.
  useEffect(() => {
    const ids = timers.current;
    const at = (fn: () => void, ms: number) => {
      ids.push(window.setTimeout(fn, ms));
    };

    // Walk the spin sequence with a chain of variable-delay timeouts
    // (setInterval can't vary its interval mid-run).
    const runSpin = () => {
      const seq = buildSpinSequence(tier);
      let i = 0;
      const step = () => {
        if (i >= seq.length) {
          setPhase("revealing");
          // Subtle landing haptic where supported.
          if (typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate(30);
          }
          at(() => setPhase("mint-ready"), REVEAL_TO_MINT_MS);
          return;
        }
        const [tierIdx, dur] = seq[i];
        setSpinIdx(tierIdx);
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
      // Mock the chain write — persist to the localStorage-backed
      // inventory. Real wagmi mint lands in Stage 7.
      inventory._devAddMock(yokai, tier, score);
      const nft: InventoryNFT = {
        tokenId: `mock_${yokai}_${tier}_${Date.now()}`,
        yokai,
        tier,
        mintedAt: Date.now(),
        score,
      };
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

  // Confetti bits — positions / colours / delays randomised once so
  // they don't fall in lockstep, and stable across re-renders.
  const confetti = useMemo(
    () =>
      Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
        key: i,
        left: Math.random() * 100,
        delay: Math.random() * 500,
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
        {/* Empty frame — placeholder kanji + cycling tier indicator.
         *  Cross-fades out when the real card reveals. */}
        <div className={styles.emptyFrame}>
          <span className={styles.placeholderKanji}>神</span>
          <div className={`${styles.tierIndicator} ${TIER_CLASS[shownTier]}`}>
            {TIER_LABEL[shownTier]}
          </div>
        </div>

        {/* The revealed NFT card. interactive=false → static art with
         *  the holo always on (NFTCard seeds isInteracting=true), so
         *  the aurora is visible at its tier-scaled opacity for the
         *  reveal without needing a hover. */}
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

      <div className={styles.toast}>NFT minted!</div>

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
