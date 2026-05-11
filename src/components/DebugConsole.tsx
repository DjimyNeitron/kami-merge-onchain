"use client";

// On-device JS console for iPhone / Android webview debugging without
// USB + Mac Safari Web Inspector. Loaded from jsDelivr CDN only when
// `?debug=1` appears in the URL — production users never pay a
// bandwidth or runtime cost.
//
// Why CDN over npm: keeps bundle size unchanged, no devDep churn, and
// the upgrade path is one URL bump. Eruda is ~150KB gzipped — small
// enough to fetch on demand from cdn.jsdelivr.net which caches well
// and is reachable from inside MetaMask Browser / Rainbow Browser /
// Warpcast webviews (the three contexts where this matters most).
//
// Safety posture: the script element is only ever appended when the
// URL gate passes. There is no listener, hook, or storage key set in
// the inactive path — the effect bails immediately. The (window).eruda
// global is added by the script itself on init, which we then call to
// mount the floating gear icon. Subsequent re-renders short-circuit
// via the `if ((window).eruda) return` guard so repeat-mounting (e.g.
// dev-mode StrictMode double invoke) does not double-init.

import { useEffect } from "react";

export default function DebugConsole() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // URL gate. Anything other than the literal "1" leaves the script
    // tag uninjected. Other truthy values are intentionally rejected
    // so a stray copy-paste link with `?debug=foo` doesn't accidentally
    // ship an inspector to a real user.
    const params = new URLSearchParams(window.location.search);
    if (params.get("debug") !== "1") return;

    // Repeat-mount guard. StrictMode double-invokes effects in dev,
    // and a player could also navigate back to the splash route — in
    // either case the global is already there, just re-init would be
    // a no-op but the guard keeps the network panel clean.
    if ((window as unknown as { eruda?: unknown }).eruda) return;

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/eruda@3.0.1/eruda.min.js";
    script.onload = () => {
      const eruda = (window as unknown as { eruda?: { init?: () => void } })
        .eruda;
      eruda?.init?.();
      // Helpful breadcrumb in console itself so we know the load
      // succeeded vs the bundle silently failing CORS/CSP.
      console.log("[DebugConsole] eruda initialized");
    };
    script.onerror = () => {
      console.error("[DebugConsole] failed to load eruda from CDN");
    };
    document.body.appendChild(script);
  }, []);

  return null;
}
