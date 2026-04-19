"use client";

import { useEffect, useState } from "react";
import { Season, getCurrentSeason, subscribe } from "@/game/seasons";

const KANJI: Record<Season, string> = {
  [Season.HARU]: "春",
  [Season.NATSU]: "夏",
  [Season.AKI]: "秋",
  [Season.FUYU]: "冬",
};

/** Small top-right kanji marker that swaps + fades on season change. */
export default function SeasonBadge() {
  const [season, setSeason] = useState(getCurrentSeason);

  useEffect(() => subscribe(setSeason), []);

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        top: "calc(max(4px, env(safe-area-inset-top)) + 10px)",
        right: 14,
        zIndex: 5,
        pointerEvents: "none",
      }}
    >
      <span
        key={season}
        className="kami-serif season-badge-anim"
        style={{
          fontSize: 22,
          color: "rgba(200, 168, 78, 0.75)",
          textShadow: "0 1px 3px rgba(0,0,0,0.5)",
        }}
      >
        {KANJI[season]}
      </span>
    </div>
  );
}
