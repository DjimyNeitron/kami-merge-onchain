// ============================================================
// Kami Merge — siwe-verify Edge Function (SIWE auth, NEW)
// ============================================================
// Verifies a Sign-In-With-Ethereum message + signature and issues
// our own short-lived session JWT (sub = wallet address). This is
// the auth gate that replaces Farcaster Quick Auth so scores/mints
// work in the browser AND the Startale App, not only the Farcaster
// client.
//
// Flow:
//   1. Frontend (on connect) builds a SIWE message with:
//        domain         = kami-merge.vercel.app
//        address        = the connected wallet
//        nonce          = random alphanumeric (viem generateSiweNonce)
//        issuedAt       = now
//        expirationTime = now + ~5 min   (bounds replay; stateless)
//      and signs it (wagmi useSignMessage).
//   2. POST { message, signature } here.
//   3. We parse the message, enforce domain + a short expiry window,
//      and verify the signature with viem verifyMessage — which
//      supports EOA *and* ERC-1271 / ERC-6492 smart accounts (Startale
//      AA wallets) when given a public client.
//   4. On success we mint a session JWT (HS256, SIWE_JWT_SECRET):
//        { sub: <lowercased address>, aud: kami-merge.vercel.app,
//          iss: kami-merge, iat, exp: +24h }
//      which submit-score v5 / confirm-mint v3 verify.
//
// Nonce model (decision): stateless. We do NOT store nonces; replay is
// bounded by the message's short expirationTime (rejected if absent or
// > 10 min out). Single-use nonces (a nonce table) are the hardening
// option if ever needed — for a game leaderboard the short window +
// HTTPS is proportionate.
//
// Environment:
//   SIWE_JWT_SECRET — shared HS256 secret (also used by v5 / v3).
//
// Deploy: npx supabase functions deploy siwe-verify --project-ref ehbhmnfxdwjmhwjowjop --no-verify-jwt
//
// NOTE: pin viem if the SIWE/utility API drifts; this uses
// parseSiweMessage (viem/siwe) + client.verifyMessage (core viem).

import { createPublicClient, http } from "npm:viem";
import { parseSiweMessage } from "npm:viem/siwe";
import { soneium } from "npm:viem/chains";
import { SignJWT } from "npm:jose";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_ORIGIN = "kami-merge.vercel.app"; // SIWE domain + JWT audience
const RPC_URL = "https://rpc.soneium.org/";
const JWT_TTL_SECONDS = 60 * 60 * 24; // 24h session
const MAX_SIWE_AGE_MS = 10 * 60 * 1000; // message must expire within 10 min
const ADDR_RE = /^0x[0-9a-f]{40}$/;

const json = (body: Record<string, unknown>, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const secret = Deno.env.get("SIWE_JWT_SECRET");
  if (!secret) return json({ error: "server_misconfig" }, 500);

  let body: { message?: unknown; signature?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const { message, signature } = body;
  if (typeof message !== "string" || typeof signature !== "string") {
    return json({ error: "invalid_payload" }, 400);
  }

  // Parse + structural / freshness guards.
  let fields: ReturnType<typeof parseSiweMessage>;
  try {
    fields = parseSiweMessage(message);
  } catch {
    return json({ error: "invalid_siwe_message" }, 400);
  }
  const claimedAddress = fields.address?.toLowerCase();
  if (!claimedAddress || !ADDR_RE.test(claimedAddress)) {
    return json({ error: "invalid_siwe_message" }, 400);
  }
  if (fields.domain !== ALLOWED_ORIGIN) return json({ error: "bad_domain" }, 403);
  if (!fields.expirationTime) return json({ error: "missing_expiry" }, 400);
  const exp = new Date(fields.expirationTime).getTime();
  const now = Date.now();
  if (!(exp > now) || exp - now > MAX_SIWE_AGE_MS) {
    return json({ error: "bad_expiry" }, 400);
  }

  // Verify signature: EOA via ecrecover, smart accounts via ERC-1271/6492.
  const client = createPublicClient({ chain: soneium, transport: http(RPC_URL) });
  let valid = false;
  try {
    valid = await client.verifyMessage({
      address: fields.address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });
  } catch {
    valid = false;
  }
  if (!valid) return json({ error: "siwe_verification_failed" }, 401);

  // Issue our session JWT.
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claimedAddress)
    .setAudience(ALLOWED_ORIGIN)
    .setIssuer("kami-merge")
    .setIssuedAt()
    // "24h" (relative span) — unambiguous across jose versions; a raw
    // number can be misread as an absolute vs relative exp.
    .setExpirationTime("24h")
    .sign(new TextEncoder().encode(secret));

  return json({ ok: true, token, address: claimedAddress, expiresIn: JWT_TTL_SECONDS }, 200);
});
