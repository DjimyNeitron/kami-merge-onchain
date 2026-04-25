"use client";

import { useEffect, useState } from "react";
import { useConnect } from "wagmi";
import { sdk } from "@farcaster/miniapp-sdk";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { soneiumMinato } from "viem/chains";

/**
 * Detects whether the app is running inside a Farcaster Mini App host
 * (Warpcast, Startale App, etc.) and, if so, auto-connects through the
 * host wallet via the @farcaster/miniapp-wagmi-connector.
 *
 * The detection is the @farcaster/miniapp-sdk's `sdk.context` promise:
 *   - Resolves with a non-null context object when running inside a
 *     Mini App host. We mark `isMiniApp = true`, fire `connect()` with
 *     the Farcaster connector pre-targeted at Soneium Minato, then
 *     hand off to the host with `sdk.actions.ready()` so it can hide
 *     its splash screen.
 *   - Resolves with `null` (or rejects) when running standalone. We
 *     mark `isMiniApp = false` and let the existing RainbowKit /
 *     useActualChainId flow take over.
 *
 * The hook deliberately does NOT touch chain-detection logic for the
 * standalone path — that's still owned by useActualChainId. In the
 * Mini App path the host manages chain switching, so we don't need
 * the wallet-extension-aware EIP-1193 plumbing at all.
 *
 * Return shape:
 *   - `isMiniApp`:
 *       `undefined` while the SDK probe is in flight (callers should
 *       treat this as "still loading" and not show wallet UX yet);
 *       `true`  inside a Mini App host (auto-connect kicked off);
 *       `false` for standalone web (use the legacy splash flow).
 *   - `isReady`:
 *       `true` once we've either signalled the host (Mini App path)
 *       or decided we're standalone. Use this to gate any UI that
 *       must wait for the probe to resolve.
 */
export function useMiniAppContext() {
  const [isMiniApp, setIsMiniApp] = useState<boolean | undefined>(undefined);
  const [isReady, setIsReady] = useState(false);
  const { connect } = useConnect();

  useEffect(() => {
    let cancelled = false;

    sdk.context
      .then((ctx) => {
        if (cancelled) return;
        if (ctx) {
          console.log("[useMiniAppContext] Mini App detected", ctx);
          setIsMiniApp(true);
          // Auto-connect through the host wallet, pre-targeting
          // Soneium Minato so wagmi's chainId state lines up with
          // gameplay expectations from the first render.
          connect({
            connector: farcasterMiniApp(),
            chainId: soneiumMinato.id,
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

  return { isMiniApp, isReady };
}
