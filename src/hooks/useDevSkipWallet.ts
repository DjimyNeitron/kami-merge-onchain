"use client";

import { useEffect, useState } from "react";

/**
 * Dev-only wallet bypass for the splash screen.
 *
 * Returns true only when **both**:
 *   1. The URL contains `?dev=1` (the same gate used by `useDevMode`).
 *   2. The user has checked the "Skip wallet" box in the DevPanel,
 *      which writes `"true"` to sessionStorage under
 *      `kamiMerge_devSkipWallet`.
 *
 * Production-safety properties:
 *   - Without `?dev=1`, the hook ALWAYS returns false, regardless of
 *     whatever might be sitting in sessionStorage. A hostile user
 *     manually seeding the storage key on a prod page gains nothing.
 *   - When `?dev=1` is absent, the hook *also* proactively deletes
 *     any stale `kamiMerge_devSkipWallet` entry, so a bypass toggled
 *     on the dev URL can't linger when the player navigates back to
 *     a prod URL in the same tab.
 *   - The initial useState value is false. We only raise it in the
 *     mount effect, which runs client-only. On the server render path
 *     (if any) the hook is always false — no hydration drift.
 *   - `dev=1` is a URL-query gate; it's not secret, but production
 *     builds simply don't care about it. There is no production code
 *     path that trusts sessionStorage without the URL check first.
 *
 * Multi-component coordination uses a `CustomEvent<boolean>` named
 * `devSkipWalletChange` dispatched by the DevPanel whenever the
 * checkbox flips. Consumers subscribe in this hook's effect.
 */
const STORAGE_KEY = "kamiMerge_devSkipWallet";
const EVENT_NAME = "devSkipWalletChange";

function urlHasDevFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      new URLSearchParams(window.location.search).get("dev") === "1"
    );
  } catch {
    return false;
  }
}

export function useDevSkipWallet(): boolean {
  const [skip, setSkip] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Layer 1: hard gate on the URL. No dev flag → always false,
    // and scrub any stale sessionStorage entry as a belt-and-braces
    // measure against same-tab navigation prod ← dev.
    if (!urlHasDevFlag()) {
      setSkip(false);
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        /* quota / privacy — ignore */
      }
      return;
    }

    // Layer 2: loud console banner so it's obvious bypass is wired up.
    // Dev-only, so the noise is fine — helps when switching tabs.
    // eslint-disable-next-line no-console
    console.warn(
      "%c⚠ DEV MODE — wallet bypass available via DevPanel",
      "background:#f0a030;color:#1a1a2e;padding:3px 8px;font-weight:bold;border-radius:3px;"
    );

    // Read initial value from sessionStorage (survives HMR).
    try {
      setSkip(sessionStorage.getItem(STORAGE_KEY) === "true");
    } catch {
      setSkip(false);
    }

    const handler = (e: Event) => {
      const ce = e as CustomEvent<boolean>;
      setSkip(Boolean(ce.detail));
    };
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, []);

  return skip;
}

/**
 * DevPanel-facing helpers. Kept co-located with the hook so the
 * storage key and event name have exactly one source of truth.
 * `writeDevSkipWallet` persists + broadcasts the new value so every
 * subscribed `useDevSkipWallet()` updates in lock-step.
 *
 * Safe to call from a React render-time handler (e.g. an onChange
 * on the checkbox). No-ops in non-browser contexts.
 */
export function readDevSkipWallet(): boolean {
  if (typeof window === "undefined") return false;
  if (!urlHasDevFlag()) return false;
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function writeDevSkipWallet(value: boolean): void {
  if (typeof window === "undefined") return;
  if (!urlHasDevFlag()) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    /* quota / privacy — ignore */
  }
  try {
    window.dispatchEvent(
      new CustomEvent<boolean>(EVENT_NAME, { detail: value })
    );
  } catch {
    /* older browsers — ignore */
  }
}
