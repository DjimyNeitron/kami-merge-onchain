"use client";

import { useEffect, useState } from "react";

/**
 * Returns true if the dev-testing UI should be active.
 *
 * Requirements (BOTH must be met):
 *   1. process.env.NODE_ENV === "development"  — prod build never activates
 *   2. URL contains ?dev=1
 *
 * Double-guard: even if someone hits ?dev=1 on a production deploy, the
 * NODE_ENV check still returns false. Paired with the conditional
 * `require` at the DevPanel import site, the entire dev UI subtree is
 * physically absent from prod bundles.
 */
export function useDevMode(): boolean {
  const [isDev, setIsDev] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setIsDev(params.get("dev") === "1");
  }, []);

  return isDev;
}

/**
 * Non-React utility for modules (like the engine) that also need to know
 * if we're in dev-test mode. Same double-guard semantics.
 */
export function isDevModeActive(): boolean {
  if (process.env.NODE_ENV !== "development") return false;
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("dev") === "1";
}
