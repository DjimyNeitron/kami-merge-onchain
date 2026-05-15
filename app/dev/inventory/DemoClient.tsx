"use client";

// Client-side demo for the Inventory architecture, with three things
// no production route should have:
//
//   1. Mini App viewport simulator — a frame whose width is
//      switchable (360 / 390 / 440 / 428) so the dev can see how the
//      Inventory looks at the realistic Mini App modal width instead
//      of the desktop full-bleed that always lies about how cramped
//      mobile actually is.
//
//   2. Sizing playground — sliders for overview / tier / detail
//      card widths so the dev can iterate live on the optimal pixel
//      values before locking them as production defaults. Find the
//      sweet spot in real time, paste numbers back into Inventory.tsx.
//
//   3. Mock state controls — Add Random / Add All 44 / Clear, plus
//      Force-screen buttons that remount Inventory with a forced
//      initialScreen so any of the three screens can be inspected
//      directly without click-throughs.

import { useState } from "react";
import Inventory, { type InventoryScreen } from "@/components/Inventory";
import { useInventory } from "@/hooks/useInventory";
import {
  TIER_ORDER,
  YOKAI_ORDER,
  type Tier,
  type YokaiName,
} from "@/config/yokai";

type ViewportPreset = {
  label: string;
  width: number;
};

const VIEWPORTS: ViewportPreset[] = [
  { label: "360px (iPhone SE)", width: 360 },
  { label: "390px (iPhone 14)", width: 390 },
  { label: "428px (iPhone Pro Max)", width: 428 },
  { label: "440px (Mini App default)", width: 440 },
];

export default function DemoClient() {
  const inventory = useInventory();
  const [viewportWidth, setViewportWidth] = useState(440);
  const [overviewCardWidth, setOverviewCardWidth] = useState(198);
  const [tierCardWidth, setTierCardWidth] = useState(198);
  const [detailCardWidth, setDetailCardWidth] = useState(360);
  const [forcedScreen, setForcedScreen] = useState<InventoryScreen | null>(
    null
  );
  // Bump on every force-screen click so Inventory remounts and picks
  // up the new initialScreen — without the key change, switching
  // initialScreen mid-flight wouldn't reset the internal state.
  const [forceKey, setForceKey] = useState(0);

  const applyForce = (screen: InventoryScreen | null) => {
    setForcedScreen(screen);
    setForceKey((k) => k + 1);
  };

  // Pick a stable "Kodama Epic" token if one is owned, for the
  // force-detail button. If not owned, button falls back to the
  // first available NFT.
  const sampleDetailTokenId = (() => {
    const kodamaEpic = inventory.nfts.find(
      (n) => n.yokai === "kodama" && n.tier === "epic"
    );
    if (kodamaEpic) return kodamaEpic.tokenId;
    return inventory.nfts[0]?.tokenId;
  })();

  const addRandom = () => {
    const yokai = YOKAI_ORDER[Math.floor(Math.random() * YOKAI_ORDER.length)];
    const tier = TIER_ORDER[Math.floor(Math.random() * TIER_ORDER.length)];
    inventory._devAddMock(yokai, tier);
  };

  return (
    <main style={pageStyle}>
      <header style={titleBlock}>
        <h1 style={titleStyle}>Inventory — Mini App Preview</h1>
        <p style={subtitleStyle}>
          Internal dev page · viewport-accurate preview of the 3-screen
          collection flow · gated behind NODE_ENV !== &quot;production&quot;
        </p>
      </header>

      {/* ─── Top controls: viewport + force-screen + mock state ─── */}
      <div style={controlBar}>
        <div style={controlGroup}>
          <label style={controlLabel}>
            Viewport:&nbsp;
            <select
              value={viewportWidth}
              onChange={(e) => setViewportWidth(Number(e.target.value))}
              style={selectStyle}
            >
              {VIEWPORTS.map((v) => (
                <option key={v.width} value={v.width}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={controlGroup}>
          <span style={groupLabel}>Force screen:</span>
          <button
            type="button"
            style={miniBtn}
            onClick={() => applyForce({ name: "overview" })}
          >
            Overview
          </button>
          <button
            type="button"
            style={miniBtn}
            onClick={() => applyForce({ name: "yokai", yokai: "kodama" })}
          >
            Yokai (Kodama)
          </button>
          <button
            type="button"
            style={miniBtn}
            disabled={!sampleDetailTokenId}
            onClick={() =>
              sampleDetailTokenId &&
              applyForce({ name: "detail", tokenId: sampleDetailTokenId })
            }
          >
            Detail (Kodama Epic)
          </button>
          <button
            type="button"
            style={{ ...miniBtn, opacity: forcedScreen ? 1 : 0.4 }}
            onClick={() => applyForce(null)}
          >
            Reset
          </button>
        </div>

        <div style={controlGroup}>
          <span style={groupLabel}>
            Mock state: {inventory.count}/{inventory.total}
          </span>
          <button type="button" style={miniBtn} onClick={addRandom}>
            Add random
          </button>
          <button
            type="button"
            style={miniBtn}
            onClick={() => inventory._devAddAll()}
          >
            Add all 44
          </button>
          <button
            type="button"
            style={miniBtn}
            onClick={() => inventory._devClear()}
          >
            Clear
          </button>
        </div>
      </div>

      {/* ─── Sizing playground sliders ─── */}
      <div style={sliderBar}>
        <SliderRow
          label="Overview card"
          min={140}
          max={210}
          value={overviewCardWidth}
          onChange={setOverviewCardWidth}
        />
        <SliderRow
          label="Tier card"
          min={150}
          max={210}
          value={tierCardWidth}
          onChange={setTierCardWidth}
        />
        <SliderRow
          label="Detail card"
          min={280}
          max={420}
          value={detailCardWidth}
          onChange={setDetailCardWidth}
        />
      </div>

      {/* ─── Mini App frame simulator ─── */}
      <div style={frameOuter}>
        <div
          style={{
            ...frameInner,
            width: viewportWidth,
          }}
        >
          <Inventory
            key={`${forceKey}-${forcedScreen?.name ?? "auto"}`}
            initialScreen={forcedScreen ?? undefined}
            overviewCardWidth={overviewCardWidth}
            tierCardWidth={tierCardWidth}
            detailCardWidth={detailCardWidth}
          />
        </div>
      </div>
    </main>
  );
}

// ─── Slider row ────────────────────────────────────────────────────

interface SliderRowProps {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
}

function SliderRow({ label, min, max, value, onChange }: SliderRowProps) {
  return (
    <label style={sliderRow}>
      <span style={{ minWidth: 110, color: "rgba(232,200,130,0.7)" }}>
        {label}:
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: "#c8a04c" }}
      />
      <span
        style={{
          minWidth: 50,
          fontFamily: "ui-monospace, monospace",
          color: "#f5e6c8",
        }}
      >
        {value}px
      </span>
    </label>
  );
}

// ─── Styles (inline — independent of globals.css tokens) ───────────

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#0a0d22",
  color: "#e8c882",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
  padding: "20px 24px 80px",
};

const titleBlock: React.CSSProperties = {
  marginBottom: 16,
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

const controlBar: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 24,
  alignItems: "center",
  fontSize: 12,
  padding: "12px 0",
  borderBottom: "1px solid rgba(232, 200, 130, 0.15)",
  marginBottom: 12,
};

const controlGroup: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const controlLabel: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  letterSpacing: "0.05em",
};

const groupLabel: React.CSSProperties = {
  color: "rgba(232, 200, 130, 0.7)",
  marginRight: 4,
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

const miniBtn: React.CSSProperties = {
  background: "rgba(15, 22, 38, 0.8)",
  color: "#e8c882",
  border: "1px solid rgba(232, 200, 130, 0.4)",
  padding: "5px 10px",
  borderRadius: 4,
  fontSize: 11,
  fontFamily: "inherit",
  letterSpacing: "0.04em",
  cursor: "pointer",
};

const sliderBar: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: "10px 0 16px",
  borderBottom: "1px solid rgba(232, 200, 130, 0.15)",
  marginBottom: 24,
};
const sliderRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  fontSize: 12,
};

const frameOuter: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  padding: "0 0 32px",
};
const frameInner: React.CSSProperties = {
  height: 900,
  border: "2px solid #333",
  borderRadius: 24,
  overflow: "hidden",
  background: "#0a0d22",
  position: "relative",
  boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
};
