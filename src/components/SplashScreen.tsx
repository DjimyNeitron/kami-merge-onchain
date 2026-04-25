"use client";

// SECURITY NOTES:
// - Wallet connection is REQUIRED for production players — there is
//   no guest / offline mode. The splash gates all gameplay behind a
//   connected wallet on the correct chain (Soneium Minato / 1946);
//   a wrong-chain wallet is blocked with a Switch Network prompt and
//   cannot reach the Tap-to-Start button. Mid-game disconnect OR
//   chain-switch-away-from-Soneium both bounce the player back here
//   (see the wasValidRef effect in GameCanvas.tsx).
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

import { useEffect } from "react";
import { useAccount, useDisconnect, useSwitchChain } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { soneiumMinato } from "viem/chains";
import { YOKAI_CHAIN } from "@/config/yokai";
import MonIcon from "@/components/icons/MonIcon";
import { useDevSkipWallet } from "@/hooks/useDevSkipWallet";
import { useActualChainId } from "@/hooks/useActualChainId";

// Only chain accepted in Phase 3A/3B. Mainnet (soneium 1868) is registered
// in wagmi so wallets that land there can prompt to switch back, but the
// splash rejects it — players must be on testnet for leaderboard testing.
// Phase 3C will add Base via the Farcaster Mini App SDK.
const REQUIRED_CHAIN_ID = soneiumMinato.id; // 1946

type Props = {
  onStart: () => void;
  onOpenSettings: () => void;
};

function formatAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function SplashScreen({ onStart, onOpenSettings }: Props) {
  // CRITICAL: chainId comes from useActualChainId() (EIP-1193 direct
  // read), NOT from wagmi's useChainId() / useAccount().chainId. Both
  // wagmi accessors silently return the configured default chain
  // (Soneium Minato, 1946) when the wallet is on a chain not in
  // `config.chains` — e.g. MetaMask on Ethereum Mainnet still reads
  // as 1946 in wagmi state, defeating any wrong-chain check. The
  // hook bypasses wagmi state and asks the connector's provider
  // directly. Returns `undefined` until the first round-trip
  // resolves, which we surface as a "Verifying network…" interstitial
  // so the player never sees a flash of "Welcome" before the check.
  const { address, isConnected } = useAccount();
  const actualChainId = useActualChainId();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  // Dev-only bypass: when `?dev=1` is in the URL AND the DevPanel's
  // "Skip Wallet" toggle is on, `devSkipWallet` is true and we treat
  // the player as effectively connected without a real wallet. The
  // hook internally gates on the URL flag, so this is a no-op (and
  // always false) in production builds.
  const devSkipWallet = useDevSkipWallet();

  const walletConnected = isConnected && !!address;
  const chainKnown = actualChainId !== undefined;
  const onRequiredChain = actualChainId === REQUIRED_CHAIN_ID;
  // Loading state: connected but the EIP-1193 round-trip hasn't landed
  // yet. Without this gate the wrong-chain branch would briefly render
  // (because `actualChainId !== REQUIRED` evaluates true while
  // chainKnown is still false). Gating Welcome on chainKnown also
  // closes a race where the connect handshake completes before
  // chainChanged fires.
  const chainLoading = walletConnected && !chainKnown && !devSkipWallet;
  // A real wallet only counts as "ready" when it's connected, the
  // chainId has actually been read, and that chain is Soneium Minato.
  const walletReady = walletConnected && chainKnown && onRequiredChain;
  const effectivelyConnected = walletReady || devSkipWallet;
  const wrongChain =
    walletConnected && chainKnown && !onRequiredChain && !devSkipWallet;

  // TEMP diagnostic — logs only on input change. Kept in for now while
  // the chain-lock flow stabilises; remove on a future pass.
  useEffect(() => {
    console.log("[SplashScreen] chain debug", {
      isConnected,
      actualChainId,
      REQUIRED_CHAIN_ID,
      chainLoading,
      onRequiredChain,
      walletReady,
      wrongChain,
      devSkipWallet,
      address,
    });
  }, [
    isConnected,
    actualChainId,
    chainLoading,
    onRequiredChain,
    walletReady,
    wrongChain,
    devSkipWallet,
    address,
  ]);

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

        {/* Four states + one dev-only variant:
         *   !walletConnected && !devSkipWallet → Connect Wallet CTA
         *   chainLoading                       → "Verifying network…" interstitial
         *   wrongChain                         → Wrong Network warning + Switch button
         *   walletReady                        → "Welcome, 0x1234…abcd" + Tap + Disconnect
         *   devSkipWallet (no wallet)          → "🛠 Dev mode (no wallet)" + Tap
         */}
        <div className="mt-8 flex flex-col items-center gap-3 min-h-[140px]">
          {!walletConnected && !devSkipWallet && (
            <div className="scale-95">
              <ConnectButton
                label="Connect Wallet"
                accountStatus="full"
                chainStatus="icon"
                showBalance={false}
              />
            </div>
          )}

          {chainLoading && (
            <p
              className="kami-serif text-white/70 text-sm tracking-wider text-center splash-pulse"
              aria-live="polite"
            >
              Verifying network…
            </p>
          )}

          {wrongChain && (
            <div className="flex flex-col items-center gap-3 max-w-[22rem]">
              <div
                className="text-4xl leading-none"
                style={{ color: "#e87d3e" }}
                aria-hidden="true"
              >
                ⚠
              </div>
              <h2 className="kami-serif text-xl font-semibold tracking-wider text-[#c8a04a]">
                Wrong Network
              </h2>
              <p className="kami-serif text-white/85 text-sm sm:text-base leading-relaxed text-center">
                Kami Merge runs on{" "}
                <strong className="text-[#c8a04a]">Soneium Minato</strong>.
                <br />
                You&rsquo;re currently on chain ID {actualChainId}.
              </p>
              <button
                type="button"
                onClick={() =>
                  switchChain({ chainId: REQUIRED_CHAIN_ID })
                }
                onTouchEnd={(e) => {
                  e.preventDefault();
                  switchChain({ chainId: REQUIRED_CHAIN_ID });
                }}
                disabled={isSwitching}
                className="splash-pulse kami-serif text-[#f5e6c8] text-base sm:text-lg font-semibold tracking-wider px-6 py-2.5 rounded-md border border-[#c8a04a]/70 hover:bg-[#c8a04a]/10 transition-colors disabled:opacity-60 disabled:animation-none disabled:cursor-wait"
                style={{
                  touchAction: "manipulation",
                  boxShadow: "0 0 14px rgba(200,160,74,0.18)",
                }}
              >
                {isSwitching ? "Switching…" : "Switch to Soneium Minato"}
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
                Disconnect and try another wallet
              </button>
            </div>
          )}

          {effectivelyConnected && (
            <>
              {walletReady ? (
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
