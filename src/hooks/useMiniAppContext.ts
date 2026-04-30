"use client";

import { useEffect, useState } from "react";
import { useConnect } from "wagmi";
import { sdk } from "@farcaster/miniapp-sdk";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { soneium } from "viem/chains";

/**
 * Public Farcaster identity surface — projection of the SDK's
 * UserContext narrowed to the fields we actually render.
 *
 * SECURITY: this is unauthenticated client-side data. The host
 * iframe can hand us any `fid` it wants — `sdk.context` is a UX
 * convenience, not an identity proof. Never use it to gate scoring,
 * leaderboard writes, NFT mints, or anything else with onchain
 * implications. Real authentication still flows through wallet
 * signatures (wagmi). This shape exists only for personalisation.
 */
export type FarcasterUser = {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
};

/**
 * Narrowed surface of the SDK's LocationContext.type union. The SDK
 * exposes more variants (`cast_share`, `channel`, `open_miniapp`)
 * but we collapse anything not in the MVP-relevant set to
 * `'unknown'` so the consumer can switch on a closed enum.
 */
export type MiniAppLocation =
  | "cast_embed"
  | "notification"
  | "launcher"
  | "unknown";

export type MiniAppContextValue = {
  isMiniApp: boolean;
  isReady: boolean;
  user: FarcasterUser | null;
  location: MiniAppLocation | null;
};

/**
 * Detects whether the app is running inside a Farcaster Mini App host
 * (Warpcast, Startale App, etc.) and, if so, auto-connects through the
 * host wallet via the @farcaster/miniapp-wagmi-connector.
 *
 * The detection is the @farcaster/miniapp-sdk's `sdk.context` promise:
 *   - Resolves with a non-null context object when running inside a
 *     Mini App host. We mark `isMiniApp = true`, fire `connect()` with
 *     the Farcaster connector pre-targeted at Soneium mainnet, then
 *     hand off to the host with `sdk.actions.ready()` so it can hide
 *     its splash screen. The user/location shape from `ctx` is
 *     surfaced for personalisation (badge, greeting); see SECURITY
 *     note on FarcasterUser above for the trust boundary.
 *   - Resolves with `null` (or rejects) when running standalone. We
 *     mark `isMiniApp = false` and let the existing RainbowKit /
 *     useActualChainId flow take over.
 *
 * The hook deliberately does NOT touch chain-detection logic for the
 * standalone path — that's still owned by useActualChainId. In the
 * Mini App path the host manages chain switching, so we don't need
 * the wallet-extension-aware EIP-1193 plumbing at all.
 *
 * Return shape: see MiniAppContextValue. `isMiniApp` is typed as a
 * boolean for caller convenience; while the probe is in flight it
 * reads `false` and `isReady` is the gate for "we know which world
 * we're in". `user`/`location` are `null` until the probe resolves
 * (or forever in the standalone path).
 */
export function useMiniAppContext(): MiniAppContextValue {
  const [isMiniApp, setIsMiniApp] = useState<boolean>(false);
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState<FarcasterUser | null>(null);
  const [location, setLocation] = useState<MiniAppLocation | null>(null);
  const { connect } = useConnect();

  useEffect(() => {
    let cancelled = false;

    sdk.context
      .then((ctx) => {
        if (cancelled) return;
        if (ctx) {
          console.log("[useMiniAppContext] Mini App detected", ctx);
          setIsMiniApp(true);

          // Project the SDK's UserContext onto our narrower
          // FarcasterUser shape. ctx.user.fid is mandatory in the SDK
          // type; the rest are optional. Defensive checks because a
          // misbehaving host could in theory hand us a malformed
          // payload — the type system trusts the SDK, but runtime
          // shouldn't.
          if (ctx.user && typeof ctx.user.fid === "number") {
            setUser({
              fid: ctx.user.fid,
              username: ctx.user.username,
              displayName: ctx.user.displayName,
              pfpUrl: ctx.user.pfpUrl,
            });
          }

          // Narrow the SDK's LocationContext.type union to our enum.
          // Variants outside the MVP-relevant set collapse to 'unknown'
          // so consumers can do an exhaustive switch.
          const rawLoc = ctx.location?.type;
          if (
            rawLoc === "cast_embed" ||
            rawLoc === "notification" ||
            rawLoc === "launcher"
          ) {
            setLocation(rawLoc);
          } else if (rawLoc) {
            setLocation("unknown");
          }

          // Auto-connect through the host wallet, pre-targeting
          // Soneium mainnet so wagmi's chainId state lines up with
          // gameplay expectations from the first render. (Mainnet
          // because the Farcaster preview wallet does not currently
          // support Soneium Minato.)
          connect({
            connector: farcasterMiniApp(),
            chainId: soneium.id,
          });
          // ready() tells the host to hide its own splash. We don't
          // gate on connect() resolving because ready() is purely a
          // host-side signal; flipping isReady here lets the splash
          // render its Welcome state as soon as wagmi reports
          // isConnected.
          sdk.actions.ready().finally(() => {
            if (!cancelled) setIsReady(true);
          });
        } else {
          console.log("[useMiniAppContext] Standalone web");
          setIsMiniApp(false);
          setIsReady(true);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err && typeof err === "object" && "message" in err
            ? (err as { message?: string }).message
            : String(err);
        console.log("[useMiniAppContext] No Mini App context", message);
        setIsMiniApp(false);
        setIsReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [connect]);

  return { isMiniApp, isReady, user, location };
}
