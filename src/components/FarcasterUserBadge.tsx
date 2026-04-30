"use client";

// Top-right Farcaster identity chip — shown ONLY when the app is
// actively running inside a Mini App host AND useMiniAppContext has
// resolved a user object. In every other surface (standalone web,
// SSR, in-flight probe, host without an authenticated user) this
// component renders null so it adds zero markup.
//
// SECURITY POSTURE: the FID / username / pfp on display come from
// `sdk.context`, which is unauthenticated. The host iframe can put
// any value it wants here. This is a UX surface for personalisation
// only — never read it for scoring, leaderboard writes, or any
// onchain logic. Real identity for those flows lives in the
// connected wallet (wagmi).
//
// Visual language: dark indigo plate (rgba(10,10,25,0.72)) +
// hairline gold border (#c8a04a, alpha-mixed via /50) + warm cream
// monospace for the address-style FID fallback. Matches the WalletChip
// in GameCanvas.tsx and the bottom-bar settings button on the splash.

import { useEffect, useState } from "react";
import { useMiniAppContext } from "@/hooks/useMiniAppContext";

const SIZE = 32;

function fallbackInitial(
  username: string | undefined,
  fid: number
): string {
  if (username && username.length > 0) {
    return username[0]!.toUpperCase();
  }
  // No username — fall back to "#" + last-4 of FID like an address chip.
  return "#";
}

function fidShort(fid: number): string {
  const s = String(fid);
  return s.length <= 4 ? s : s.slice(-4);
}

// SSR gate. Web3Provider returns plain `<>{children}</>` (without
// WagmiProvider) during SSR / first paint, so any component that
// synchronously calls a wagmi hook breaks the prerender. We keep the
// hook out of the module's render path until the client has hydrated
// by splitting into a mount-gated outer component (only useState +
// useEffect — both safe on the server) and an inner Inner component
// that consumes the hook unconditionally and is only ever rendered
// after Web3Provider has flipped to its WagmiProvider tree.
export default function FarcasterUserBadge() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;
  return <FarcasterUserBadgeInner />;
}

function FarcasterUserBadgeInner() {
  const { isMiniApp, user } = useMiniAppContext();
  // imgFailed flips when the <img> for the pfp errors out, so we
  // gracefully fall through to the gradient fallback without a flash
  // of broken-image icon.
  const [imgFailed, setImgFailed] = useState(false);

  // Hard gate: standalone web, SSR, or host-without-user → render
  // nothing. The hook guarantees `user` is null in all of those cases,
  // so a single conjunction is enough.
  if (!isMiniApp || !user) return null;

  const handle =
    user.username && user.username.length > 0
      ? `@${user.username}`
      : `#${fidShort(user.fid)}`;
  const showImg = !!user.pfpUrl && !imgFailed;

  return (
    <div
      className="fixed kami-serif"
      style={{
        // env(safe-area-inset-*) keeps the chip clear of iOS notch /
        // host header bars. The 16px floor handles browsers that
        // don't expose safe-area insets at all.
        top: "max(16px, env(safe-area-inset-top))",
        right: "max(16px, env(safe-area-inset-right))",
        zIndex: 150,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 10px 4px 4px",
        borderRadius: 9999,
        background: "rgba(10, 10, 25, 0.72)",
        border: "1px solid rgba(180, 150, 90, 0.55)",
        boxShadow:
          "0 0 8px rgba(200, 168, 78, 0.18), 0 1px 2px rgba(0,0,0,0.35)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        // Pointer-events: keep the chip non-interactive for now —
        // future chunks may add a click target (profile menu, etc.).
        pointerEvents: "none",
        // Prevent iOS rubber-band scroll from grabbing the chip on
        // long-press while we're non-interactive.
        userSelect: "none",
      }}
      aria-label={`Signed in as ${handle}`}
    >
      {/* Avatar — pfp if it loads, gradient initial fallback otherwise. */}
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.pfpUrl}
          alt=""
          width={SIZE}
          height={SIZE}
          onError={() => setImgFailed(true)}
          style={{
            width: SIZE,
            height: SIZE,
            borderRadius: "50%",
            objectFit: "cover",
            display: "block",
            // 1px gold ring on the avatar so it reads as a single
            // chip even if the pfp's edges happen to clip dark.
            boxShadow: "0 0 0 1px rgba(200, 168, 78, 0.4)",
          }}
        />
      ) : (
        <div
          style={{
            width: SIZE,
            height: SIZE,
            borderRadius: "50%",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            // Indigo → gold gradient — matches the project's "kami"
            // palette without inventing new colours.
            background:
              "linear-gradient(135deg, #1a1a2e 0%, #3a3a6e 55%, #c8a04a 100%)",
            color: "#f5e6c8",
            fontWeight: 600,
            fontSize: 14,
            lineHeight: 1,
            boxShadow: "0 0 0 1px rgba(200, 168, 78, 0.4)",
          }}
        >
          {fallbackInitial(user.username, user.fid)}
        </div>
      )}

      <span
        style={{
          color: "#f5e6c8",
          fontSize: 13,
          letterSpacing: "0.04em",
          // Long display names / usernames truncate gracefully so the
          // chip never balloons past the corner.
          maxWidth: 140,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {handle}
      </span>
    </div>
  );
}
