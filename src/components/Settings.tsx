"use client";

import { useEffect, useState } from "react";
import { YOKAI_CHAIN } from "@/config/yokai";
import YokaiDetailCard from "@/components/YokaiDetailCard";
import FurinIcon from "@/components/icons/FurinIcon";

type Props = {
  sfxEnabled: boolean;
  bgmEnabled: boolean;
  unlockedIds: number[];
  onToggleSfx: () => void;
  onToggleBgm: () => void;
  onClose: () => void;
};

const UNLOCKED_STORAGE_KEY = "kami_unlocked_yokai";

export default function Settings({
  sfxEnabled,
  bgmEnabled,
  unlockedIds,
  onToggleSfx,
  onToggleBgm,
  onClose,
}: Props) {
  // Mirror localStorage so cross-tab unlocks also reflect live without
  // needing to close and reopen the modal. Same-tab unlocks come in via
  // the `unlockedIds` prop (fed from engine's onUnlockChange callback).
  const [storageUnlocked, setStorageUnlocked] = useState<number[]>(
    () => unlockedIds
  );
  useEffect(() => setStorageUnlocked(unlockedIds), [unlockedIds]);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== UNLOCKED_STORAGE_KEY || !e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue);
        if (Array.isArray(parsed)) setStorageUnlocked(parsed as number[]);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const effectiveUnlocked = storageUnlocked;
  const unlockedSet = new Set(effectiveUnlocked);
  const [openYokaiId, setOpenYokaiId] = useState<number | null>(null);

  return (
    <>
      <div
        className="fixed inset-0 flex items-center justify-center bg-black/65 backdrop-blur-sm"
        style={{
          zIndex: 90,
          // When the detail card is open we keep Settings mounted (preserves
          // scroll state + avoids re-render flicker) but fade it out so the
          // card backdrop isn't muddied by a ghost of the modal beneath.
          opacity: openYokaiId !== null ? 0 : 1,
          pointerEvents: openYokaiId !== null ? "none" : "auto",
          transition: "opacity 150ms ease",
        }}
        onClick={onClose}
      >
        <div
          className="relative mx-4 w-[min(360px,92%)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="wooden-rod absolute -top-1 left-3 right-3 h-3 rounded-full pointer-events-none" />
          <div className="scroll-panel px-5 py-6 text-[#3d2510] border-x border-[#8a6f28]/40 max-h-[80vh] overflow-y-auto">
            <div className="kami-serif text-2xl font-bold tracking-[0.1em] text-center">
              Settings
            </div>
            <div className="text-[0.65rem] tracking-[0.3em] text-[#5c3a1e]/60 text-center mt-1">
              設定
            </div>
            <div className="h-px bg-gradient-to-r from-transparent via-[#8a6f28]/50 to-transparent my-4" />

            <ToggleRow
              icon={<FurinIcon enabled={sfxEnabled} size={18} />}
              label="Sound"
              enabled={sfxEnabled}
              onToggle={onToggleSfx}
            />
            <ToggleRow
              icon={<span style={{ fontSize: 16 }}>🎵</span>}
              label="Music"
              enabled={bgmEnabled}
              onToggle={onToggleBgm}
            />

            <div className="h-px bg-gradient-to-r from-transparent via-[#8a6f28]/50 to-transparent my-4" />

            <div className="kami-serif text-xs uppercase tracking-[0.25em] text-[#5c3a1e]/70 text-center mb-3">
              Yokai Collection
            </div>
            <div className="grid grid-cols-4 gap-2 mb-1">
              {YOKAI_CHAIN.map((y) => {
                const isUnlocked = unlockedSet.has(y.id);
                return (
                  <button
                    key={y.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isUnlocked) setOpenYokaiId(y.id);
                    }}
                    onTouchEnd={(e) => {
                      if (!isUnlocked) return;
                      e.stopPropagation();
                      e.preventDefault();
                      setOpenYokaiId(y.id);
                    }}
                    disabled={!isUnlocked}
                    className="flex flex-col items-center gap-0.5 p-1 rounded"
                    style={{
                      background: isUnlocked
                        ? "rgba(200, 168, 78, 0.12)"
                        : "transparent",
                      border: "none",
                      cursor: isUnlocked ? "pointer" : "default",
                      touchAction: "manipulation",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={y.sprite}
                      alt={y.name}
                      style={{
                        width: 40,
                        height: 40,
                        objectFit: "contain",
                        opacity: isUnlocked ? 1 : 0.3,
                        filter: isUnlocked
                          ? "drop-shadow(0 0 3px rgba(200,168,78,0.5))"
                          : "grayscale(1) brightness(0.7)",
                      }}
                    />
                    <div className="kami-serif text-[0.55rem] text-center text-[#3d2510] leading-tight">
                      {isUnlocked ? y.name : "???"}
                    </div>
                    <div className="text-[0.55rem] text-[#5c3a1e]/60 leading-none">
                      {isUnlocked ? y.kanji : "\u00a0"}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-[#8a6f28]/50 to-transparent my-4" />

            <div className="kami-serif text-[0.65rem] text-[#5c3a1e]/65 text-center tracking-wider">
              Made by Kody · Powered by Soneium
            </div>

            <div className="mt-5 flex justify-center">
              <button
                onClick={onClose}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onClose();
                }}
                type="button"
                className="wood-btn kami-serif px-6 py-2 rounded-md text-sm font-semibold tracking-wider"
                style={{ touchAction: "manipulation" }}
              >
                Close
              </button>
            </div>
          </div>
          <div className="wooden-rod absolute -bottom-1 left-3 right-3 h-3 rounded-full pointer-events-none" />
        </div>
      </div>

      {openYokaiId !== null && (
        <YokaiDetailCard
          yokaiId={openYokaiId}
          unlockedIds={effectiveUnlocked}
          onClose={() => setOpenYokaiId(null)}
          onNavigate={setOpenYokaiId}
        />
      )}
    </>
  );
}

function ToggleRow({
  icon,
  label,
  enabled,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-2 px-1">
      <div className="flex items-center gap-3">
        <span
          className="inline-flex items-center justify-center"
          style={{ width: 20, height: 20, color: "#c8a84e", opacity: enabled ? 1 : 0.5 }}
        >
          {icon}
        </span>
        <span className="kami-serif font-semibold text-[#3d2510]">
          {label}
        </span>
      </div>
      <button
        onClick={onToggle}
        onTouchEnd={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onToggle();
        }}
        type="button"
        aria-label={`Toggle ${label}`}
        style={{
          width: "48px",
          minWidth: "48px",
          maxWidth: "48px",
          height: "24px",
          flex: "0 0 48px",
          display: "inline-block",
          position: "relative",
          boxSizing: "border-box",
          borderRadius: "9999px",
          padding: 0,
          margin: 0,
          border: "none",
          background: enabled ? "#8a6f28" : "#4a4a4a",
          transition: "background-color 0.2s",
          touchAction: "manipulation",
          cursor: "pointer",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: "50%",
            left: "2px",
            width: "20px",
            height: "20px",
            margin: 0,
            boxSizing: "border-box",
            borderRadius: "9999px",
            background: "#ffffff",
            boxShadow: "0 1px 2px rgba(0, 0, 0, 0.3)",
            transform: enabled
              ? "translate(24px, -50%)"
              : "translate(0, -50%)",
            transition: "transform 0.2s",
          }}
        />
      </button>
    </div>
  );
}
