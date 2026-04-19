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

  // Solid plum medallion. Sprite PNGs have heavy alpha translucency in the
  // body (Oni 25% body<255, Tanuki 13%, etc.) so a translucent pedestal
  // lets the cream parchment bleed through and wash out the colour. A solid
  // core gives every translucent sprite pixel an opaque plum backdrop —
  // the same visual context dark sprites have on a black game screen.
  //
  // Tuned to dissolve into parchment (4-stop fade 35→60→80→95) so the
  // medallion doesn't read as a competing disc. Colour lifted from #1a1528
  // to #2a2140 — still protects translucent alpha, stops looking like a
  // hole punched through the card.
  const medallionGradient =
    "radial-gradient(circle at center, #2a2140 0%, #2a2140 35%, rgba(42,33,64,0.55) 60%, rgba(42,33,64,0.2) 80%, rgba(42,33,64,0) 95%)";

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

            {/* Sprite medallion — solid plum core fades into parchment */}
            <div
              style={{
                width: 220,
                height: 220,
                borderRadius: "50%",
                background: medallionGradient,
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
