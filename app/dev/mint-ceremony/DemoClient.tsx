"use client";

// Client-side demo for the MintCeremony component. Same dev-route
// shape as /dev/inventory:
//
//   1. Mini App viewport simulator — switchable frame (360 / 390 /
//      424 / 428) with the Startale danger-zone overlay so the
//      ceremony can be checked at the realistic modal size.
//   2. Force controls — yokai selector, score slider, a tier-override
//      toggle (manual tier vs auto-derive via tierFromScore), and a
//      Replay button that remounts the ceremony from phase=intro.
//   3. Phase inspector — shows the live CeremonyPhase reported by the
//      component via its onPhaseChange hook.
//
// MintCeremony's timeline is mount-driven, so "replay" is just a
// remount with a fresh key — no internal reset path needed.

import { useCallback, useMemo, useState } from "react";
import MintCeremony, { type CeremonyPhase } from "@/components/MintCeremony";
import { tierFromScore, MIN_MINT_SCORE } from "@/lib/tierFromScore";
import { TIER_ORDER, YOKAI_ORDER, type Tier, type YokaiName } from "@/config/yokai";

type ViewportPreset = { label: string; width: number; height: number };

// Same presets as /dev/inventory. Startale 424×695 is the official
// Mini App frame (docs.startale.com/miniapps/media-specs) and the
// default — the ceremony must fit its 556 px usable height.
const VIEWPORTS: ViewportPreset[] = [
  { label: "360 × 640 (iPhone SE)", width: 360, height: 640 },
  { label: "390 × 844 (iPhone 14)", width: 390, height: 844 },
  { label: "424 × 695 (Startale official)", width: 424, height: 695 },
  { label: "428 × 926 (iPhone Pro Max)", width: 428, height: 926 },
];
const STARTALE_PRESET_INDEX = 2;

function toTitle(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function DemoClient() {
  const [viewportIndex, setViewportIndex] = useState(STARTALE_PRESET_INDEX);
  const viewport = VIEWPORTS[viewportIndex];

  const [selectedYokai, setSelectedYokai] = useState<YokaiName>("kodama");
  const [score, setScore] = useState(2847);
  const [tierOverride, setTierOverride] = useState(false);
  const [overrideTier, setOverrideTier] = useState<Tier>("epic");

  // Bumped by Replay — keys the MintCeremony so it remounts (its
  // timeline is mount-driven) AND re-seeds the derived-tier memo.
  const [replayKey, setReplayKey] = useState(0);
  const [currentPhase, setCurrentPhase] = useState<CeremonyPhase>("intro");

  // Effective tier for this ceremony run.
  // - override ON  → the manually picked tier
  // - override OFF → a fresh tierFromScore() roll (Math.random, so
  //   each Replay genuinely re-rolls the gacha distribution).
  // null only when override is off AND score < MIN_MINT_SCORE.
  const effectiveTier = useMemo<Tier | null>(() => {
    if (tierOverride) return overrideTier;
    return tierFromScore(score);
    // replayKey in deps so each Replay produces a fresh roll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tierOverride, overrideTier, score, replayKey]);

  const handlePhaseChange = useCallback((p: CeremonyPhase) => {
    setCurrentPhase(p);
  }, []);

  const replay = () => {
    setCurrentPhase("intro");
    setReplayKey((k) => k + 1);
  };

  return (
    <main style={pageStyle}>
      <div style={titleBlock}>
        <h1 style={titleStyle}>Mint Ceremony — Dev</h1>
        <p style={subtitleStyle}>
          Internal dev page · tier slot reveal + mock mint · gated
          behind NODE_ENV !== &quot;production&quot;
        </p>
      </div>

      {/* ─── Controls ─── */}
      <div style={controlBar}>
        <label style={controlLabel}>
          Viewport:&nbsp;
          <select
            value={viewportIndex}
            onChange={(e) => setViewportIndex(Number(e.target.value))}
            style={selectStyle}
          >
            {VIEWPORTS.map((v, i) => (
              <option key={v.label} value={i}>
                {v.label}
              </option>
            ))}
          </select>
        </label>

        <label style={controlLabel}>
          Yokai:&nbsp;
          <select
            value={selectedYokai}
            onChange={(e) => setSelectedYokai(e.target.value as YokaiName)}
            style={selectStyle}
          >
            {YOKAI_ORDER.map((y) => (
              <option key={y} value={y}>
                {toTitle(y)}
              </option>
            ))}
          </select>
        </label>

        <label style={controlLabel}>
          <input
            type="checkbox"
            checked={tierOverride}
            onChange={(e) => setTierOverride(e.target.checked)}
          />
          &nbsp;tier override
        </label>

        {tierOverride && (
          <label style={controlLabel}>
            Tier:&nbsp;
            <select
              value={overrideTier}
              onChange={(e) => setOverrideTier(e.target.value as Tier)}
              style={selectStyle}
            >
              {TIER_ORDER.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        )}

        <button type="button" style={replayBtn} onClick={replay}>
          ↻ Replay
        </button>
      </div>

      {/* Score slider on its own row — it's the widest control. */}
      <div style={sliderBar}>
        <label style={sliderRow}>
          <span style={{ minWidth: 64 }}>Score</span>
          <input
            type="range"
            min={0}
            max={10000}
            step={1}
            value={score}
            onChange={(e) => setScore(Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <span style={{ minWidth: 56, textAlign: "right" }}>
            {score.toLocaleString()}
          </span>
        </label>
      </div>

      {/* ─── Phase inspector ─── */}
      <div style={inspector}>
        <span>
          phase: <strong>{currentPhase}</strong>
        </span>
        <span>
          yokai: <strong>{selectedYokai}</strong>
        </span>
        <span>
          tier:{" "}
          <strong>
            {effectiveTier ?? "— (below mint threshold)"}
            {tierOverride ? " · forced" : " · rolled"}
          </strong>
        </span>
      </div>

      {/* ─── Mini App frame simulator ─── */}
      <div style={frameOuter}>
        <div
          style={{
            ...frameInner,
            width: viewport.width,
            height: viewport.height,
          }}
        >
          {effectiveTier ? (
            <MintCeremony
              key={replayKey}
              yokai={selectedYokai}
              tier={effectiveTier}
              score={score}
              cardWidth={280}
              onPhaseChange={handlePhaseChange}
            />
          ) : (
            <div style={gateNotice}>
              Score {score.toLocaleString()} is below the{" "}
              {MIN_MINT_SCORE.toLocaleString()} mint threshold — no
              ceremony. Raise the score or enable tier override.
            </div>
          )}

          {viewportIndex === STARTALE_PRESET_INDEX && (
            <div style={dangerZoneStyle} aria-hidden="true">
              <div style={dangerZoneLabelStyle}>
                STARTALE OVERLAY ZONE (avoid critical content)
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

// ─── Inline styles (dev-only, kept independent of globals.css) ──────

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#0a0d22",
  color: "#e8c882",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
  padding: "20px 24px 80px",
};
const titleBlock: React.CSSProperties = { marginBottom: 16 };
const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 22,
  letterSpacing: "0.05em",
  color: "#f5e6c8",
  fontFamily: "Georgia, serif",
};
const subtitleStyle: React.CSSProperties = {
  margin: "4px 0 0",
  fontSize: 11,
  color: "rgba(232, 200, 130, 0.6)",
  letterSpacing: "0.04em",
};
const controlBar: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 20,
  alignItems: "center",
  fontSize: 12,
  padding: "12px 0",
  borderBottom: "1px solid rgba(232, 200, 130, 0.15)",
};
const controlLabel: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  letterSpacing: "0.05em",
};
const selectStyle: React.CSSProperties = {
  background: "rgba(15, 22, 38, 0.8)",
  color: "#e8c882",
  border: "1px solid rgba(232, 200, 130, 0.4)",
  padding: "4px 8px",
  borderRadius: 4,
  fontSize: 12,
  fontFamily: "inherit",
};
const replayBtn: React.CSSProperties = {
  background: "rgba(15, 22, 38, 0.8)",
  color: "#e8c882",
  border: "1px solid rgba(232, 200, 130, 0.4)",
  padding: "6px 14px",
  borderRadius: 4,
  fontSize: 12,
  fontFamily: "inherit",
  letterSpacing: "0.05em",
  cursor: "pointer",
};
const sliderBar: React.CSSProperties = {
  padding: "12px 0",
  borderBottom: "1px solid rgba(232, 200, 130, 0.15)",
};
const sliderRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  fontSize: 12,
};
const inspector: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 20,
  fontSize: 12,
  padding: "12px 0 20px",
  color: "rgba(232, 200, 130, 0.85)",
};
const frameOuter: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  padding: "0 0 32px",
};
const frameInner: React.CSSProperties = {
  border: "2px solid #333",
  borderRadius: 24,
  overflow: "hidden",
  background: "#0a0d22",
  position: "relative",
  boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
};
const gateNotice: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
  padding: "0 32px",
  textAlign: "center",
  fontSize: 13,
  lineHeight: 1.6,
  color: "rgba(232, 200, 130, 0.7)",
  fontFamily: "Georgia, serif",
};
// Danger-zone overlay — bottom 20 % of the Startale preset, mirroring
// /dev/inventory. pointerEvents: none so it never blocks the ceremony.
const dangerZoneStyle: React.CSSProperties = {
  position: "absolute",
  bottom: 0,
  left: 0,
  right: 0,
  height: "20%",
  background:
    "repeating-linear-gradient(45deg, transparent 0, transparent 8px, rgba(255, 100, 100, 0.08) 8px, rgba(255, 100, 100, 0.08) 16px)",
  borderTop: "1px dashed rgba(255, 100, 100, 0.4)",
  pointerEvents: "none",
  zIndex: 1000,
};
const dangerZoneLabelStyle: React.CSSProperties = {
  position: "absolute",
  top: 4,
  left: 8,
  fontSize: 9,
  color: "rgba(255, 100, 100, 0.8)",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
  letterSpacing: 1,
};
