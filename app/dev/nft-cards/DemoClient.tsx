"use client";

// Client-side demo grid for NFTCard. Renders all 44 cards (11 yokai × 4
// tiers) with a sticky control bar for switching size / interactive /
// showLore props. Purely internal — see ./page.tsx for the
// NODE_ENV-based 404 gate.
//
// Layout: 11 labelled rows × 4 tier columns. Sticky header. No layout
// shift on size change — the row gap scales to keep things readable
// from 'sm' (160px wide cards) to 'lg' (360px wide cards).

import { useState } from "react";
import NFTCard from "@/components/NFTCard";
import {
  TIER_ORDER,
  YOKAI_ORDER,
  type Tier,
  type YokaiName,
} from "@/config/yokai";

type Size = "sm" | "md" | "lg";

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
        </div>
      </header>

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
