"use client";

// useSiweSession — app-wide Sign-In-With-Ethereum session manager.
//
// Replaces Farcaster Quick Auth as the auth for score-submit + mint-confirm
// so the game authenticates in any browser / the Startale App, not only a
// Farcaster client. The flow:
//
//   1. wallet connects (wagmi useAccount) →
//   2. build an EIP-4361 SIWE message (viem/siwe) with the backend's
//      required domain + a short 5-min expiry →
//   3. the wallet signs it (wagmi useSignMessage) →
//   4. POST { message, signature } to the `siwe-verify` edge function →
//   5. store the returned session JWT IN MEMORY (React state) and send it as
//      `Authorization: Bearer <token>` on submit-score / confirm-mint.
//
// The token lives in memory only — NOT localStorage/sessionStorage, which
// Mini App WebViews block. A short-lived in-memory token is fine; the nonce
// is client-generated (stateless verifier) and freshness is the 5-min
// expirationTime baked into the signed message.
//
// One signature per session: the token is reused across runs until it
// expires or the connected address changes/disconnects (then it resets and
// a fresh sign-in is required).

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAccount, useSignMessage } from "wagmi";
import { createSiweMessage, generateSiweNonce } from "viem/siwe";
import { SONEIUM_CHAIN_ID } from "@/config/contract";

// The siwe-verify edge function REQUIRES this exact domain in the signed
// message (and a ≤10-min expiry) or it rejects. Keep in lockstep with the
// deployed verifier + the production origin.
const SIWE_DOMAIN = "kami-merge.vercel.app";
// 5-min message expiry (well inside the verifier's 10-min ceiling).
const SIWE_TTL_MS = 5 * 60 * 1000;
// Small skew margin so we re-sign slightly before a token actually expires.
const EXPIRY_SKEW_MS = 5_000;

export type SiweStatus = "idle" | "signing" | "ready" | "error";

export type SiweSession = {
  /** The session JWT, or null when not signed in. */
  token: string | null;
  /** The address the current token was issued for, or null. */
  address: string | null;
  status: SiweStatus;
  /** Force a fresh sign-in (prompts a signature). Returns the token or null. */
  signIn: () => Promise<string | null>;
  /** Return a valid token, re-signing if missing/expired/address-changed. */
  ensureSession: () => Promise<string | null>;
  /** Synchronous read of the in-memory token (null if absent). */
  getToken: () => string | null;
  /** Drop the session (used on disconnect / address change). */
  reset: () => void;
};

const SiweContext = createContext<SiweSession | null>(null);

export function SiweSessionProvider({ children }: { children: ReactNode }) {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [token, setToken] = useState<string | null>(null);
  const [sessionAddress, setSessionAddress] = useState<string | null>(null);
  const [status, setStatus] = useState<SiweStatus>("idle");
  // ms-epoch when the current token stops being valid.
  const expiresAtRef = useRef(0);
  // De-dupes concurrent signIn() calls so we only ever prompt one signature.
  const inFlightRef = useRef<Promise<string | null> | null>(null);

  const reset = useCallback(() => {
    setToken(null);
    setSessionAddress(null);
    setStatus("idle");
    expiresAtRef.current = 0;
    inFlightRef.current = null;
  }, []);

  // A SIWE token is bound to the address that signed it. Drop a stale
  // session when the wallet disconnects or switches accounts.
  useEffect(() => {
    if (!address) {
      if (token || sessionAddress) reset();
      return;
    }
    if (sessionAddress && address.toLowerCase() !== sessionAddress.toLowerCase()) {
      reset();
    }
  }, [address, sessionAddress, token, reset]);

  const signIn = useCallback(async (): Promise<string | null> => {
    if (!address) {
      setStatus("error");
      return null;
    }
    // Reuse an in-flight sign-in rather than prompting a second signature.
    if (inFlightRef.current) return inFlightRef.current;

    const run = (async (): Promise<string | null> => {
      setStatus("signing");
      try {
        const issuedAt = new Date();
        const expirationTime = new Date(issuedAt.getTime() + SIWE_TTL_MS);
        const message = createSiweMessage({
          domain: SIWE_DOMAIN,
          address,
          statement: "Sign in to Kami Merge",
          uri: window.location.origin,
          version: "1",
          chainId: SONEIUM_CHAIN_ID,
          nonce: generateSiweNonce(),
          issuedAt,
          expirationTime,
        });

        const signature = await signMessageAsync({ message });

        const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        if (!baseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");

        const res = await fetch(`${baseUrl}/functions/v1/siwe-verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, signature }),
        });
        if (!res.ok) throw new Error(`siwe-verify ${res.status}`);

        const json = await res.json();
        if (!json?.ok || typeof json.token !== "string") {
          throw new Error("siwe-verify: malformed response");
        }

        const ttlMs =
          typeof json.expiresIn === "number" && json.expiresIn > 0
            ? json.expiresIn * 1000
            : SIWE_TTL_MS;
        expiresAtRef.current = Date.now() + ttlMs;
        setToken(json.token);
        setSessionAddress(address);
        setStatus("ready");
        return json.token as string;
      } catch (e) {
        console.warn("[siwe] sign-in failed", e);
        setStatus("error");
        return null;
      } finally {
        inFlightRef.current = null;
      }
    })();

    inFlightRef.current = run;
    return run;
  }, [address, signMessageAsync]);

  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (
      token &&
      sessionAddress &&
      address &&
      sessionAddress.toLowerCase() === address.toLowerCase() &&
      Date.now() < expiresAtRef.current - EXPIRY_SKEW_MS
    ) {
      return token;
    }
    return signIn();
  }, [token, sessionAddress, address, signIn]);

  const getToken = useCallback(() => token, [token]);

  // Auto-start sign-in once per freshly connected address so the session is
  // ready by game-over (scores then auto-save). Only fires from `idle`: a
  // rejected sign-in lands in `error` and is NOT re-prompted in a loop — the
  // player re-signs via the game-over "Sign in to save your score" button.
  useEffect(() => {
    if (address && status === "idle" && !token) {
      void signIn();
    }
  }, [address, status, token, signIn]);

  const value = useMemo<SiweSession>(
    () => ({
      token,
      address: sessionAddress,
      status,
      signIn,
      ensureSession,
      getToken,
      reset,
    }),
    [token, sessionAddress, status, signIn, ensureSession, getToken, reset],
  );

  return createElement(SiweContext.Provider, { value }, children);
}

export function useSiweSession(): SiweSession {
  const ctx = useContext(SiweContext);
  if (!ctx) {
    throw new Error("useSiweSession must be used within a SiweSessionProvider");
  }
  return ctx;
}
