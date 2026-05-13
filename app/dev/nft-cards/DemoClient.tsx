"use client";

// Client-side demo for NFTCard. Two preview modes:
//
//   Grid (default)   — all 44 cards in an 11 × 4 labelled layout for
//                      cross-tier comparison at a glance.
//   Single           — one card centred at size 'lg' with yokai + tier
//                      dropdowns, for iteration / screenshot work.
//
// The control bar exposes the size selector + interactive + showLore
// toggles. Tilt on mobile is driven by direct touch drag (parallel to
// desktop mouse tilt), so no permission gate, no debug overlay, no
// gyroscope buttons here — see NFTCard.tsx for the unified
// applyTilt(clientX, clientY) helper.
//
// Purely internal — see ./page.tsx for the NODE_ENV-based 404 gate;
// the only people who land here are devs running `npm run dev`.

import { useCallback, useEffect, useState } from "react";
import NFTCard from "@/components/NFTCard";
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

  // DIAGNOSTIC — visible state panel for iPhone debug. Activates only
  // when URL contains ?debug=1 so production / casual dev runs see
  // nothing. Tracks: render count (catches "state changes but UI
  // doesn't"), event log (last 10), live values of every React state
  // bound by this component. NFTCard touch handlers also pipe into the
  // log via window.__cardDebugLog. All DIAGNOSTIC additions are marked
  // for easy removal after the iPhone state-mystery is identified.
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [renderCount, setRenderCount] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setShowDebug(window.location.search.includes("debug=1"));
  }, []);

  // DIAGNOSTIC — stable log function (setDebugLog from useState is
  // stable, so useCallback with empty deps gives a stable reference).
  // Stores last 10 entries with HH:MM:SS timestamp.
  const log = useCallback((msg: string) => {
    const ts = new Date().toISOString().slice(11, 19);
    setDebugLog((prev) => [...prev.slice(-9), `${ts} ${msg}`]);
  }, []);

  // DIAGNOSTIC — expose log() to NFTCard via window.__cardDebugLog.
  // Set after mount to ensure window exists; cleanup on unmount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    (
      window as unknown as { __cardDebugLog?: (m: string) => void }
    ).__cardDebugLog = log;
    return () => {
      delete (window as unknown as { __cardDebugLog?: (m: string) => void })
        .__cardDebugLog;
    };
  }, [log]);

  // DIAGNOSTIC — bump render counter when any tracked state changes.
  // If state mutates but counter doesn't tick, React isn't responding
  // to setState (a real but rare bug class — usually means setState
  // was called with the same reference / value).
  useEffect(() => {
    setRenderCount((n) => n + 1);
  }, [previewMode, size, interactive, showLore, selectedYokai, selectedTier]);

  // DIAGNOSTIC — handlers that wrap setState with a log line so we can
  // see if onChange fires AT ALL on iPhone (vs setState applies but UI
  // doesn't reflect it — different bug classes).
  const handleModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as PreviewMode;
    log(`Mode change attempt: ${val}`);
    setPreviewMode(val);
  };
  const handleSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as Size;
    log(`Size change attempt: ${val}`);
    setSize(val);
  };
  const handleYokaiChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as YokaiName;
    log(`Yokai change attempt: ${val}`);
    setSelectedYokai(val);
  };
  const handleTierChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as Tier;
    log(`Tier change attempt: ${val}`);
    setSelectedTier(val);
  };
  const handleInteractiveChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    log(`Interactive toggle: ${e.target.checked}`);
    setInteractive(e.target.checked);
  };
  const handleShowLoreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    log(`showLore toggle: ${e.target.checked}`);
    setShowLore(e.target.checked);
  };

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
      {/* DIAGNOSTIC — top-of-viewport panel showing live React state,
       *  render count, and the last 10 event log entries. URL-gated:
       *  only renders when window.location.search contains debug=1.
       *  Removable in one block when iPhone state-mystery is resolved. */}
      {showDebug && (
        <div style={debugPanelStyle}>
          <div>== React State ==</div>
          <div>
            previewMode: <strong>{previewMode}</strong>
          </div>
          <div>
            size: <strong>{size}</strong>
          </div>
          <div>
            interactive: <strong>{String(interactive)}</strong>
          </div>
          <div>
            showLore: <strong>{String(showLore)}</strong>
          </div>
          <div>
            selectedYokai: <strong>{selectedYokai}</strong>
          </div>
          <div>
            selectedTier: <strong>{selectedTier}</strong>
          </div>
          <div>
            render count: <strong>{renderCount}</strong>
          </div>
          <div>
            UA:{" "}
            {typeof navigator !== "undefined"
              ? navigator.userAgent.slice(0, 60)
              : "?"}
          </div>
          <div>
            viewport:{" "}
            {typeof window !== "undefined"
              ? `${window.innerWidth}×${window.innerHeight}`
              : "?"}
          </div>
          <div>
            scrollY:{" "}
            {typeof window !== "undefined" ? window.scrollY.toFixed(0) : "?"}
          </div>
          <div style={{ marginTop: 6 }}>== Event Log (last 10) ==</div>
          {debugLog.length === 0 ? (
            <div style={{ opacity: 0.6 }}>(no events yet)</div>
          ) : (
            debugLog.map((entry, i) => <div key={i}>{entry}</div>)
          )}
        </div>
      )}

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
              /* DIAGNOSTIC — wrapped with log; restore to inline
                 setPreviewMode after panel removed. */
              onChange={handleModeChange}
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
                  /* DIAGNOSTIC */
                  onChange={handleYokaiChange}
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
                  /* DIAGNOSTIC */
                  onChange={handleTierChange}
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
              /* DIAGNOSTIC */
              onChange={handleSizeChange}
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
              /* DIAGNOSTIC */
              onChange={handleInteractiveChange}
            />
            &nbsp;interactive
          </label>
          <label style={controlLabel}>
            <input
              type="checkbox"
              checked={showLore}
              /* DIAGNOSTIC */
              onChange={handleShowLoreChange}
            />
            &nbsp;showLore
          </label>
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

// DIAGNOSTIC — fixed top-of-viewport panel for state inspection on
// device. z-index 99999 ensures it sits above the sticky header
// (z=50) and every card. pointerEvents intentionally remains
// 'auto' so the panel is scrollable on mobile when log overflows.
const debugPanelStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  background: "rgba(0, 0, 0, 0.92)",
  color: "#0f9",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
  fontSize: 11,
  padding: 8,
  zIndex: 99999,
  lineHeight: 1.5,
  maxHeight: "40vh",
  overflowY: "auto",
  borderBottom: "1px solid #0f9",
  textShadow: "0 0 2px rgba(0,0,0,0.8)",
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
