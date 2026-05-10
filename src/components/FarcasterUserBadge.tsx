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
// Visual language: dark indigo plate (--indigo-rgb at 0.72 alpha) +
// hairline gold border (--gold-200, alpha-mixed via /50) + warm cream
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
      className="fixed kami-serif rounded-full"
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
        background: "rgba(var(--indigo-rgb) / 0.72)",
        // rgb(180, 150, 90) is a slightly-tan version of --gold-200; no
        // exact rgb triple in the token map, kept literal. See
        // STYLE_MIGRATION_REPORT under "Unmapped hardcodes".
        border: "1px solid rgba(180, 150, 90, 0.55)",
        boxShadow:
          "0 0 8px rgba(var(--gold-rgb) / 0.18), 0 1px 2px rgba(var(--black-rgb) / 0.35)",
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
          className="rounded-full"
          style={{
            width: SIZE,
            height: SIZE,
            objectFit: "cover",
            display: "block",
            // 1px gold ring on the avatar so it reads as a single
            // chip even if the pfp's edges happen to clip dark.
            boxShadow: "0 0 0 1px rgba(var(--gold-rgb) / 0.4)",
          }}
        />
      ) : (
        <div
          className="rounded-full text-sm font-semibold leading-none"
          style={{
            width: SIZE,
            height: SIZE,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            // Indigo → gold gradient — matches the project's "kami"
            // palette without inventing new colours.
            // #3a3a6e mid-stop is unmapped (purpler indigo, no token).
            background:
              "linear-gradient(135deg, var(--bg-elev) 0%, #3a3a6e 55%, var(--gold-200) 100%)",
            color: "var(--gold-50)",
            boxShadow: "0 0 0 1px rgba(var(--gold-rgb) / 0.4)",
          }}
        >
          {fallbackInitial(user.username, user.fid)}
        </div>
      )}

      {/* Hidden below sm: (640px) so the chip collapses to avatar-only
       *   on iPhone-class viewports (375-414px), where the centered
       *   header title 'Kami Merge' would otherwise bleed into the
       *   right-anchored chip. From sm: up the full chip with username
       *   text returns. */}
      <span
        className="hidden sm:inline text-[13px]"
        style={{
          color: "var(--gold-50)",
          letterSpacing: "var(--tracking-wide)",
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
