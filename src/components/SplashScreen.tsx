"use client";

// SECURITY NOTES:
// - Guest mode is fully offline: score stays in localStorage only,
//   never leaves the device. No POST, no analytics, no phone-home.
// - The wallet address is rendered only after `useAccount().isConnected`
//   is true. Before that, `address` is `undefined` and we show the
//   pre-connect state.
// - No private key, mnemonic, or signing material ever touches this
//   component. All wallet interaction goes through RainbowKit's
//   ConnectButton / account modal, which are the audited entrypoints.
// - Guest → connect switch simply resets local state; it doesn't
//   leak any prior guest activity to the wallet flow.
// - If the user disconnects mid-game, game play continues (engine
//   doesn't know about wallets). At game-over time, Phase 3B will
//   gate leaderboard submit on `isConnected` + a signed message, so
//   a mid-game disconnect degrades gracefully to "score not saved".

import { useState } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { YOKAI_CHAIN } from "@/config/yokai";
import MonIcon from "@/components/icons/MonIcon";

type Props = {
  onStart: () => void;
  onOpenSettings: () => void;
};

function formatAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function SplashScreen({ onStart, onOpenSettings }: Props) {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const [guestMode, setGuestMode] = useState(false);

  // State selection — explicit so render below stays flat and easy to scan.
  // State 1: user hasn't connected and hasn't opted into guest play.
  // State 2: wallet connected (address available).
  // State 3: user tapped "play as guest" (and not subsequently connected).
  //
  // Connected always wins over guestMode — if a wallet flips live while
  // guestMode is set, we surface the welcome screen so the player sees
  // their leaderboard path is back.
  const inConnected = isConnected && !!address;
  const inGuest = guestMode && !inConnected;
  const inPreConnect = !inConnected && !inGuest;

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
    >
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="kami-title kami-serif text-5xl sm:text-6xl font-bold leading-none">
          Kami Merge
        </h1>
        <p className="kami-serif text-[#c8a84e]/85 tracking-[0.3em] text-base sm:text-lg">
          神マージ
        </p>

        <div
          className="flex items-center justify-center flex-wrap gap-1 mt-8 px-2"
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

        {/* State-dependent CTA block */}
        <div className="mt-8 flex flex-col items-center gap-3 min-h-[140px]">
          {inPreConnect && (
            <>
              <div className="scale-95">
                <ConnectButton
                  label="Connect Wallet"
                  accountStatus="full"
                  chainStatus="icon"
                  showBalance={false}
                />
              </div>
              <button
                type="button"
                onClick={() => setGuestMode(true)}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  setGuestMode(true);
                }}
                className="mt-1 flex flex-col items-center gap-0.5 px-3 py-2 rounded text-white/55 hover:text-white/85 transition-colors"
                style={{ touchAction: "manipulation" }}
                aria-label="Play without wallet"
              >
                <span className="kami-serif text-sm tracking-wider">
                  or play as guest →
                </span>
                <span className="text-[0.65rem] tracking-widest opacity-70">
                  score won&rsquo;t be saved
                </span>
              </button>
            </>
          )}

          {inConnected && (
            <>
              <p className="kami-serif text-[#f5e6c8]/90 text-base sm:text-lg">
                Welcome,{" "}
                <span
                  className="text-[#c8a84e] font-semibold"
                  style={{ fontFamily: "ui-monospace, Menlo, monospace" }}
                >
                  {formatAddress(address!)}
                </span>
              </p>
              <button
                type="button"
                onClick={onStart}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  onStart();
                }}
                className="splash-pulse kami-serif text-[#f5e6c8] text-lg sm:text-xl font-semibold tracking-wider px-8 py-3 rounded-md border border-[#c8a04a]/70 hover:bg-[#c8a04a]/10 transition-colors"
                style={{
                  touchAction: "manipulation",
                  boxShadow: "0 0 14px rgba(200,160,74,0.18)",
                }}
              >
                ~ Tap to Start ~
              </button>
              <button
                type="button"
                onClick={() => disconnect()}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  disconnect();
                }}
                className="text-white/45 hover:text-white/75 text-xs tracking-wider px-2 py-1"
                style={{ touchAction: "manipulation" }}
              >
                Disconnect
              </button>
            </>
          )}

          {inGuest && (
            <>
              <p className="kami-serif text-white/75 text-sm sm:text-base leading-relaxed max-w-[18rem]">
                Playing as guest.
                <br />
                Your score won&rsquo;t be saved to the leaderboard.
              </p>
              <button
                type="button"
                onClick={onStart}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  onStart();
                }}
                className="splash-pulse kami-serif text-[#f5e6c8] text-lg sm:text-xl font-semibold tracking-wider px-8 py-3 rounded-md border border-[#c8a04a]/70 hover:bg-[#c8a04a]/10 transition-colors"
                style={{
                  touchAction: "manipulation",
                  boxShadow: "0 0 14px rgba(200,160,74,0.18)",
                }}
              >
                ~ Tap to Start ~
              </button>
              <button
                type="button"
                onClick={() => setGuestMode(false)}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  setGuestMode(false);
                }}
                className="text-white/45 hover:text-white/75 text-xs tracking-wider px-2 py-1"
                style={{ touchAction: "manipulation" }}
              >
                ← Connect wallet instead
              </button>
            </>
          )}
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
