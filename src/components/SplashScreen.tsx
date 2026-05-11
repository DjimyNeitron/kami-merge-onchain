"use client";

// SECURITY NOTES:
// - Wallet connection is REQUIRED for production players — there is
//   no guest / offline mode. The splash gates all gameplay behind a
//   connected wallet on the correct chain (Soneium mainnet / 1868);
//   a wrong-chain wallet is blocked with a Switch Network prompt and
//   cannot reach the Tap-to-Start button. Mid-game disconnect OR
//   chain-switch-away-from-Soneium both bounce the player back here
//   (see the wasValidRef effect in GameCanvas.tsx).
// - Mini App mode: when running inside a Farcaster / Startale-App /
//   Warpcast host (detected by useMiniAppContext), the host owns
//   wallet + chain. We auto-connect via the Mini App connector and
//   trust the host to present the correct chain — chain-detection
//   branches collapse to no-ops in this path. No tap-through path
//   bypasses host identity; if the host disconnects us, we fall
//   straight back to walletConnected = false and the loader shows.
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

import { useEffect, useRef } from "react";
import { useAccount, useDisconnect, useSwitchChain } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { soneium } from "viem/chains";
import { YOKAI_CHAIN } from "@/config/yokai";
import MonIcon from "@/components/icons/MonIcon";
import { useDevSkipWallet } from "@/hooks/useDevSkipWallet";
import { useActualChainId } from "@/hooks/useActualChainId";
import { useMiniAppContext } from "@/hooks/useMiniAppContext";

// Only chain accepted by the MVP. We previously targeted Soneium Minato
// (testnet, 1946), but the Farcaster preview wallet does not support
// it — every Mini App test session errored with "Unsupported chainId
// 1946". Switching to Soneium mainnet (1868) for Phase 3C onwards;
// gameplay testing uses a small dev-funded mainnet wallet.
const REQUIRED_CHAIN_ID = soneium.id; // 1868

// Friendly names for the most common EVM chains a user might land on
// when they first hit the splash. Anything outside this map falls back
// to the numeric chain ID, which still tells a developer-savvy user
// where they are without us having to enumerate every L2.
const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  10: "Optimism",
  56: "BNB Chain",
  137: "Polygon",
  324: "zkSync Era",
  8453: "Base",
  42161: "Arbitrum",
  43114: "Avalanche",
  59144: "Linea",
  534352: "Scroll",
  1868: "Soneium",
  1946: "Soneium Minato",
};

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
  // (Soneium mainnet, 1868) when the wallet is on a chain not in
  // `config.chains` — e.g. MetaMask on Ethereum Mainnet still reads
  // as 1868 in wagmi state, defeating any wrong-chain check. The
  // hook bypasses wagmi state and asks the connector's provider
  // directly. Returns `undefined` until the first round-trip
  // resolves, which we surface as a "Verifying network…" interstitial
  // so the player never sees a flash of "Welcome" before the check.
  const { address, isConnected, connector } = useAccount();
  const actualChainId = useActualChainId();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  // Mini App probe — undefined while in flight, true inside a Farcaster
  // / Startale-App / Warpcast host, false for standalone web. The hook
  // also fires its own connect() when host is detected.
  const { isMiniApp, isReady: miniAppReady } = useMiniAppContext();

  // Two-video crossfade for a seamless splash loop. The MJ-generated
  // source clip's first/last frames don't visually match, so a single
  // <video loop> would show a noticeable pop at the seam every cycle.
  // Instead we mount two identical <video> elements stacked at
  // inset:0, fade between them with a 2.5s opacity transition just
  // before the active clip ends, and swap roles each cycle. To the
  // eye it reads as one continuous never-ending shot.
  //
  // Pace tuning: both videos also run at playbackRate 0.7 to stretch
  // the 9s source loop to a perceived ~12.9s. Slower playback +
  // softer crossfade together push the splash into slow-cinema
  // territory rather than arcade pace.
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const a = videoARef.current;
    const b = videoBRef.current;
    if (!a || !b) return;

    const FADE_MS = 2500;
    let current = a;
    let next = b;
    let crossfading = false;

    // Slow both videos to 0.7x. Has to be set before play() because
    // some mobile browsers (Safari especially) reset playbackRate on
    // each play() if applied after — setting it on the element first
    // keeps it sticky across the crossfade swaps too.
    a.playbackRate = 0.7;
    b.playbackRate = 0.7;

    // Initial state — A visible, B latent. play() can throw on iOS if
    // the user gesture hasn't unlocked autoplay yet; we swallow the
    // rejection silently because muted+playsInline already covers the
    // mainstream autoplay path.
    a.style.opacity = "1";
    b.style.opacity = "0";
    a.play().catch(() => {});

    const onTimeUpdate = () => {
      if (!current.duration || crossfading) return;
      const remaining = current.duration - current.currentTime;
      if (remaining < FADE_MS / 1000) {
        crossfading = true;
        next.currentTime = 0;
        next.play().catch(() => {});
        next.style.opacity = "1";
        current.style.opacity = "0";
        window.setTimeout(() => {
          const oldCurrent = current;
          current = next;
          next = oldCurrent;
          crossfading = false;
        }, FADE_MS);
      }
    };

    a.addEventListener("timeupdate", onTimeUpdate);
    b.addEventListener("timeupdate", onTimeUpdate);
    return () => {
      a.removeEventListener("timeupdate", onTimeUpdate);
      b.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, []);

  /**
   * Switch to Soneium mainnet. If the wallet doesn't know about the
   * chain yet (MetaMask returns code 4902 / "Unrecognized chain ID"
   * when asked to switch to a chain it has never seen), we follow up
   * with `wallet_addEthereumChain` using the full Soneium parameters.
   * After a successful add, MetaMask switches into the new chain
   * automatically and `chainChanged` fires, so the splash advances
   * to Welcome on the next render.
   */
  const handleSwitchChain = async () => {
    try {
      await switchChainAsync({ chainId: REQUIRED_CHAIN_ID });
    } catch (err: unknown) {
      console.error("[SplashScreen] switch failed:", err);
      const e = err as { code?: number; message?: string } | null;
      const isUnrecognised =
        e?.code === 4902 ||
        (typeof e?.message === "string" &&
          (e.message.includes("Unrecognized chain ID") ||
            e.message.includes("not been added") ||
            e.message.includes("Try adding the chain")));
      if (!isUnrecognised) return;

      try {
        const provider = (await connector?.getProvider()) as
          | { request: (args: { method: string; params: unknown[] }) => Promise<unknown> }
          | undefined;
        if (!provider) throw new Error("No provider available for add-chain");

        await provider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: "0x" + REQUIRED_CHAIN_ID.toString(16), // 0x74c
              chainName: "Soneium",
              nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
              rpcUrls: ["https://rpc.soneium.org"],
              blockExplorerUrls: ["https://soneium.blockscout.com"],
            },
          ],
        });
        // wallet_addEthereumChain auto-switches in MetaMask after the
        // user approves. chainChanged should fire next; useActualChainId
        // picks it up and the splash advances on its own.
      } catch (addErr) {
        console.error("[SplashScreen] add chain failed:", addErr);
      }
    }
  };
  // Dev-only bypass: when `?dev=1` is in the URL AND the DevPanel's
  // "Skip Wallet" toggle is on, `devSkipWallet` is true and we treat
  // the player as effectively connected without a real wallet. The
  // hook internally gates on the URL flag, so this is a no-op (and
  // always false) in production builds.
  const devSkipWallet = useDevSkipWallet();

  const walletConnected = isConnected && !!address;
  const chainKnown = actualChainId !== undefined;
  const onRequiredChain = actualChainId === REQUIRED_CHAIN_ID;
  // Mini App hosts manage chain switching themselves and only ever
  // present the correct chain to the embedded app, so the EIP-1193
  // chain plumbing is irrelevant in that path. Gate every chain-side
  // check on `!isMiniApp` so:
  //   - chainLoading        never fires inside a host (no spinner)
  //   - wrongChain          never fires inside a host (impossible)
  //   - walletReady         passes as soon as wagmi reports isConnected
  //   - effectivelyConnected resolves Welcome-state quickly
  // The standalone path (isMiniApp === false) still goes through the
  // full 4-state flow exactly as before.
  const inMiniApp = isMiniApp === true;
  const chainLoading =
    !inMiniApp && walletConnected && !chainKnown && !devSkipWallet;
  // A real wallet only counts as "ready" when it's connected and on
  // Soneium mainnet — except in a Mini App host, where the host
  // guarantees the correct chain. We accept any wagmi-connected state
  // as ready in that environment.
  const walletReady = inMiniApp
    ? walletConnected
    : walletConnected && chainKnown && onRequiredChain;
  const effectivelyConnected = walletReady || devSkipWallet;
  const wrongChain =
    !inMiniApp &&
    walletConnected &&
    chainKnown &&
    !onRequiredChain &&
    !devSkipWallet;
  // Probing state: the SDK promise hasn't resolved yet. We don't know
  // whether to show "Connect Wallet" (would confuse a Mini App user
  // with no wallet UX) or skip straight to Welcome, so render a quiet
  // loader instead. !miniAppReady alone is sufficient because the
  // hook only flips isReady=true once isMiniApp has settled to its
  // final value (see useMiniAppContext.ts).
  const probing = !miniAppReady;

  // TEMP diagnostic — logs only on input change. Kept in for now while
  // the chain-lock + Mini App flows stabilise; remove on a future pass.
  useEffect(() => {
    console.log("[SplashScreen] state", {
      isMiniApp,
      miniAppReady,
      probing,
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
    isMiniApp,
    miniAppReady,
    probing,
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
      className="fixed inset-0 overflow-hidden bg-[rgb(var(--indigo-rgb))]"
      style={{ zIndex: 100 }}
    >
      {/* Layer 1: atmospheric video bg. Two stacked <video> elements
       *   drive the crossfade pattern in useEffect above — each plays
       *   the same source, never loops natively, and the active one
       *   hands off to the latent one with a 1.5s opacity fade just
       *   before its currentTime hits duration. The previous v1 video
       *   had a baked-in 'KAMI MERGE' title so we used object-position
       *   to crop it; v2 is title-free so the crop hint is dropped.
       *   muted + playsInline are still required for iOS autoplay;
       *   preload="auto" buffers both elements upfront so the swap
       *   doesn't catch the second video mid-load. poster on A only
       *   covers first-paint before the mp4 decode lands. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoARef}
        src="/kami_merge_splash_mobile.mp4"
        poster="/bg_game.jpg"
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: 0, transition: "opacity 2500ms ease-in-out" }}
      />
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoBRef}
        src="/kami_merge_splash_mobile.mp4"
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: 0, transition: "opacity 2500ms ease-in-out" }}
      />
      {/* Layer 2: indigo tint, identical opacity to the previous static
       *   linear-gradient (rgba(--indigo-rgb)/0.7). Keeps welcome-flow
       *   text legible over the moving footage. */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(var(--indigo-rgb) / 0.7)" }}
      />
      {/* Layer 3: welcome flow. Carries the original flex-column layout
       *   plus the safe-area-inset paddings. Lives at z >= layers above
       *   by source order; sub-element bottom bar still uses zIndex:101
       *   to lift above any future overlays inside the welcome layer. */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-between"
        style={{
          paddingTop: "max(24px, env(safe-area-inset-top))",
          paddingBottom: "max(24px, env(safe-area-inset-bottom))",
        }}
      >
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="kami-title kami-serif text-5xl sm:text-6xl font-bold leading-none">
          Kami Merge
        </h1>
        <p className="kami-serif text-(--gold-200)/85 tracking-(--tracking-spaced) text-base sm:text-lg">
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
                filter: "drop-shadow(0 0 4px rgba(var(--gold-rgb) / 0.4))",
              }}
            />
          ))}
        </div>

        {/* Render branches (mutually exclusive):
         *   probing                            → quiet loader (Mini App probe in flight)
         *   inMiniApp && !walletConnected      → "Loading host wallet…" (auto-connect pending)
         *   !inMiniApp && !walletConnected && !devSkipWallet
         *                                      → Connect Wallet CTA (standalone web only)
         *   chainLoading                       → "Verifying network…" interstitial (standalone)
         *   wrongChain                         → Wrong Network warning + Switch button (standalone)
         *   walletReady                        → "Welcome, 0x1234…abcd" + Tap + Disconnect
         *   devSkipWallet (no wallet)          → "🛠 Dev mode (no wallet)" + Tap
         */}
        <div className="mt-8 flex flex-col items-center gap-3 min-h-[140px]">
          {probing && !devSkipWallet && (
            <p
              className="kami-serif text-white/70 text-sm tracking-wider text-center splash-pulse"
              aria-live="polite"
            >
              Loading…
            </p>
          )}

          {!probing &&
            inMiniApp &&
            !walletConnected &&
            !devSkipWallet && (
              <p
                className="kami-serif text-white/70 text-sm tracking-wider text-center splash-pulse"
                aria-live="polite"
              >
                Loading host wallet…
              </p>
            )}

          {!probing &&
            !inMiniApp &&
            !walletConnected &&
            !devSkipWallet && (
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
                style={{ color: "var(--accent-warning)" }}
                aria-hidden="true"
              >
                ⚠
              </div>
              <h2 className="kami-serif text-xl font-semibold tracking-wider text-(--gold-200)">
                Wrong Network
              </h2>
              <p className="kami-serif text-white/85 text-sm sm:text-base leading-relaxed text-center">
                Kami Merge runs on{" "}
                <strong className="text-(--gold-200)">Soneium</strong>.
                <br />
                You&rsquo;re currently on{" "}
                {actualChainId !== undefined &&
                CHAIN_NAMES[actualChainId] !== undefined
                  ? CHAIN_NAMES[actualChainId]
                  : `chain ID ${actualChainId}`}
                .
              </p>
              <button
                type="button"
                onClick={handleSwitchChain}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  handleSwitchChain();
                }}
                disabled={isSwitching}
                className="splash-pulse kami-serif text-(--gold-50) text-base sm:text-lg font-semibold tracking-wider px-6 py-2.5 rounded-md border border-(--gold-200)/70 hover:bg-(--gold-200)/10 transition-colors disabled:opacity-60 disabled:animation-none disabled:cursor-wait"
                style={{
                  touchAction: "manipulation",
                  boxShadow: "0 0 14px rgba(var(--gold-rgb) / 0.18)",
                }}
              >
                {isSwitching ? "Switching…" : "Switch to Soneium"}
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
                <p className="kami-serif text-(--gold-50)/90 text-base sm:text-lg">
                  Welcome,{" "}
                  <span
                    className="text-(--gold-200) font-semibold"
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
                  style={{ color: "var(--accent-warning)" }}
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
                className="splash-pulse kami-serif text-(--gold-50) text-lg sm:text-xl font-semibold tracking-wider px-8 py-3 rounded-md border border-(--gold-200)/70 hover:bg-(--gold-200)/10 transition-colors"
                style={{
                  touchAction: "manipulation",
                  boxShadow: "0 0 14px rgba(var(--gold-rgb) / 0.18)",
                }}
              >
                ~ Tap to Start ~
              </button>
              {walletConnected && !inMiniApp && (
                // Hide Disconnect inside a Farcaster Mini App host. The
                // host wallet binding is owned by the platform — tapping
                // Disconnect triggers a brief "loading host wallet"
                // state that then auto-reconnects on reload, because
                // the SDK re-binds from `sdk.context` every mount. This
                // is expected SDK behavior, but reads as a flicker /
                // half-broken UX. Standalone web users still see and
                // need the button to swap wallets, so keep it there.
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
        <span className="kami-serif text-(--gold-200)/60 text-xs">v0.1</span>
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
            color: "var(--gold-200)",
            background: "rgba(var(--indigo-rgb) / 0.4)",
            border: "1px solid rgba(var(--gold-rgb) / 0.35)",
            touchAction: "manipulation",
          }}
        >
          <MonIcon size={22} />
        </button>
      </div>
      </div>
    </div>
  );
}
