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
 * That makes a `chainId === soneiumMinato.id` "are we on the right
 * chain?" check silently lie. This hook bypasses wagmi state and asks
 * the connector's provider directly via `eth_chainId`, then keeps the
 * value in sync with the EIP-1193 `chainChanged` event.
 *
 * Returns:
 *   - `undefined` while the wallet is disconnected or while the first
 *     `eth_chainId` round-trip is still pending. Callers should treat
 *     `undefined` as "we don't know yet" and avoid green-lighting the
 *     happy path until a real number lands.
 *   - the wallet's actual chain id (decimal `number`) once known —
 *     can be ANY id, including ones the app does not support.
 */

// We only use a tiny slice of the EIP-1193 surface — `request` for the
// initial read and `on/removeListener` for the change subscription.
// Some injected providers (older Brave / SafePal) ship without `on`;
// the hook degrades gracefully to a one-shot read in that case.
type EthereumProvider = {
  request: (args: { method: string }) => Promise<unknown>;
  on?: (event: "chainChanged", listener: (chainIdHex: string) => void) => void;
  removeListener?: (
    event: "chainChanged",
    listener: (chainIdHex: string) => void
  ) => void;
};

function toDecimalChainId(raw: unknown): number | undefined {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const parsed = raw.startsWith("0x") ? parseInt(raw, 16) : parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function useActualChainId(): number | undefined {
  const { isConnected, connector } = useAccount();
  const [chainId, setChainId] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!isConnected || !connector) {
      setChainId(undefined);
      return;
    }

    let cancelled = false;
    let provider: EthereumProvider | null = null;

    const handleChange = (raw: unknown) => {
      if (cancelled) return;
      const id = toDecimalChainId(raw);
      console.log("[useActualChainId] chain change detected:", id);
      setChainId(id);
    };

    const setup = async () => {
      try {
        const got = (await connector.getProvider()) as EthereumProvider | null;
        if (cancelled || !got) return;
        provider = got;

        const initialRaw = await got.request({ method: "eth_chainId" });
        handleChange(initialRaw);

        if (typeof got.on === "function") {
          got.on("chainChanged", handleChange);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("[useActualChainId] read failed:", err);
        setChainId(undefined);
      }
    };

    setup();

    return () => {
      cancelled = true;
      if (provider && typeof provider.removeListener === "function") {
        provider.removeListener("chainChanged", handleChange);
      }
    };
  }, [isConnected, connector]);

  return chainId;
}
