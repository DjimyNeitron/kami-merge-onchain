"use client";

import { useEffect, useRef } from "react";
import { getYokai } from "@/config/yokai";

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && prevId !== null) onNavigate(prevId);
      else if (e.key === "ArrowRight" && nextId !== null) onNavigate(nextId);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prevId, nextId, onClose, onNavigate]);

  const touchStartX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start === null) return;
    const dx = e.changedTouches[0].clientX - start;
    if (Math.abs(dx) < 50) return;
    if (dx > 0 && prevId !== null) onNavigate(prevId);
    else if (dx < 0 && nextId !== null) onNavigate(nextId);
  };

  if (!yokai) return null;

  // Amaterasu (id 11) is white/gold — soften the pedestal so it doesn't
  // overpower her palette. All other yokai use the standard opacity.
  const pedestalOpacity = yokai.id === 11 ? 0.2 : 0.35;
  const pedestalGradient = `radial-gradient(circle at 50% 50%, rgba(40, 30, 60, ${pedestalOpacity}) 0%, rgba(40, 30, 60, 0) 70%)`;

  return (
    <div
      data-game-overlay
      className="fixed inset-0 flex items-center justify-center yokai-card-fade-in"
      style={{
        zIndex: 120,
        // Game atmosphere shows through — blurred + gently darkened, never
        // pure black. backdrop-filter is supported in iOS Safari 9+.
        backgroundColor: "rgba(0, 0, 0, 0.55)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="relative mx-4 w-[min(400px,92%)]"
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
                onClose();
              }}
              onTouchEnd={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onClose();
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

            {/* Sprite pedestal — soft radial shadow absorbs PNG edge artifacts */}
            <div
              style={{
                width: 200,
                height: 200,
                borderRadius: "50%",
                background: pedestalGradient,
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
