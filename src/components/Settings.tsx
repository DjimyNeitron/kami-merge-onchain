"use client";

import { useEffect, useState } from "react";
import { YOKAI_CHAIN } from "@/config/yokai";
import YokaiDetailCard from "@/components/YokaiDetailCard";
import SuzuIcon from "@/components/icons/SuzuIcon";
import TaikoIcon from "@/components/icons/TaikoIcon";
import { BGM_TRACKS, type BgmTrackId } from "@/game/bgmTracks";

type Props = {
  sfxEnabled: boolean;
  bgmEnabled: boolean;
  unlockedIds: number[];
  currentTrack: BgmTrackId | null;
  onSelectTrack: (id: BgmTrackId) => void;
  onToggleSfx: () => void;
  onToggleBgm: () => void;
  onClose: () => void;
};

const UNLOCKED_STORAGE_KEY = "kami_unlocked_yokai";

export default function Settings({
  sfxEnabled,
  bgmEnabled,
  unlockedIds,
  currentTrack,
  onSelectTrack,
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
      {/* Settings stays fully mounted + visible under the Detail Card.
       * Layered-modal pattern: Detail Card's own backdrop (z:120) dims this
       * panel visually without unmounting or fading it out — preserving
       * scroll position and removing the open/close flicker. */}
      <div
        className="fixed inset-0 flex items-center justify-center bg-black/65 backdrop-blur-sm"
        style={{ zIndex: 90 }}
        onClick={onClose}
      >
        <div
          className="relative mx-4 w-[min(360px,92%)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="wooden-rod absolute -top-1 left-3 right-3 h-3 rounded-full pointer-events-none" />
          {/* scroll-panel: flex-col so a sticky Close footer stays pinned
           * while the content above it scrolls. Height capped at
           * min(90vh, 800px) so the modal stays readable on every
           * surface — on a 600-700px Farcaster Mini App iframe 90vh
           * dominates and content scrolls cleanly; on a 1080p+ desktop
           * the 800px cap prevents the panel from ballooning. The
           * `min-h-0` on the scroll region is required: flex children
           * default to `min-height: auto`, which prevents shrinking
           * below intrinsic content size and defeats `overflow-y-auto`
           * on tight viewports. */}
          <div className="scroll-panel kami-serif text-[#3d2510] border-x border-[#8a6f28]/40 flex flex-col max-h-[min(90vh,800px)]">
            {/* Scrollable content region */}
            <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-4 pb-2">
              {/* H1 — only bold heading in the panel */}
              <div className="text-3xl font-bold tracking-[0.08em] text-center leading-none">
                Settings
              </div>
              <div className="text-base tracking-[0.2em] text-[#5c3a1e]/60 text-center mt-1">
                設定
              </div>
              <div className="h-px bg-gradient-to-r from-transparent via-[#8a6f28]/50 to-transparent my-2" />

              <ToggleRow
                icon={<SuzuIcon muted={!sfxEnabled} size={28} />}
                label="Sound"
                kanji="音"
                enabled={sfxEnabled}
                onToggle={onToggleSfx}
              />
              <ToggleRow
                icon={<TaikoIcon muted={!bgmEnabled} size={28} />}
                label="Music"
                kanji="楽"
                enabled={bgmEnabled}
                onToggle={onToggleBgm}
              />

              {/* Track picker — compact prev / name / next strip.
               *
               * The earlier radio-list version cost ~140px of vertical
               * room (4 rows × ~32px + label + gaps) which pushed the
               * Yokai Collection grid below the fold on Mini App
               * viewports. This single ~50px row gives the same
               * functionality (any of 4 tracks, see what's playing,
               * cyclic navigation) with ~3× less height.
               *
               * Disabled when Music is the master mute is off — the
               * track name still renders so the user sees what will
               * resume on re-enable; the prev/next buttons go inert.
               * Click triggers fade-swap-fade in AudioManager via the
               * unchanged onSelectTrack callback (no UI-side audio
               * logic). Wraps cyclically; if currentTrack is null
               * (engine hasn't booted yet) prev/next still pick the
               * first track. */}
              {(() => {
                const idx = BGM_TRACKS.findIndex(
                  (t) => t.id === currentTrack
                );
                const safeIdx = idx >= 0 ? idx : 0;
                const trackLabel =
                  BGM_TRACKS[safeIdx]?.name ?? "—";
                const goPrev = () => {
                  if (!bgmEnabled) return;
                  const prev =
                    BGM_TRACKS[
                      (safeIdx - 1 + BGM_TRACKS.length) % BGM_TRACKS.length
                    ];
                  onSelectTrack(prev.id);
                };
                const goNext = () => {
                  if (!bgmEnabled) return;
                  const next =
                    BGM_TRACKS[(safeIdx + 1) % BGM_TRACKS.length];
                  onSelectTrack(next.id);
                };
                const arrowBtnStyle: React.CSSProperties = {
                  width: 36,
                  height: 36,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 6,
                  background: bgmEnabled
                    ? "rgba(200, 168, 78, 0.10)"
                    : "transparent",
                  border: "1px solid rgba(138, 111, 40, 0.45)",
                  color: "#3d2510",
                  fontSize: 22,
                  lineHeight: 1,
                  cursor: bgmEnabled ? "pointer" : "not-allowed",
                  touchAction: "manipulation",
                };
                return (
                  <div
                    className="px-1 pt-0.5 pb-1"
                    style={{ opacity: bgmEnabled ? 1 : 0.4 }}
                  >
                    <div className="text-xs uppercase tracking-[0.2em] text-[#5c3a1e]/65 text-center mb-1">
                      Track
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          goPrev();
                        }}
                        onTouchEnd={(e) => {
                          if (!bgmEnabled) return;
                          e.stopPropagation();
                          e.preventDefault();
                          goPrev();
                        }}
                        disabled={!bgmEnabled}
                        aria-label="Previous track"
                        title="Previous track"
                        style={arrowBtnStyle}
                      >
                        <span aria-hidden="true">‹</span>
                      </button>
                      <span
                        className="flex-1 text-center text-sm text-[#3d2510] leading-tight truncate"
                        title={trackLabel}
                      >
                        {trackLabel}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          goNext();
                        }}
                        onTouchEnd={(e) => {
                          if (!bgmEnabled) return;
                          e.stopPropagation();
                          e.preventDefault();
                          goNext();
                        }}
                        disabled={!bgmEnabled}
                        aria-label="Next track"
                        title="Next track"
                        style={arrowBtnStyle}
                      >
                        <span aria-hidden="true">›</span>
                      </button>
                    </div>
                  </div>
                );
              })()}

              <div className="h-px bg-gradient-to-r from-transparent via-[#8a6f28]/50 to-transparent my-2" />

              {/* H2 — regular weight, matches Sound/Music size */}
              <div className="text-xl uppercase tracking-[0.2em] text-[#5c3a1e]/75 text-center">
                Yokai Collection
              </div>
              <div className="text-sm tracking-[0.15em] text-[#5c3a1e]/60 text-center mt-0.5 mb-1">
                妖怪図鑑
              </div>
              <div className="grid grid-cols-4 gap-x-2 gap-y-1 mb-1">
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
                      <div className="text-sm text-center text-[#3d2510] leading-tight">
                        {isUnlocked ? y.name : "???"}
                      </div>
                      <div className="text-xs tracking-[0.15em] text-[#5c3a1e]/60 leading-none">
                        {isUnlocked ? y.kanji : "\u00a0"}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-[#8a6f28]/50 to-transparent my-2" />

              <div className="text-[0.65rem] text-[#5c3a1e]/65 text-center tracking-wider">
                Made by Kody Productions · Powered by Soneium
              </div>
            </div>

            {/* Sticky footer — Close button always visible regardless of
             * scroll position. Top border + cream-fade blends it into the
             * parchment so it reads as an action bar, not a hard cut. */}
            <div
              className="shrink-0 px-5 pt-3 pb-4 flex justify-center border-t border-[#8a6f28]/25"
              style={{
                background:
                  "linear-gradient(to top, rgba(229,214,176,0.95), rgba(245,230,200,0.4))",
              }}
            >
              <button
                onClick={onClose}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onClose();
                }}
                type="button"
                className="wood-btn px-6 py-2 rounded-md text-base tracking-wider flex flex-col items-center leading-tight"
                style={{ touchAction: "manipulation" }}
              >
                <span>Close</span>
                <span className="text-xs tracking-[0.15em] opacity-70 mt-0.5">
                  閉じる
                </span>
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
  kanji,
  enabled,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  kanji: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 px-1">
      <div className="flex items-center gap-3">
        <span
          className="inline-flex items-center justify-center"
          style={{
            width: 28,
            height: 28,
            color: "#c8a84e",
            opacity: enabled ? 1 : 0.5,
          }}
        >
          {icon}
        </span>
        <div className="flex flex-col leading-tight">
          {/* H2 — regular weight, sized to match Yokai Collection heading */}
          <span className="text-xl text-[#3d2510]">{label}</span>
          <span className="text-sm tracking-[0.15em] text-[#5c3a1e]/60">
            {kanji}
          </span>
        </div>
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
