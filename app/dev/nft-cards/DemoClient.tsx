"use client";

// Client-side demo for NFTCard. Two preview modes:
//
//   Grid (default)   — all 44 cards in an 11 × 4 labelled layout for
//                      cross-tier comparison at a glance.
//   Single           — one card centred at size 'lg' with yokai + tier
//                      dropdowns, for iteration / screenshot work.
//
// The control bar also exposes the size selector, the interactive +
// showLore prop toggles, and the iOS "Enable Motion" affordance for
// the DeviceOrientation tilt path. A floating <GyroDebugOverlay> shows
// the singleton gyro state for diagnostic work on the actual device.
//
// Purely internal — see ./page.tsx for the NODE_ENV-based 404 gate;
// the only people who land here are devs running `npm run dev`.

import { useEffect, useState } from "react";
import NFTCard from "@/components/NFTCard";
import GyroDebugOverlay from "@/components/GyroDebugOverlay";
import { useGyroTilt } from "@/hooks/useGyroTilt";
import {
  TIER_ORDER,
  YOKAI_ORDER,
  type Tier,
  type YokaiName,
} from "@/config/yokai";

type Size = "sm" | "md" | "lg";
type PreviewMode = "grid" | "single";

// Title-case yokai name for the row label. The constant is lowercase so
// it joins cleanly with the asset filename convention, but the human
// label should read "Kodama" not "kodama".
function toTitle(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function DemoClient() {
  const [size, setSize] = useState<Size>("md");
  const [interactive, setInteractive] = useState(true);
  const [showLore, setShowLore] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("grid");
  const [selectedYokai, setSelectedYokai] = useState<YokaiName>("kodama");
  const [selectedTier, setSelectedTier] = useState<Tier>("legendary");

  // The hook is a module-singleton so calling it here AND inside every
  // NFTCard subscribes them all to the same shared state. The button
  // / hint elements below read this instance's view of permission +
  // events; cards see the same view through their own subscriptions.
  const gyro = useGyroTilt();

  // Scroll to top when the preview mode changes. Without this, a user
  // scrolled deep in the grid (e.g. at Amaterasu) who flips to single
  // mode keeps the scroll position — but single mode only has one
  // card sitting near the top of the document, so the viewport shows
  // blank space below the header. From the user's point of view the
  // mode dropdown "didn't switch" — which was the symptom reported
  // after PR #21. The body+html scroll target also handles browsers
  // that scroll one or the other depending on quirks mode.
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo(0, 0);
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  }, [previewMode]);

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div style={titleBlock}>
          <h1 style={titleStyle}>NFT Cards — 44 variants</h1>
          <p style={subtitleStyle}>
            Internal dev page · {YOKAI_ORDER.length} yokai × {TIER_ORDER.length}{" "}
            tiers · gated behind NODE_ENV !== &quot;production&quot;
          </p>
        </div>
        <div style={controlRow}>
          <label style={controlLabel}>
            Mode:&nbsp;
            <select
              value={previewMode}
              onChange={(e) => setPreviewMode(e.target.value as PreviewMode)}
              style={selectStyle}
            >
              <option value="grid">Grid (44 cards)</option>
              <option value="single">Single card</option>
            </select>
          </label>
          {previewMode === "single" && (
            <>
              <label style={controlLabel}>
                Yokai:&nbsp;
                <select
                  value={selectedYokai}
                  onChange={(e) =>
                    setSelectedYokai(e.target.value as YokaiName)
                  }
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
                Tier:&nbsp;
                <select
                  value={selectedTier}
                  onChange={(e) => setSelectedTier(e.target.value as Tier)}
                  style={selectStyle}
                >
                  {TIER_ORDER.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <label style={controlLabel}>
            Size:&nbsp;
            <select
              value={size}
              onChange={(e) => setSize(e.target.value as Size)}
              style={selectStyle}
            >
              <option value="sm">sm (160px)</option>
              <option value="md">md (240px)</option>
              <option value="lg">lg (360px)</option>
            </select>
          </label>
          <label style={controlLabel}>
            <input
              type="checkbox"
              checked={interactive}
              onChange={(e) => setInteractive(e.target.checked)}
            />
            &nbsp;interactive
          </label>
          <label style={controlLabel}>
            <input
              type="checkbox"
              checked={showLore}
              onChange={(e) => setShowLore(e.target.checked)}
            />
            &nbsp;showLore
          </label>

          {/* iOS-specific affordances. The "Enable Motion" button is
           *  the explicit-action replacement for the implicit-on-tap
           *  pattern we tried in PR #20 — first-tap-on-card was
           *  flaky on iOS (sometimes Safari suppresses the popup
           *  during scroll / fast tap). An explicit button is the
           *  documented Apple pattern and never gets swallowed.
           *  Hidden on Android / desktop where permissionState
           *  collapses to 'granted' or 'unsupported'. */}
          {gyro.permissionState === "pending" && (
            <button
              type="button"
              onClick={() => void gyro.requestPermission()}
              style={enableMotionBtnStyle}
            >
              Enable Motion (iOS)
            </button>
          )}
          {gyro.permissionState === "denied" && (
            <span style={hintErrorStyle}>
              Motion denied — re-enable in Safari → Settings → Motion &amp;
              Orientation Access
            </span>
          )}
          {gyro.permissionState === "granted" && gyro.eventCount === 0 && (
            <span style={hintWarnStyle}>
              Granted but no events — device may lack a gyro sensor
            </span>
          )}
        </div>
      </header>

      {previewMode === "grid" ? (
        <div style={gridStyle(size)}>
          {YOKAI_ORDER.map((yokai: YokaiName) => (
            <RowBlock
              key={yokai}
              yokai={yokai}
              size={size}
              interactive={interactive}
              showLore={showLore}
            />
          ))}
        </div>
      ) : (
        <div style={singleStyle}>
          <NFTCard
            yokai={selectedYokai}
            tier={selectedTier}
            size="lg"
            interactive={interactive}
            showLore={showLore}
          />
        </div>
      )}

      <GyroDebugOverlay />
    </main>
  );
}

interface RowProps {
  yokai: YokaiName;
  size: Size;
  interactive: boolean;
  showLore: boolean;
}

function RowBlock({ yokai, size, interactive, showLore }: RowProps) {
  return (
    <section style={rowStyle}>
      <div style={rowLabel}>{toTitle(yokai)}</div>
      <div style={rowCards(size)}>
        {TIER_ORDER.map((tier: Tier) => (
          <NFTCard
            key={`${yokai}_${tier}`}
            yokai={yokai}
            tier={tier}
            size={size}
            interactive={interactive}
            showLore={showLore}
          />
        ))}
      </div>
    </section>
  );
}

// ─── Styles (inline so the demo doesn't fight the global theme) ───
// Inline styles keep the demo independent of globals.css tokens — if
// someone refactors design tokens, this page keeps rendering. The
// look intentionally borrows Kami's indigo/gold palette so it doesn't
// feel like a totally foreign Storybook drop-in.

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#0a0d22",
  color: "#e8c882",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
  padding: "0 24px 64px",
};

const headerStyle: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 50,
  background: "rgba(10, 13, 34, 0.92)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  borderBottom: "1px solid rgba(232, 200, 130, 0.2)",
  padding: "20px 0 16px",
  marginBottom: 24,
};

const titleBlock: React.CSSProperties = {
  marginBottom: 12,
};

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

const controlRow: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 20,
  alignItems: "center",
  fontSize: 12,
};

const controlLabel: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  letterSpacing: "0.05em",
};

const enableMotionBtnStyle: React.CSSProperties = {
  padding: "8px 16px",
  background: "#5b21b6",
  color: "white",
  border: "none",
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
  letterSpacing: "0.05em",
};

const hintErrorStyle: React.CSSProperties = {
  color: "#f87171",
  fontSize: 12,
  letterSpacing: "0.03em",
};

const hintWarnStyle: React.CSSProperties = {
  color: "#fbbf24",
  fontSize: 12,
  letterSpacing: "0.03em",
};

const singleStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  alignItems: "flex-start",
  padding: "40px 0",
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

function gridStyle(size: Size): React.CSSProperties {
  // Vertical spacing scales with card size so the grid never feels
  // cramped or balloons with whitespace.
  const rowGap = size === "sm" ? 20 : size === "md" ? 28 : 40;
  return {
    display: "flex",
    flexDirection: "column",
    gap: rowGap,
  };
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const rowLabel: React.CSSProperties = {
  fontFamily: "Georgia, serif",
  fontSize: 14,
  letterSpacing: "0.15em",
  textTransform: "uppercase",
  color: "#f5e6c8",
  borderBottom: "1px solid rgba(232, 200, 130, 0.15)",
  paddingBottom: 6,
};

function rowCards(size: Size): React.CSSProperties {
  const colGap = size === "sm" ? 16 : size === "md" ? 24 : 32;
  return {
    display: "flex",
    flexWrap: "wrap",
    gap: colGap,
    paddingTop: 6,
  };
}
