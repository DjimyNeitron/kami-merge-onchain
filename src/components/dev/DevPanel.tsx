"use client";

import { useState } from "react";
import { YOKAI_CHAIN } from "@/config/yokai";

export type DevPanelProps = {
  onSpawn: (yokaiId: number) => void;
  onClearField: () => void;
  godMode: boolean;
  onToggleGodMode: () => void;
  onUnlockAll: () => void;
  allUnlocked: boolean;
};

/**
 * Red/neutral dev-test overlay. Rendered only when useDevMode() === true
 * (URL contains ?dev=1). Plain import — module ships in prod bundles
 * but never renders without the URL flag.
 *
 * Visual style deliberately diverges from the game's gold palette — red
 * tab + dark neutral body + font-mono — so it reads as "service UI" and
 * is never mistaken for gameplay surface.
 */
export default function DevPanel({
  onSpawn,
  onClearField,
  godMode,
  onToggleGodMode,
  onUnlockAll,
  allUnlocked,
}: DevPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className="fixed bottom-0 left-0 right-0 font-mono text-xs pointer-events-none"
      style={{ zIndex: 200 }}
    >
      {/* Tab — always visible, ~32px tall */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        type="button"
        className="pointer-events-auto mx-auto block px-4 py-1 bg-red-900/90 text-red-100 rounded-t-md border border-red-700 hover:bg-red-800 active:bg-red-950"
      >
        {isOpen ? "▼ DEV" : "▲ DEV"}
      </button>

      {isOpen && (
        <div className="pointer-events-auto bg-neutral-900/95 border-t border-red-700 px-4 py-3 flex flex-col gap-2 max-h-[220px] overflow-y-auto">
          {/* Row 1: controls */}
          <div className="flex flex-wrap gap-2 items-center text-red-100">
            <span className="text-red-400 font-bold tracking-wider">
              DEV MODE
            </span>
            <button
              onClick={onToggleGodMode}
              type="button"
              className={`px-2 py-1 rounded border transition-colors ${
                godMode
                  ? "bg-green-700 border-green-500 text-white"
                  : "bg-neutral-800 border-neutral-600 hover:bg-neutral-700"
              }`}
            >
              God Mode: {godMode ? "ON" : "OFF"}
            </button>
            <button
              onClick={onClearField}
              type="button"
              className="px-2 py-1 rounded border bg-neutral-800 border-neutral-600 hover:bg-neutral-700"
            >
              Clear Field
            </button>
            <button
              onClick={onUnlockAll}
              disabled={allUnlocked}
              type="button"
              className={`px-2 py-1 rounded border transition-colors ${
                allUnlocked
                  ? "bg-green-900 border-green-700 text-green-300 cursor-default"
                  : "bg-neutral-800 border-neutral-600 hover:bg-neutral-700"
              }`}
            >
              {allUnlocked ? "✓ All Unlocked" : "Unlock All Yokai"}
            </button>
            <span className="text-neutral-400 ml-auto">
              HS not saved in dev
            </span>
          </div>

          {/* Row 2: spawn buttons, one per yokai id */}
          <div className="flex gap-1 flex-wrap">
            {YOKAI_CHAIN.map((yokai) => (
              <button
                key={yokai.id}
                onClick={() => onSpawn(yokai.id)}
                type="button"
                title={`Spawn ${yokai.name}`}
                className="flex items-center gap-1.5 px-2 py-1 rounded border bg-neutral-800 border-neutral-600 hover:bg-neutral-700 text-white"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={yokai.sprite}
                  alt={yokai.name}
                  className="w-5 h-5 object-contain"
                />
                <span>
                  {yokai.id} {yokai.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
