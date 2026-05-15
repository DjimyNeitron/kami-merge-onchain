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
  height: number;
};

// Viewport presets. The Startale entry (424×695) is the **official**
// Mini App frame dimensions per docs.startale.com/miniapps/media-specs
// — we previously guessed 440 px wide, but the real chrome is 424 wide
// and (critically) only 695 tall. That ~205 px gap matters for any
// Inventory screen that wants the detail card + lore + actions to fit
// without scrolling. Defaulting the simulator to this exact preset
// keeps the dev preview accurate to what reviewers will actually see.
const VIEWPORTS: ViewportPreset[] = [
  { label: "360 × 640 (iPhone SE)", width: 360, height: 640 },
  { label: "390 × 844 (iPhone 14)", width: 390, height: 844 },
  { label: "424 × 695 (Startale official)", width: 424, height: 695 },
  { label: "428 × 926 (iPhone Pro Max)", width: 428, height: 926 },
];
// Index of the Startale entry — wired to default state below and to
// the danger-zone overlay's visibility check.
const STARTALE_PRESET_INDEX = 2;

export default function DemoClient() {
  const inventory = useInventory();
  const [viewportIndex, setViewportIndex] = useState(STARTALE_PRESET_INDEX);
  const viewport = VIEWPORTS[viewportIndex];
  // Initial values mirror the Stage 3.4 locked production defaults
  // (Inventory.tsx — 165 / 165 / 300). Sliders remain so future
  // viewport / layout experiments can explore beyond these, but on
  // first load the playground reflects exactly what every production
  // embed of <Inventory /> will render.
  const [overviewCardWidth, setOverviewCardWidth] = useState(165);
  const [tierCardWidth, setTierCardWidth] = useState(165);
  const [detailCardWidth, setDetailCardWidth] = useState(300);
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
      {/* Stage 3.4 locked production sizes are 165 / 165 / 300, but
       *  the slider ranges intentionally extend past the 2-column
       *  ceiling at 424 px viewport (190 px) so future experiments
       *  can explore wider single-column or larger-viewport layouts.
       *  Going past 195 on Overview/Tier wraps the grid to 1-per-row
       *  in the simulator — that's a valid layout to explore, not a
       *  bug. */}
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
          min={240}
          max={380}
          value={detailCardWidth}
          onChange={setDetailCardWidth}
        />
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
          <Inventory
            key={`${forceKey}-${forcedScreen?.name ?? "auto"}`}
            initialScreen={forcedScreen ?? undefined}
            overviewCardWidth={overviewCardWidth}
            tierCardWidth={tierCardWidth}
            detailCardWidth={detailCardWidth}
          />

          {/* Danger-zone overlay — only renders when the simulator is
           *  set to the Startale official preset. The Startale App
           *  may slide an info bar over the bottom ~20 % of a Mini
           *  App's viewport (per docs.startale.com/miniapps/media-specs),
           *  so any critical UI placed there gets occluded for real
           *  users. The striped overlay makes the danger zone visible
           *  during layout iteration. pointerEvents: none so the
           *  overlay doesn't intercept taps that would otherwise hit
           *  the Inventory beneath it. */}
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
// width + height now come from the active viewport preset (set inline
// at the render site). Removed the hardcoded `height: 900` that
// previously forced every preset to render in the same tall box.
const frameInner: React.CSSProperties = {
  border: "2px solid #333",
  borderRadius: 24,
  overflow: "hidden",
  background: "#0a0d22",
  position: "relative",
  boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
};

// Danger-zone overlay — sits at the bottom 20 % of the Startale frame
// preset. Diagonal red stripes (low alpha) + a dashed top border give
// the dev a clear visual reminder that any content shown in this band
// can be occluded by the Startale App info bar at runtime. Only
// rendered when the simulator is on the Startale preset; other
// viewports don't have this overlay constraint.
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
