"use client";

import { YOKAI_CHAIN } from "@/config/yokai";
import MonIcon from "@/components/icons/MonIcon";

type Props = {
  onStart: () => void;
  onOpenSettings: () => void;
};

export default function SplashScreen({ onStart, onOpenSettings }: Props) {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-between animate-splash-fade"
      style={{
        zIndex: 100,
        background:
          "linear-gradient(rgba(5,5,15,0.7), rgba(5,5,15,0.7)), url('/bg_game.jpg') center center / cover no-repeat fixed",
        paddingTop: "max(24px, env(safe-area-inset-top))",
        paddingBottom: "max(24px, env(safe-area-inset-bottom))",
      }}
      onClick={onStart}
    >
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="kami-title kami-serif text-5xl sm:text-6xl font-bold leading-none">
          Kami Merge
        </h1>
        <p className="kami-serif text-[#c8a84e]/85 tracking-[0.3em] text-base sm:text-lg">
          神マージ
        </p>

        <div
          className="flex items-center justify-center flex-wrap gap-1 mt-10 px-2"
          style={{ maxWidth: 340 }}
        >
          {YOKAI_CHAIN.map((y) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={y.id}
              src={y.sprite}
              alt={y.name}
              title={y.name}
              style={{
                width: 24,
                height: 24,
                objectFit: "contain",
                filter: "drop-shadow(0 0 4px rgba(200,168,78,0.4))",
              }}
            />
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center gap-1 splash-pulse">
          <span className="kami-serif text-[#f5e6c8] text-lg sm:text-xl font-semibold tracking-wider">
            Tap to Start
          </span>
          <span className="text-[#c8a84e]/70 text-[0.7rem] tracking-[0.35em]">
            タップしてスタート
          </span>
        </div>
      </div>

      <div
        className="w-full flex justify-between items-end px-5"
        style={{ zIndex: 101 }}
      >
        <span className="kami-serif text-[#c8a84e]/60 text-xs">v0.1</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenSettings();
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onOpenSettings();
          }}
          type="button"
          aria-label="Settings"
          title="Settings"
          className="icon-btn flex items-center justify-center rounded-full"
          style={{
            width: 40,
            height: 40,
            color: "#c8a84e",
            background: "rgba(10, 10, 25, 0.4)",
            border: "1px solid rgba(200, 168, 78, 0.35)",
            touchAction: "manipulation",
          }}
        >
          <MonIcon size={22} />
        </button>
      </div>
    </div>
  );
}
