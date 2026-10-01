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
//   5. store the returned session JWT IN MEMORY (refs + React state) and send it as
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
  /**
   * Synchronous read of a *valid* token — returns it only if it was issued
   * for the currently-connected address and hasn't expired. Returns null
   * otherwise WITHOUT signing. Use this to decide "is the player already
   * signed in?" without ever triggering a signature prompt.
   */
  getValidToken: () => string | null;
  /** Drop the session (used on disconnect / address change). */
  reset: () => void;
};

const SiweContext = createContext<SiweSession | null>(null);

export function SiweSessionProvider({ children }: { children: ReactNode }) {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();

  // React state is for RENDERING only (status, and token/address for
  // consumers that display them). Every read that decides whether to sign
  // goes through the refs below, which are updated synchronously. Reading
  // state from a callback's closure is what produced a second signature in
  // the mint flow: ensureScoreSaved() signed, then ensureSession() from the
  // same render's closure still saw token === null and signed again.
  const [token, setToken] = useState<string | null>(null);
  const [sessionAddress, setSessionAddress] = useState<string | null>(null);
  const [status, setStatus] = useState<SiweStatus>("idle");
  const tokenRef = useRef<string | null>(null);
  const sessionAddressRef = useRef<string | null>(null);
  // ms-epoch when the current token stops being valid.
  const expiresAtRef = useRef(0);
  // Latest connected address, so callbacks never act on a stale one.
  const addressRef = useRef<string | undefined>(address);
  // De-dupes concurrent sign-ins so we only ever prompt one signature.
  const inFlightRef = useRef<Promise<string | null> | null>(null);
  // Bumped by reset(); a sign-in that started before a reset must not
  // resurrect the dropped session when it settles.
  const generationRef = useRef(0);

  useEffect(() => {
    addressRef.current = address;
  }, [address]);

  const reset = useCallback(() => {
    generationRef.current += 1;
    tokenRef.current = null;
    sessionAddressRef.current = null;
    expiresAtRef.current = 0;
    setToken(null);
    setSessionAddress(null);
    setStatus("idle");
    // inFlightRef is deliberately NOT cleared: an in-flight sign-in settles
    // on its own (its finally clears the ref) and, thanks to the generation
    // check, does not store its token. Clearing it here would let a second
    // caller start a parallel sign-in → a second wallet popup.
  }, []);

  // A SIWE token is bound to the address that signed it. Drop a stale
  // session when the wallet disconnects or switches accounts.
  useEffect(() => {
    const current = sessionAddressRef.current;
    if (!address) {
      if (tokenRef.current || current) reset();
      return;
    }
    if (current && address.toLowerCase() !== current.toLowerCase()) {
      reset();
    }
  }, [address, sessionAddress, token, reset]);

  // Valid-or-null read from the refs. A token counts as valid only if it was
  // issued for the currently-connected address and is still within its
  // expiry (minus a small skew margin).
  const readValidToken = useCallback((): string | null => {
    const t = tokenRef.current;
    const sa = sessionAddressRef.current;
    const a = addressRef.current;
    if (
      t &&
      sa &&
      a &&
      sa.toLowerCase() === a.toLowerCase() &&
      Date.now() < expiresAtRef.current - EXPIRY_SKEW_MS
    ) {
      return t;
    }
    return null;
  }, []);

  const signIn = useCallback(async (): Promise<string | null> => {
    // Reuse an in-flight sign-in rather than prompting a second signature.
    if (inFlightRef.current) return inFlightRef.current;
    const signer = addressRef.current;
    if (!signer) {
      setStatus("error");
      return null;
    }
    const generation = generationRef.current;

    const run = (async (): Promise<string | null> => {
      setStatus("signing");
      try {
        const issuedAt = new Date();
        const expirationTime = new Date(issuedAt.getTime() + SIWE_TTL_MS);
        const message = createSiweMessage({
          domain: SIWE_DOMAIN,
          address: signer as `0x${string}`,
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

        // Session was reset (disconnect / account switch) mid-sign: don't
        // store a token for a session that no longer exists.
        if (generation !== generationRef.current) return null;

        const ttlMs =
          typeof json.expiresIn === "number" && json.expiresIn > 0
            ? json.expiresIn * 1000
            : SIWE_TTL_MS;
        // Refs first, synchronously — any caller awaiting this promise (or
        // calling ensureSession right after) sees the session immediately.
        tokenRef.current = json.token;
        sessionAddressRef.current = signer;
        expiresAtRef.current = Date.now() + ttlMs;
        setToken(json.token);
        setSessionAddress(signer);
        setStatus("ready");
        return json.token as string;
      } catch (e) {
        console.warn("[siwe] sign-in failed", e);
        if (generation === generationRef.current) setStatus("error");
        return null;
      } finally {
        inFlightRef.current = null;
      }
    })();

    inFlightRef.current = run;
    return run;
  }, [signMessageAsync]);

  const ensureSession = useCallback(async (): Promise<string | null> => {
    const valid = readValidToken();
    if (valid) return valid;
    // signIn() itself returns any in-flight sign-in (dedupe).
    return signIn();
  }, [readValidToken, signIn]);

  const getToken = useCallback(() => tokenRef.current, []);

  // Valid-or-null read with NO side effects — never signs.
  const getValidToken = useCallback(
    (): string | null => readValidToken(),
    [readValidToken],
  );

  // NOTE: sign-in is fully lazy / user-initiated — there is intentionally NO
  // auto-sign-on-connect effect here. A signature is only ever requested when
  // the player taps "Sign in to save your score" (game-over) or Mint, both of
  // which call signIn()/ensureSession() directly. Auto-signing on connect
  // produced an unprompted on-load popup AND raced the connect handshake
  // (two-tries-to-connect). Reset-on-disconnect/address-change still applies.

  const value = useMemo<SiweSession>(
    () => ({
      token,
      address: sessionAddress,
      status,
      signIn,
      ensureSession,
      getToken,
      getValidToken,
      reset,
    }),
    [
      token,
      sessionAddress,
      status,
      signIn,
      ensureSession,
      getToken,
      getValidToken,
      reset,
    ],
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
