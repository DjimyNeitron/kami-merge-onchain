"use client";

import { useEffect, useRef, useState } from "react";
import { GameEngine } from "@/game/engine";
import { YokaiType, YOKAI_CHAIN } from "@/config/yokai";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/config/constants";
import SplashScreen from "@/components/SplashScreen";
import Settings from "@/components/Settings";
import SuzuIcon from "@/components/icons/SuzuIcon";
import MonIcon from "@/components/icons/MonIcon";
// FurinIcon kept in the codebase for future use (BGM / notifications);
// the in-game mute button now uses SuzuIcon to match Settings Sound icon.
import {
  SEASON_CONFIG,
  getCurrentSeason,
  subscribe as subscribeSeason,
} from "@/game/seasons";
import { useDevMode } from "@/hooks/useDevMode";
import DevPanel from "@/components/dev/DevPanel";
import { useAccountModal } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";

// Plain import — previous conditional `require(...)` gated by
// `process.env.NODE_ENV` broke at browser runtime (Turbopack didn't
// reliably inline the check). DevPanel now always bundled (~5KB extra
// in prod) but still fully gated at runtime by `useDevMode()` / the
// `?dev=1` URL param. For a personal project this is a reasonable
// trade — reliability over micro tree-shake.

const SOUND_KEY = "kami_sound_enabled";
const MUSIC_KEY = "kami_music_enabled";

const readBool = (key: string, def: boolean): boolean => {
  if (typeof window === "undefined") return def;
  try {
    const v = window.localStorage.getItem(key);
    if (v === null) return def;
    return v === "true";
  } catch {
    return def;
  }
};

const persistBool = (key: string, value: boolean) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
};

export default function GameCanvas() {
  const cellRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [current, setCurrent] = useState<YokaiType | null>(null);
  const [next, setNext] = useState<YokaiType | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [reached, setReached] = useState<number[]>([]);
  const [unlockedIds, setUnlockedIds] = useState<number[]>(() => {
    if (typeof window === "undefined") return [1];
    try {
      const raw = window.localStorage.getItem("kami_unlocked_yokai");
      if (!raw) return [1];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === "number")) {
        return parsed as number[];
      }
      return [1];
    } catch {
      return [1];
    }
  });
  const [sfxEnabled, setSfxEnabled] = useState(() => readBool(SOUND_KEY, true));
  const [bgmEnabled, setBgmEnabled] = useState(() =>
    readBool(MUSIC_KEY, true)
  );
  const [showSplash, setShowSplash] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [godMode, setGodMode] = useState(false);
  const isDev = useDevMode();
  // Derived: umbrella muted state (both silenced) drives the emoji button
  const muted = !sfxEnabled && !bgmEnabled;
  const allUnlocked = unlockedIds.length >= 11;

  useEffect(() => {
    const cell = cellRef.current;
    const container = containerRef.current;
    if (!cell || !container) return;

    let engine: GameEngine | null = null;
    let cleanup: (() => void) | null = null;

    try {
      console.log("[GameCanvas] mounting engine...", {
        cellW: cell.clientWidth,
        cellH: cell.clientHeight,
      });
      engine = new GameEngine(container, {
        onScoreChange: (s, hs) => {
          setScore(s);
          setHighScore(hs);
        },
        onNextChange: (c, n) => {
          setCurrent(c);
          setNext(n);
        },
        onGameOver: (final) => {
          setFinalScore(final);
          setGameOver(true);
        },
        onReachedChange: (ids) => setReached(ids),
        onUnlockChange: (ids) => setUnlockedIds(ids),
      });
      engineRef.current = engine;

      // Apply persisted audio preferences so state matches the UI toggles
      // before the first SFX/BGM call.
      engine.setSoundEnabled(sfxEnabled);
      engine.setMusicEnabled(bgmEnabled);

      // Apply the current season's particle spawn config, then subscribe to
      // future cycle changes so the spawner always matches the active season.
      const engineForSeason = engine;
      const applySeason = (s: ReturnType<typeof getCurrentSeason>) => {
        const cfg = SEASON_CONFIG[s];
        engineForSeason.setSeasonSpawn(
          cfg.primaryParticle,
          cfg.fireflyMultiplier
        );
      };
      applySeason(getCurrentSeason());
      const unsubscribeSeason = subscribeSeason(applySeason);

      const canvas = engine.getCanvas();
      canvas.style.touchAction = "none";
      canvas.style.display = "block";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.userSelect = "none";
      canvas.style.setProperty("-webkit-touch-callout", "none");
      canvas.style.setProperty("-webkit-user-select", "none");

      const aspect = CANVAS_WIDTH / CANVAS_HEIGHT;
      const fit = () => {
        const w = cell.clientWidth;
        const h = cell.clientHeight;
        if (w <= 0 || h <= 0) return;
        let cw = Math.min(CANVAS_WIDTH, w);
        let ch = cw / aspect;
        if (ch > h) {
          ch = h;
          cw = ch * aspect;
        }
        container.style.width = `${cw}px`;
        container.style.height = `${ch}px`;
      };
      fit();
      const ro = new ResizeObserver(fit);
      ro.observe(cell);
      window.addEventListener("orientationchange", fit);
      window.addEventListener("resize", fit);

      const toGameX = (clientX: number): number => {
        const rect = canvas.getBoundingClientRect();
        const scale = rect.width > 0 ? CANVAS_WIDTH / rect.width : 1;
        return (clientX - rect.left) * scale;
      };

      const eng = engine;
      // Skip game input when the touch/click lands on an overlay element
      // (game-over scroll, restart button). Without this guard the canvas
      // container's preventDefault() would swallow the synthesized click.
      const isOverlayTarget = (t: EventTarget | null) =>
        !!(t as Element | null)?.closest?.("[data-game-overlay]");

      const onMouseMove = (e: MouseEvent) => {
        if (isOverlayTarget(e.target)) return;
        eng.setDropX(toGameX(e.clientX));
      };
      const onMouseDown = (e: MouseEvent) => {
        if (isOverlayTarget(e.target)) return;
        eng.unlockAudio();
        eng.setDropX(toGameX(e.clientX));
        eng.drop();
      };
      const onTouchStart = (e: TouchEvent) => {
        if (isOverlayTarget(e.target)) return;
        eng.unlockAudio();
        e.preventDefault();
        if (e.touches[0]) eng.setDropX(toGameX(e.touches[0].clientX));
      };
      const onTouchMove = (e: TouchEvent) => {
        if (isOverlayTarget(e.target)) return;
        e.preventDefault();
        if (e.touches[0]) eng.setDropX(toGameX(e.touches[0].clientX));
      };
      const onTouchEnd = (e: TouchEvent) => {
        if (isOverlayTarget(e.target)) return;
        e.preventDefault();
        eng.drop();
      };
      const onTouchCancel = (e: TouchEvent) => {
        if (isOverlayTarget(e.target)) return;
        e.preventDefault();
      };

      container.addEventListener("mousemove", onMouseMove);
      container.addEventListener("mousedown", onMouseDown);
      container.addEventListener("touchstart", onTouchStart, {
        passive: false,
      });
      container.addEventListener("touchmove", onTouchMove, { passive: false });
      container.addEventListener("touchend", onTouchEnd, { passive: false });
      container.addEventListener("touchcancel", onTouchCancel, {
        passive: false,
      });

      cleanup = () => {
        unsubscribeSeason();
        ro.disconnect();
        window.removeEventListener("orientationchange", fit);
        window.removeEventListener("resize", fit);
        container.removeEventListener("mousemove", onMouseMove);
        container.removeEventListener("mousedown", onMouseDown);
        container.removeEventListener("touchstart", onTouchStart);
        container.removeEventListener("touchmove", onTouchMove);
        container.removeEventListener("touchend", onTouchEnd);
        container.removeEventListener("touchcancel", onTouchCancel);
        try {
          eng.destroy();
        } catch (err) {
          console.error("[GameCanvas] destroy failed:", err);
        }
        engineRef.current = null;
      };
    } catch (err) {
      console.error("[GameCanvas] Engine creation failed:", err);
      const msg = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      setInitError(`${msg}\n${stack ?? ""}`);
    }

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  const handleRestart = () => {
    console.log("[GameCanvas] restart clicked");
    engineRef.current?.restart();
    setGameOver(false);
    setFinalScore(0);
  };

  // ── Dev handlers (thin pass-throughs to engine). Only invoked from the
  // DevPanel, which itself only mounts when useDevMode() returns true.
  const handleDevSpawn = (id: number) =>
    engineRef.current?.spawnYokaiById(id);
  const handleDevClearField = () => engineRef.current?.clearField();
  const handleDevToggleGodMode = () => {
    const next = !godMode;
    setGodMode(next);
    engineRef.current?.setGodMode(next);
  };
  const handleDevUnlockAll = () => engineRef.current?.unlockAll();

  const handleToggleAll = () => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.unlockAudio();
    // If currently fully muted, enable both; otherwise mute everything.
    const next = muted;
    eng.setSoundEnabled(next);
    eng.setMusicEnabled(next);
    setSfxEnabled(next);
    setBgmEnabled(next);
    persistBool(SOUND_KEY, next);
    persistBool(MUSIC_KEY, next);
  };

  const handleToggleSfx = () => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.unlockAudio();
    const next = !sfxEnabled;
    eng.setSoundEnabled(next);
    setSfxEnabled(next);
    persistBool(SOUND_KEY, next);
  };

  const handleToggleBgm = () => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.unlockAudio();
    const next = !bgmEnabled;
    eng.setMusicEnabled(next);
    setBgmEnabled(next);
    persistBool(MUSIC_KEY, next);
  };

  const openSettings = () => {
    engineRef.current?.pause();
    setShowSettings(true);
  };

  const closeSettings = () => {
    setShowSettings(false);
    if (!showSplash) engineRef.current?.resume();
  };

  const dismissSplash = () => {
    engineRef.current?.unlockAudio();
    setShowSplash(false);
  };

  if (initError) {
    return (
      <div className="max-w-md p-4 bg-red-900/40 border border-red-500/60 rounded-lg text-red-100 text-xs whitespace-pre-wrap break-words m-2 relative z-10">
        <div className="font-bold text-sm mb-2">Engine init failed</div>
        {initError}
      </div>
    );
  }

  const reachedSet = new Set(reached);

  return (
    <div className="h-full w-full flex flex-col items-center gap-1.5 px-2 min-h-0 relative z-10">
      {/* Mid-game wallet indicator — shown only when connected. The
       * pre-connect CTA now lives in the splash screen, so the HUD
       * doesn't need a full ConnectButton any more. This chip acts as
       * a reference / affordance to open the RainbowKit account modal
       * (switch chain, copy address, disconnect). Hidden when not
       * connected to keep the HUD clean for guest players. */}
      <WalletChip maxWidth={CANVAS_WIDTH} />
      {/* Score plate */}
      <div
        className="score-plate shrink-0 flex items-center justify-between w-full rounded-lg px-3 py-1.5"
        style={{ maxWidth: CANVAS_WIDTH }}
      >
        <div className="flex flex-col items-start leading-tight">
          <span className="kami-serif text-[0.6rem] uppercase tracking-[0.15em] text-[#c8a84e]">
            Score
          </span>
          <span className="kami-serif text-xl sm:text-2xl font-bold text-[#f5e6c8]">
            {score}
          </span>
        </div>
        <div className="h-8 w-px bg-[#c8a84e]/25" />
        <div className="flex flex-col items-center leading-tight">
          <span className="kami-serif text-[0.6rem] uppercase tracking-[0.15em] text-[#c8a84e]">
            High
          </span>
          <span className="kami-serif text-lg sm:text-xl font-semibold text-[#f5e6c8]/90">
            {highScore}
          </span>
        </div>
        <div className="h-8 w-px bg-[#c8a84e]/25" />
        <div className="flex items-center gap-2">
          <span className="kami-serif text-[0.6rem] uppercase tracking-[0.15em] text-[#c8a84e]">
            Next
          </span>
          {next ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={next.sprite}
              alt={next.name}
              title={next.name}
              className="rounded-full"
              style={{
                width: 40,
                height: 40,
                objectFit: "contain",
                padding: 2,
                border: "1px solid rgba(200, 168, 78, 0.5)",
                background: "rgba(10, 10, 25, 0.4)",
                filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))",
              }}
            />
          ) : (
            <div style={{ width: 40, height: 40 }} />
          )}
        </div>
        <button
          onClick={handleToggleAll}
          type="button"
          title={muted ? "Unmute" : "Mute"}
          aria-label={muted ? "Unmute" : "Mute"}
          className="icon-btn flex items-center justify-center rounded-full"
          style={{
            width: 28,
            height: 28,
            color: "#c8a84e",
            background: "rgba(10, 10, 25, 0.3)",
            border: "1px solid rgba(200, 168, 78, 0.25)",
            opacity: muted ? 0.55 : 0.9,
            touchAction: "manipulation",
          }}
        >
          <SuzuIcon muted={muted} size={18} />
        </button>
        <button
          onClick={openSettings}
          type="button"
          title="Settings"
          aria-label="Settings"
          className="icon-btn flex items-center justify-center rounded-full"
          style={{
            width: 28,
            height: 28,
            color: "#c8a84e",
            background: "rgba(10, 10, 25, 0.3)",
            border: "1px solid rgba(200, 168, 78, 0.25)",
            opacity: 0.9,
            touchAction: "manipulation",
          }}
        >
          <MonIcon size={18} />
        </button>
      </div>

      {/* Canvas cell — takes remaining space */}
      <div
        ref={cellRef}
        className="flex-1 min-h-0 w-full flex items-center justify-center"
      >
        <div
          ref={containerRef}
          className="relative overflow-hidden"
          style={{
            touchAction: "none",
            width: 0,
            height: 0,
            borderRadius: 6,
            boxShadow:
              "0 10px 30px rgba(0,0,0,0.55), 0 0 0 1px rgba(200,168,78,0.15)",
          }}
        >
          {gameOver && (
            <div
              data-game-overlay
              className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm"
              style={{ zIndex: 20, pointerEvents: "auto" }}
            >
              <div className="relative mx-4 w-[min(300px,90%)]">
                {/* Top wooden rod */}
                <div className="wooden-rod absolute -top-1 left-3 right-3 h-3 rounded-full pointer-events-none" />
                {/* Paper body */}
                <div className="scroll-panel px-6 py-8 text-center text-[#3d2510] border-x border-[#8a6f28]/40">
                  <div className="kami-serif text-2xl font-bold tracking-[0.1em] mb-1">
                    GAME OVER
                  </div>
                  <div className="text-[0.65rem] tracking-[0.3em] text-[#5c3a1e]/60">
                    終
                  </div>
                  <div className="h-px bg-gradient-to-r from-transparent via-[#8a6f28]/50 to-transparent my-4" />
                  <div className="kami-serif text-[0.6rem] uppercase tracking-[0.25em] text-[#5c3a1e]/70">
                    Final Score
                  </div>
                  <div className="kami-serif text-4xl font-bold text-[#3d2510] mt-1">
                    {finalScore}
                  </div>
                  <div className="kami-serif text-[0.65rem] tracking-wider text-[#5c3a1e]/60 mt-2">
                    Best: {highScore}
                  </div>
                  <div className="h-px bg-gradient-to-r from-transparent via-[#8a6f28]/50 to-transparent my-4" />
                  <button
                    data-game-overlay
                    onClick={handleRestart}
                    onTouchEnd={(e) => {
                      // Belt-and-suspenders for iOS: fire restart directly on
                      // touchend rather than waiting for synthesized click.
                      e.stopPropagation();
                      e.preventDefault();
                      handleRestart();
                    }}
                    type="button"
                    className="wood-btn kami-serif px-6 py-2 rounded-md text-sm font-semibold tracking-wider cursor-pointer"
                    style={{
                      touchAction: "manipulation",
                      pointerEvents: "auto",
                      zIndex: 21,
                      position: "relative",
                    }}
                  >
                    Restart
                  </button>
                </div>
                {/* Bottom wooden rod */}
                <div className="wooden-rod absolute -bottom-1 left-3 right-3 h-3 rounded-full pointer-events-none" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Merge chain preview — all 11 yokai, lit when reached */}
      <div
        className="shrink-0 flex items-center justify-between w-full px-2 py-1 rounded-md score-plate"
        style={{ maxWidth: CANVAS_WIDTH, gap: 2 }}
      >
        {YOKAI_CHAIN.map((y) => {
          const isReached = reachedSet.has(y.id);
          return (
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
                opacity: isReached ? 1 : 0.25,
                filter: isReached
                  ? "drop-shadow(0 0 4px rgba(200,168,78,0.5))"
                  : "grayscale(1) brightness(0.6)",
                transition: "opacity 0.3s ease, filter 0.3s ease",
              }}
            />
          );
        })}
      </div>

      {/* Restart + current-yokai label */}
      <div className="shrink-0 flex flex-col items-center gap-1 pb-1">
        <button
          onClick={handleRestart}
          type="button"
          className="wood-btn kami-serif px-4 py-1 rounded-md text-xs font-semibold tracking-wider"
          style={{ touchAction: "manipulation" }}
        >
          Restart
        </button>
        {current && (
          <div className="kami-serif text-[0.65rem] text-[#c8a84e]/60 tracking-wider">
            Dropping:{" "}
            <span className="text-[#f5e6c8]/80">{current.name}</span>
          </div>
        )}
      </div>

      {showSettings && (
        <Settings
          sfxEnabled={sfxEnabled}
          bgmEnabled={bgmEnabled}
          unlockedIds={unlockedIds}
          onToggleSfx={handleToggleSfx}
          onToggleBgm={handleToggleBgm}
          onClose={closeSettings}
        />
      )}

      {showSplash && (
        <SplashScreen
          onStart={dismissSplash}
          onOpenSettings={openSettings}
        />
      )}

      {/* Dev-test overlay — gated at runtime by `?dev=1` URL param via
       * useDevMode(). Plain import means the module is bundled in prod
       * but never renders without the URL flag. */}
      {isDev && (
        <DevPanel
          onSpawn={handleDevSpawn}
          onClearField={handleDevClearField}
          godMode={godMode}
          onToggleGodMode={handleDevToggleGodMode}
          onUnlockAll={handleDevUnlockAll}
          allUnlocked={allUnlocked}
        />
      )}
    </div>
  );
}

/**
 * Small wallet address chip rendered above the score plate while the
 * player is connected. Click opens RainbowKit's account modal
 * (switch chain, disconnect, copy address). When disconnected (guest
 * or pre-connect) the chip returns null so the HUD lane collapses.
 *
 * `openAccountModal` can momentarily be undefined — before the modal
 * provider hydrates, or if a chain mismatch puts us into "chain modal"
 * territory — in which case the button stays disabled.
 */
function WalletChip({ maxWidth }: { maxWidth: number }) {
  const { address, isConnected } = useAccount();
  const { openAccountModal } = useAccountModal();

  if (!isConnected || !address) return null;

  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
  const ready = !!openAccountModal;

  return (
    <div
      className="shrink-0 w-full flex justify-end items-center"
      style={{ maxWidth, height: 28 }}
    >
      <button
        type="button"
        onClick={openAccountModal}
        disabled={!ready}
        title="Wallet options"
        aria-label="Wallet options"
        className="kami-serif px-3 py-1 rounded-full flex items-center gap-1.5 transition-colors"
        style={{
          fontSize: 12,
          letterSpacing: "0.05em",
          color: "#f5e6c8",
          background: "rgba(10, 10, 25, 0.45)",
          border: "1px solid rgba(200, 168, 78, 0.4)",
          boxShadow: "0 0 6px rgba(200,168,78,0.12)",
          cursor: ready ? "pointer" : "default",
          touchAction: "manipulation",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#6fd28a",
            boxShadow: "0 0 4px rgba(111,210,138,0.8)",
          }}
        />
        <span style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>
          {short}
        </span>
      </button>
    </div>
  );
}
