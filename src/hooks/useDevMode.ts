"use client";

import { useEffect, useState } from "react";

/**
 * Returns true if dev mode is active — i.e. the URL contains `?dev=1`.
 *
 * Earlier versions double-guarded with `process.env.NODE_ENV`, but that
 * threw `ReferenceError: process is not defined` at browser runtime
 * because Turbopack did not inline the expression inside the useEffect
 * callback / helper-function body (inlining is unreliable across
 * function boundaries + external module imports).
 *
 * URL-only check is sufficient for this personal project: if DevPanel
 * somehow reaches a prod deploy, it is still fully gated by the URL
 * param — you just don't type `?dev=1`.
 */
export function useDevMode(): boolean {
  const [isDev, setIsDev] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setIsDev(params.get("dev") === "1");
  }, []);

  return isDev;
}

/**
 * Non-React helper for use in engine.ts and other non-component modules.
 * Safe to call from any context — checks for `window` existence first.
 */
export function isDevModeActive(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("dev") === "1";
  } catch {
    return false;
  }
}
