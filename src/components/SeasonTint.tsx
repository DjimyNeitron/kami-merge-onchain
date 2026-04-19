"use client";

import { useEffect, useState } from "react";
import {
  SEASON_CONFIG,
  TINT_FADE_MS,
  getCurrentSeason,
  subscribe,
} from "@/game/seasons";

/**
 * Full-screen color tint layer above the background image and below the
 * game canvas. Color + opacity cross-fade on season change via CSS.
 */
export default function SeasonTint() {
  const [season, setSeason] = useState(getCurrentSeason);

  useEffect(() => subscribe(setSeason), []);

  const cfg = SEASON_CONFIG[season];
  const transition = `background-color ${TINT_FADE_MS}ms ease-in-out, opacity ${TINT_FADE_MS}ms ease-in-out`;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 1,
        backgroundColor: cfg.tintColor,
        opacity: cfg.tintOpacity,
        transition,
      }}
    />
  );
}
