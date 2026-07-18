"use client";

// TEMP DEBUG — remove after diagnosis (branch diag/farcaster-splash).
//
// Always-on on-screen log strip (bottom of the viewport) so the Farcaster
// splash-bounce cause can be screenshotted on a phone. pointer-events:none so
// it never blocks gameplay taps. Shows the last ~12 [DIAG] lines.

import { useEffect, useState } from "react";
import { subscribeDiag } from "@/lib/diagLog";

export default function DiagOverlay() {
  const [lines, setLines] = useState<string[]>([]);
  useEffect(() => subscribeDiag(setLines), []);

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 2147483647,
        maxHeight: "42vh",
        overflow: "hidden",
        pointerEvents: "none",
        background: "rgba(0,0,0,0.72)",
        color: "#7CFC00",
        fontFamily: "ui-monospace, Menlo, Consolas, monospace",
        fontSize: "10px",
        lineHeight: 1.35,
        padding: "4px 6px",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      {(lines.length ? lines.slice(-12) : ["[DIAG] waiting…"]).join("\n")}
    </div>
  );
}
