"use client";

// SECURITY NOTES:
// - Wallet connection is REQUIRED for production players — there is
//   no guest / offline mode. The splash gates all gameplay behind a
//   connected wallet, and a mid-game disconnect bounces the player
//   back here (see the wasConnectedRef effect in GameCanvas.tsx).
// - There is a dev-only wallet bypass (`?dev=1` + DevPanel "Skip
//   Wallet" toggle). The `useDevSkipWallet` hook hard-gates on the
//   URL flag before reading any storage, so this cannot be activated
//   in a production build. When active, the splash renders a loud
//   orange "🛠 Dev mode (no wallet)" banner instead of a welcome
//   line, so it can't be mistaken for a real connected state.
// - All user-facing strings here are hard-coded English. RainbowKit's
//   modal text is also pinned to 'en-US' in Web3Provider so the
//   connect UX never flips to browser-detected Russian/Chinese/etc.
// - The wallet address is rendered only after useAccount() reports
//   both `isConnected` and a non-null `address`.
// - No private key, mnemonic, or signing material ever touches this
//   component. All wallet interaction is delegated to RainbowKit's
//   ConnectButton, which is the audited entrypoint.
// - See SECURITY_AUDIT_KAMI_MERGE.md for the full threat model.

import { useAccount, useDisconnect } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { YOKAI_CHAIN } from "@/config/yokai";
import MonIcon from "@/components/icons/MonIcon";
import { useDevSkipWallet } from "@/hooks/useDevSkipWallet";

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
  // Dev-only bypass: when `?dev=1` is in the URL AND the DevPanel's
  // "Skip Wallet" toggle is on, `devSkipWallet` is true and we treat
  // the player as effectively connected without a real wallet. The
  // hook internally gates on the URL flag, so this is a no-op (and
  // always false) in production builds.
  const devSkipWallet = useDevSkipWallet();

  const walletConnected = isConnected && !!address;
  const effectivelyConnected = walletConnected || devSkipWallet;

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

        {/* Two states + one dev-only variant:
         *   !effectivelyConnected     → Connect Wallet CTA
         *   walletConnected           → "Welcome, 0x1234…abcd" + Tap to Start + Disconnect
         *   devSkipWallet (no wallet) → "🛠 Dev mode (no wallet)" + Tap to Start (no Disconnect)
         */}
        <div className="mt-8 flex flex-col items-center gap-3 min-h-[140px]">
          {!effectivelyConnected && (
            <div className="scale-95">
              <ConnectButton
                label="Connect Wallet"
                accountStatus="full"
                chainStatus="icon"
                showBalance={false}
              />
            </div>
          )}

          {effectivelyConnected && (
            <>
              {walletConnected ? (
                <p className="kami-serif text-[#f5e6c8]/90 text-base sm:text-lg">
                  Welcome,{" "}
                  <span
                    className="text-[#c8a84e] font-semibold"
                    style={{ fontFamily: "ui-monospace, Menlo, monospace" }}
                  >
                    {formatAddress(address!)}
                  </span>
                </p>
              ) : (
                // Orange signals "you're not actually connected" — cannot
                // be confused with a real wallet welcome line.
                <p
                  className="kami-serif text-base sm:text-lg font-medium"
                  style={{ color: "#ff9800" }}
                >
                  🛠 Dev mode (no wallet)
                </p>
              )}
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
              {walletConnected && (
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
              )}
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
