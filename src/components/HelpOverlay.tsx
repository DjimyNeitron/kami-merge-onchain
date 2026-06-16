"use client";

// HelpOverlay — "How to Play" rules screen. Full-screen parchment overlay
// (the Settings / leaderboard skin, NOT the dark ceremony skin). Pure
// frontend: no backend, no contract, no auth.
//
// LIVE DATA: the mint threshold and the yokai chain are imported from
// source (single source of truth), so they always match the game:
//   - MIN_MINT_SCORE  ← src/lib/tierFromScore.ts
//   - YOKAI_ORDER / KANJI / TIER_ORDER ← src/config/yokai.ts
// The gacha odds table below is copied verbatim from tierFromScore.ts's
// (private, non-exported) DROP_MATRIX. If that matrix changes, update
// RARITY_BRACKETS here too. Values as of this build are reported in the PR.

import { useCallback, useEffect } from "react";
import {
  KANJI,
  TIER_ORDER,
  YOKAI_ORDER,
  type Tier,
} from "@/config/yokai";
import { MIN_MINT_SCORE } from "@/lib/tierFromScore";
import styles from "./HelpOverlay.module.css";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Mirror of tierFromScore.ts DROP_MATRIX + bracketFor() ranges (that const
// is not exported). Each row sums to 100.
const RARITY_BRACKETS: { label: string; odds: Record<Tier, number> }[] = [
  { label: "1,000–1,999", odds: { common: 50, rare: 38, epic: 10, legendary: 2 } },
  { label: "2,000–3,499", odds: { common: 25, rare: 45, epic: 24, legendary: 6 } },
  { label: "3,500–4,999", odds: { common: 10, rare: 35, epic: 40, legendary: 15 } },
  { label: "5,000+", odds: { common: 5, rare: 22, epic: 45, legendary: 28 } },
];

export default function HelpOverlay({ onClose }: { onClose: () => void }) {
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );
  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  return (
    <div
      data-game-overlay
      onClick={onClose}
      className={styles.backdrop}
      role="dialog"
      aria-label="How to Play"
    >
      <div className={styles.panelWrap} onClick={(e) => e.stopPropagation()}>
        <div className="wooden-rod absolute -top-1 left-3 right-3 h-3 rounded-full pointer-events-none" />

        <div className={`scroll-panel ${styles.panel}`}>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close help"
            className={styles.close}
          >
            ×
          </button>

          <h2 className={`kami-title ${styles.title}`}>How to Play</h2>
          <p className={`kami-serif ${styles.subtitle}`}>遊び方</p>

          {/* 1 — Goal */}
          <section className={styles.section}>
            <h3 className={styles.h3}>Goal</h3>
            <p className={styles.body}>
              Drop yokai into the well; two of the same merge into the next in
              the chain. Keep the stack below the line — overflow ends the run.
            </p>
            <p className={styles.tagline}>Drop · Merge · Ascend.</p>
          </section>

          <div className={styles.divider} />

          {/* 2 — The Ascension Chain */}
          <section className={styles.section}>
            <h3 className={styles.h3}>The Ascension Chain</h3>
            <ol className={styles.chain}>
              {YOKAI_ORDER.map((yokai, i) => (
                <li key={yokai} className={styles.chainItem}>
                  <span className={styles.chainKanji}>{KANJI[yokai]}</span>
                  <span className={styles.chainName}>{cap(yokai)}</span>
                  {i < YOKAI_ORDER.length - 1 && (
                    <span className={styles.chainArrow} aria-hidden="true">
                      ›
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </section>

          <div className={styles.divider} />

          {/* 3 — Mint Your Kami */}
          <section className={styles.section}>
            <h3 className={styles.h3}>Mint Your Kami</h3>
            <p className={styles.body}>
              When a run reaches{" "}
              <strong>{MIN_MINT_SCORE.toLocaleString()}</strong> points, you can
              mint that run&apos;s kami as an NFT on Soneium — an on-chain claim.
              One mint per kami type per wallet.
            </p>
          </section>

          <div className={styles.divider} />

          {/* 4 — Rarity Odds */}
          <section className={styles.section}>
            <h3 className={styles.h3}>Rarity Odds</h3>
            <p className={styles.body}>
              The tier you roll is score-scaled — a higher score shifts the odds
              toward Epic and Legendary (but Legendary is never guaranteed).
            </p>
            <div className={styles.tableScroll}>
              <table className={`kami-serif ${styles.table}`}>
                <thead>
                  <tr>
                    <th className={styles.thScore}>Score</th>
                    {TIER_ORDER.map((t) => (
                      <th key={t}>{cap(t)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {RARITY_BRACKETS.map((row) => (
                    <tr key={row.label}>
                      <td className={styles.tdScore}>{row.label}</td>
                      {TIER_ORDER.map((t) => (
                        <td key={t}>{row.odds[t]}%</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className={styles.divider} />

          {/* 5 — The Shrine */}
          <section className={styles.section}>
            <h3 className={styles.h3}>The Shrine</h3>
            <p className={styles.body}>
              Your collection of all 44 kami (11 yokai × 4 tiers) lives in the
              Shrine. Minted kami unlock there.
            </p>
          </section>
        </div>

        <div className="wooden-rod absolute -bottom-1 left-3 right-3 h-3 rounded-full pointer-events-none" />
      </div>
    </div>
  );
}
