"use client";

import dynamic from "next/dynamic";

const GameCanvas = dynamic(
  () =>
    import("@/components/GameCanvas").catch((err) => {
      console.error("[GameCanvasLoader] Failed to load GameCanvas:", err);
      const ErrorFallback = () => (
        <div className="text-red-400 text-sm p-4 max-w-md whitespace-pre-wrap break-words">
          <div className="font-bold mb-2">Failed to load game</div>
          <div>{String(err?.message ?? err)}</div>
          <div className="mt-2 text-xs text-red-300/70">
            {err?.stack ? String(err.stack).slice(0, 500) : null}
          </div>
        </div>
      );
      ErrorFallback.displayName = "GameCanvasLoadError";
      return { default: ErrorFallback };
    }),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 min-h-0 w-full flex items-center justify-center text-white/40 text-sm">
        Loading game…
      </div>
    ),
  }
);

export default function GameCanvasLoader() {
  return (
    <div className="flex-1 min-h-0 w-full flex flex-col">
      <GameCanvas />
    </div>
  );
}
