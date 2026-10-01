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
//   1. Frontend (on sign-in) builds a SIWE message with:
//        domain         = the page host (window.location.host)
//        chainId        = the chain the player mints on (1868 | 8453)
//        address        = the connected wallet
//        nonce          = random alphanumeric (viem generateSiweNonce)
//        issuedAt       = now
//        expirationTime = now + ~5 min   (bounds replay; stateless)
//      and signs it (wagmi useSignMessage).
//   2. POST { message, signature } here.
//   3. We parse the message, enforce the domain allow-list, a supported
//      chainId and a short expiry window, and verify the signature with
//      viem verifyMessage against THAT chain's public client — EOA *and*
//      ERC-1271 / ERC-6492 smart accounts (Startale AA wallets on Soneium,
//      Coinbase Smart Wallet in the Base app). A smart account usually
//      exists on one chain only, so verifying every message against
//      Soneium failed for Base smart wallets.
//   4. On success we mint a session JWT (HS256, SIWE_JWT_SECRET):
//        { sub: <lowercased address>, aud: kami-merge.vercel.app,
//          iss: kami-merge, iat, exp: +24h }
//      which submit-score v5 / confirm-mint v5 verify. The audience is
//      ALWAYS the production host, whatever domain was signed — those
//      functions pin it.
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
import { soneium, base } from "npm:viem/chains";
import { SignJWT } from "npm:jose";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// JWT audience — fixed; submit-score / confirm-mint pin it.
const JWT_AUDIENCE = "kami-merge.vercel.app";

// SIWE domains we issue sessions for: production, local dev, and this
// project's Vercel previews. Previews are pinned to OUR team suffix — a bare
// "kami-merge-*.vercel.app" would also match a same-named project in any
// other Vercel account, letting a look-alike page obtain sessions.
const ALLOWED_DOMAINS = new Set(["kami-merge.vercel.app", "localhost:3000"]);
const PREVIEW_DOMAIN_RE = /^kami-merge-[a-z0-9-]+-djimyneitrons-projects\.vercel\.app$/;
const isAllowedDomain = (d: string): boolean =>
  ALLOWED_DOMAINS.has(d) || PREVIEW_DOMAIN_RE.test(d);

// Server-authoritative chain registry (mirrors confirm-mint v5). The
// message's chainId may only pick a key; the RPC is never client-supplied.
const CHAINS: Record<number, { chain: any; rpc: string }> = {
  1868: { chain: soneium, rpc: "https://rpc.soneium.org/" },
  8453: { chain: base, rpc: "https://mainnet.base.org" },
};
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
  if (typeof fields.domain !== "string" || !isAllowedDomain(fields.domain)) {
    return json({ error: "bad_domain" }, 403);
  }
  const chainCfg = Number.isInteger(fields.chainId) ? CHAINS[fields.chainId as number] : undefined;
  if (!chainCfg) return json({ error: "unsupported_chain" }, 400);
  if (!fields.expirationTime) return json({ error: "missing_expiry" }, 400);
  const exp = new Date(fields.expirationTime).getTime();
  const now = Date.now();
  if (!(exp > now) || exp - now > MAX_SIWE_AGE_MS) {
    return json({ error: "bad_expiry" }, 400);
  }

  // Verify signature on the message's chain: EOA via ecrecover, smart
  // accounts via ERC-1271/6492 against that chain's deployment.
  const client = createPublicClient({ chain: chainCfg.chain, transport: http(chainCfg.rpc) });
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
    .setAudience(JWT_AUDIENCE)
    .setIssuer("kami-merge")
    .setIssuedAt()
    // "24h" (relative span) — unambiguous across jose versions; a raw
    // number can be misread as an absolute vs relative exp.
    .setExpirationTime("24h")
    .sign(new TextEncoder().encode(secret));

  return json({ ok: true, token, address: claimedAddress, expiresIn: JWT_TTL_SECONDS }, 200);
});
