"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

/**
 * Returns the **actual** chain id reported by the connected wallet's
 * EIP-1193 provider, regardless of whether that chain is in wagmi's
 * `config.chains` array.
 *
 * Why this exists: wagmi's `useChainId()` and `useAccount().chainId`
 * both read from `config.state.chainId`, which wagmi pins to one of
 * the configured chains. When a wallet is connected on an unsupported
 * chain (e.g. MetaMask on Ethereum Mainnet while the app only
 * registers Soneium), wagmi keeps returning the *configured* default
 * chain (1946 in our case) instead of the wallet's real chain (1).
 * That makes a `chainId === soneiumMinato.id` check silently lie. This
 * hook bypasses wagmi state and asks the connector's EIP-1193 provider
 * directly via `eth_chainId`, then keeps the value in sync with the
 * `chainChanged` event.
 *
 * Subscription strategy (in order of preference):
 *   1. `connector.getProvider()` + `.on('chainChanged', …)` — the
 *      canonical wagmi path.
 *   2. `connector.getProvider()` + `.addEventListener(...)` — some
 *      EIP-1193 providers (newer Coinbase Wallet, some WC bridges)
 *      ship the DOM-style API instead of the Node-style `.on`.
 *   3. `window.ethereum` injected provider, same two APIs — used as
 *      a fallback when the connector's provider reference is unstable
 *      (we've observed `connector.getProvider()` returning a fresh
 *      object on every call for some configurations, which orphans
 *      the listener after the first event).
 *   4. 2-second polling — last resort if no event API is available
 *      at all (paranoid path, mostly for old / weird providers).
 *
 * Returns:
 *   - `undefined` while disconnected or while the first round-trip
 *     is pending. Callers should treat `undefined` as "we don't know
 *     yet" and avoid green-lighting the happy path until a real
 *     number lands.
 *   - the wallet's actual chain id (decimal `number`) once known.
 */

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, listener: (data: unknown) => void) => void;
  removeListener?: (
    event: string,
    listener: (data: unknown) => void
  ) => void;
  addEventListener?: (
    event: string,
    listener: (data: unknown) => void
  ) => void;
  removeEventListener?: (
    event: string,
    listener: (data: unknown) => void
  ) => void;
};

function toDecimalChainId(raw: unknown): number | undefined {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const parsed = raw.startsWith("0x") ? parseInt(raw, 16) : parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  // Some providers wrap chainId in a CustomEvent — pull from .detail.
  if (raw && typeof raw === "object" && "detail" in raw) {
    return toDecimalChainId((raw as { detail: unknown }).detail);
  }
  return undefined;
}

export function useActualChainId(): number | undefined {
  const { isConnected, connector } = useAccount();
  const [chainId, setChainId] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!isConnected) {
      setChainId(undefined);
      return;
    }

    let cancelled = false;
    let provider: EthereumProvider | null = null;
    let pollHandle: ReturnType<typeof setInterval> | null = null;
    // Track which subscription style we used so cleanup matches.
    let subscriptionKind: "on" | "addEventListener" | "polling" | null = null;

    const handleChainChanged = (raw: unknown) => {
      if (cancelled) return;
      const decimal = toDecimalChainId(raw);
      console.log(
        "[useActualChainId] chainChanged event:",
        raw,
        "→",
        decimal
      );
      setChainId(decimal);
    };

    const subscribe = (p: EthereumProvider) => {
      if (typeof p.on === "function") {
        p.on("chainChanged", handleChainChanged);
        subscriptionKind = "on";
        console.log("[useActualChainId] subscribed via .on");
        return;
      }
      if (typeof p.addEventListener === "function") {
        p.addEventListener("chainChanged", handleChainChanged);
        subscriptionKind = "addEventListener";
        console.log("[useActualChainId] subscribed via addEventListener");
        return;
      }
      // Polling fallback — re-read every 2s. Cheap (just an RPC call to
      // the injected provider, no network) and only used when the
      // provider exposes neither event API.
      console.warn(
        "[useActualChainId] provider exposes no event API — using 2s polling fallback"
      );
      subscriptionKind = "polling";
      pollHandle = setInterval(async () => {
        if (cancelled) return;
        try {
          const polled = await p.request({ method: "eth_chainId" });
          const decimal = toDecimalChainId(polled);
          setChainId((prev) => (prev !== decimal ? decimal : prev));
        } catch {
          // Provider gone — let the next mount cycle pick a new one.
          if (pollHandle) clearInterval(pollHandle);
          pollHandle = null;
        }
      }, 2000);
    };

    const setup = async () => {
      try {
        // Preferred: ask the connector for its provider.
        let p: EthereumProvider | null = null;
        if (connector?.getProvider) {
          try {
            p = (await connector.getProvider()) as EthereumProvider | null;
          } catch (err) {
            console.warn(
              "[useActualChainId] connector.getProvider failed, will fall back",
              err
            );
          }
        }
        // Fallback: window.ethereum (covers injected wallets even when
        // wagmi's connector reference is unstable across renders).
        if (
          !p &&
          typeof window !== "undefined" &&
          (window as unknown as { ethereum?: EthereumProvider }).ethereum
        ) {
          p = (window as unknown as { ethereum: EthereumProvider }).ethereum;
          console.log("[useActualChainId] using window.ethereum fallback");
        }
        if (!p || cancelled) return;

        provider = p;

        // Initial read.
        try {
          const initialRaw = await p.request({ method: "eth_chainId" });
          if (cancelled) return;
          const decimal = toDecimalChainId(initialRaw);
          console.log(
            "[useActualChainId] initial chainId:",
            initialRaw,
            "→",
            decimal
          );
          setChainId(decimal);
        } catch (err) {
          console.error("[useActualChainId] initial read failed:", err);
        }

        // Live updates.
        if (!cancelled) subscribe(p);
      } catch (err) {
        if (cancelled) return;
        console.error("[useActualChainId] setup failed:", err);
        setChainId(undefined);
      }
    };

    setup();

    return () => {
      cancelled = true;
      if (provider) {
        if (
          subscriptionKind === "on" &&
          typeof provider.removeListener === "function"
        ) {
          provider.removeListener("chainChanged", handleChainChanged);
        } else if (
          subscriptionKind === "addEventListener" &&
          typeof provider.removeEventListener === "function"
        ) {
          provider.removeEventListener("chainChanged", handleChainChanged);
        }
      }
      if (pollHandle) clearInterval(pollHandle);
    };
  }, [isConnected, connector]);

  return chainId;
}
