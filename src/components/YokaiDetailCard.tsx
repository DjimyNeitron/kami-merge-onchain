"use client";

import { useEffect, useRef, useState } from "react";
import { getYokai } from "@/config/yokai";

// Must match the duration of the .yokai-card-fade-out animation in globals.css.
// Uses the backdrop exit (300ms) — slightly longer than the card (280ms) so
// the onClose() fires after both animations have fully finished.
const EXIT_ANIMATION_MS = 300;

type Props = {
  yokaiId: number;
  unlockedIds: number[];
  onClose: () => void;
  onNavigate: (newId: number) => void;
};

/**
 * Lore card for an unlocked yokai. Styled as a parchment panel with a "book
 * binding" ribbon at top (thin) and bottom (thicker) flush to the card
 * edges. Swipe / arrow-keys navigate unlocked entries only.
 */
export default function YokaiDetailCard({
  yokaiId,
  unlockedIds,
  onClose,
  onNavigate,
}: Props) {
  const yokai = getYokai(yokaiId);
  const ordered = [...unlockedIds].sort((a, b) => a - b);
  const idx = ordered.indexOf(yokaiId);
  const prevId = idx > 0 ? ordered[idx - 1] : null;
  const nextId =
    idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : null;

  // Two-phase close: play the exit animation, then notify the parent
  // (which unmounts us). A guard prevents double-triggering if the user
  // taps × / backdrop multiple times during the 220ms window.
  const [isClosing, setIsClosing] = useState(false);
  const handleClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    window.setTimeout(onClose, EXIT_ANIMATION_MS);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isClosing) return;
      if (e.key === "Escape") handleClose();
      else if (e.key === "ArrowLeft" && prevId !== null) onNavigate(prevId);
      else if (e.key === "ArrowRight" && nextId !== null) onNavigate(nextId);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prevId, nextId, isClosing, onNavigate]);

  const touchStartX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    if (isClosing) return;
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (isClosing) return;
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start === null) return;
    const dx = e.changedTouches[0].clientX - start;
    if (Math.abs(dx) < 50) return;
    if (dx > 0 && prevId !== null) onNavigate(prevId);
    else if (dx < 0 && nextId !== null) onNavigate(nextId);
  };

  if (!yokai) return null;

  // Alpha-aware shadow applied directly to the sprite. Two stacked
  // drop-shadows — one tight+dense to plug the PNG's translucent body
  // (Oni 25% body<255, Tanuki 13%, etc.) so cream parchment can't bleed
  // through, and one wider+softer as an ambient halo that grounds the
  // sprite on the parchment without drawing a competing disc. Because
  // drop-shadow follows the alpha silhouette, the shape follows Oni's
  // horns, Tanuki's ears, Kodama's leaves — never a circle.
  const spriteShadow =
    "drop-shadow(0 0 10px rgba(26,21,40,0.85)) drop-shadow(0 0 18px rgba(26,21,40,0.55))";

  return (
    <div
      data-game-overlay
      className={`fixed inset-0 flex items-center justify-center ${
        isClosing ? "yokai-card-fade-out" : "yokai-card-fade-in"
      }`}
      style={{
        zIndex: 120,
        // Game atmosphere shows through — blurred + gently darkened, never
        // pure black. backdrop-filter is supported in iOS Safari 9+.
        backgroundColor: "rgba(0, 0, 0, 0.55)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
      onClick={handleClose}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="relative mx-4 w-[min(400px,92%)] scroll-panel-wrapper"
        style={{ height: 540 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="scroll-panel rounded-lg border-x border-[#8a6f28]/40 h-full flex flex-col overflow-hidden"
          style={{ color: "#3d2510" }}
        >
          {/* Top book-binding ribbon — flush to card top */}
          <div className="wooden-rod shrink-0" style={{ height: 8 }} />

          {/* Body — flex-1 so card dimensions stay identical across yokai */}
          <div className="flex-1 flex flex-col items-center px-6 pt-6 pb-4 relative overflow-y-auto">
            {/* Close × */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClose();
              }}
              onTouchEnd={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleClose();
              }}
              type="button"
              aria-label="Close"
              className="kami-serif absolute top-1 right-3 leading-none"
              style={{
                fontSize: 28,
                color: "#c8a84e",
                background: "transparent",
                border: "none",
                padding: 4,
                cursor: "pointer",
                touchAction: "manipulation",
              }}
            >
              ×
            </button>

            {/* Sprite with alpha-shaped drop-shadow — no enclosing medallion disc */}
            <div
              style={{
                width: 200,
                height: 200,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={yokai.sprite}
                alt={yokai.name}
                style={{
                  width: 180,
                  height: 180,
                  objectFit: "contain",
                  filter: spriteShadow,
                }}
              />
            </div>

            <div
              className="kami-serif mt-1"
              style={{
                fontSize: 32,
                fontWeight: 700,
                color: "#c8a84e",
                letterSpacing: "0.04em",
                lineHeight: 1.1,
              }}
            >
              {yokai.kanji}
            </div>
            <div
              className="kami-serif mt-1"
              style={{
                fontSize: 16,
                color: "#8a6f28",
                letterSpacing: "2px",
                textTransform: "uppercase",
              }}
            >
              {yokai.name}
            </div>

            <div
              className="my-3 w-full h-px"
              style={{
                background:
                  "linear-gradient(to right, transparent, rgba(138,111,40,0.55), transparent)",
              }}
            />

            <p
              className="kami-serif"
              style={{
                fontSize: 14,
                color: "#3d2510",
                lineHeight: 1.7,
                maxWidth: 320,
                textAlign: "left",
              }}
            >
              {yokai.description}
            </p>

            <div
              className="mt-auto pt-3 w-full flex flex-col items-center"
              style={{ gap: 8 }}
            >
              <div
                className="w-full h-px"
                style={{
                  background:
                    "linear-gradient(to right, transparent, rgba(138,111,40,0.4), transparent)",
                }}
              />
              <div
                className="kami-serif"
                style={{
                  fontSize: 11,
                  color: "#8a6f28",
                  textTransform: "uppercase",
                  letterSpacing: "2px",
                }}
              >
                Merge #{yokai.id}
              </div>
            </div>
          </div>

          {/* Bottom book-binding ribbon — thicker, flush to card bottom */}
          <div className="wooden-rod shrink-0" style={{ height: 14 }} />
        </div>
      </div>
    </div>
  );
}
