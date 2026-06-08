// ============================================================
// Kami Merge — confirm-mint Edge Function (Stage 7B Task 3)
// ============================================================
// Records a completed on-chain NFT mint against the player's personal
// best. Mirrors `submit-score`'s auth/CORS/structure exactly.
//
// Auth model (same as submit-score):
//   • Caller MUST send `Authorization: Bearer <jwt>` issued by Farcaster
//     Quick Auth (`sdk.quickAuth.getToken()`).
//   • We verify the JWT against `kami-merge.vercel.app`; the verified
//     `result.sub` (FID) is the source of truth.
//
// Anti-spoof: we do NOT trust the client's claim that a mint happened.
// We re-verify on-chain via viem against Soneium mainnet:
//   1. fetch the tx receipt for `txHash`,
//   2. confirm it succeeded and was sent to OUR contract,
//   3. confirm it emitted a `Minted` event whose tokenId matches.
// Then we bind the mint to the user via `scoreId` ownership (the wallet
// that signed the mint need not equal the FID, so the binding is through
// the player's own personal-best row, not the tx sender).
//
// Environment (set via `npx supabase secrets set …`):
//   SUPABASE_URL                — project URL
//   SUPABASE_SERVICE_ROLE_KEY  — server-only key, bypasses RLS.
//
// Deploy with `--no-verify-jwt` (it does its own Quick Auth, same as
// submit-score).

import { createClient } from "jsr:@supabase/supabase-js@2";
import { createClient as createQuickAuth } from "npm:@farcaster/quick-auth@0.0.6";
import { createPublicClient, http, parseEventLogs } from "npm:viem";
import { soneium } from "npm:viem/chains";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// JWT audience — canonical production hostname (no scheme, no path).
const ALLOWED_ORIGIN = "kami-merge.vercel.app";

// Deployed KamiMergeNFT (Soneium mainnet, chainId 1868).
const CONTRACT = "0x9c21C01a52481a68dB6fad5960d5366D0779983a";
const RPC_URL = "https://rpc.soneium.org/";
const MAX_TYPE_ID = 43;

// Minted(address indexed to, uint256 indexed tokenId, uint8 indexed typeId)
const MINTED_ABI = [
  {
    type: "event",
    name: "Minted",
    inputs: [
      { name: "to", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "typeId", type: "uint8", indexed: true },
    ],
  },
] as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TX_RE = /^0x[0-9a-fA-F]{64}$/;

type ConfirmPayload = {
  tokenId: number;
  txHash: string;
  typeId: number;
  scoreId: string;
};

const json = (body: Record<string, unknown>, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  // ── Auth: verify Farcaster Quick Auth JWT ───────────────
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "missing_auth" }, 401);
  }
  const token = authHeader.slice("Bearer ".length);

  const quickAuth = createQuickAuth();
  let verifiedFid: number;
  try {
    const result = await quickAuth.verifyJwt({ token, domain: ALLOWED_ORIGIN });
    verifiedFid = Number(result.sub);
    if (!Number.isFinite(verifiedFid)) throw new Error("invalid sub");
  } catch (err) {
    return json({ error: "auth_failed", detail: String(err) }, 401);
  }

  // ── Parse + validate payload ────────────────────────────
  let payload: ConfirmPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const { tokenId, txHash, typeId, scoreId } = payload;
  if (!Number.isInteger(tokenId) || tokenId < 1) {
    return json({ error: "invalid_token_id" }, 400);
  }
  if (!Number.isInteger(typeId) || typeId < 0 || typeId > MAX_TYPE_ID) {
    return json({ error: "invalid_type_id" }, 400);
  }
  if (typeof txHash !== "string" || !TX_RE.test(txHash)) {
    return json({ error: "invalid_tx_hash" }, 400);
  }
  if (typeof scoreId !== "string" || !UUID_RE.test(scoreId)) {
    return json({ error: "invalid_score_id" }, 400);
  }

  // ── Anti-spoof: verify the mint on-chain via viem ───────
  const client = createPublicClient({ chain: soneium, transport: http(RPC_URL) });
  let receipt;
  try {
    receipt = await client.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });
  } catch {
    return json(
      { error: "mint_verification_failed", detail: "receipt_not_found" },
      400,
    );
  }
  if (receipt.status !== "success") {
    return json(
      { error: "mint_verification_failed", detail: "tx_not_successful" },
      400,
    );
  }
  if (!receipt.to || receipt.to.toLowerCase() !== CONTRACT.toLowerCase()) {
    return json(
      { error: "mint_verification_failed", detail: "wrong_contract" },
      400,
    );
  }
  // Confirm a Minted event for the claimed tokenId, emitted by our contract.
  let mintedMatch = false;
  try {
    const events = parseEventLogs({
      abi: MINTED_ABI,
      logs: receipt.logs,
      eventName: "Minted",
    });
    for (const ev of events) {
      if (
        ev.address.toLowerCase() === CONTRACT.toLowerCase() &&
        BigInt((ev.args as { tokenId: bigint }).tokenId) === BigInt(tokenId)
      ) {
        mintedMatch = true;
        break;
      }
    }
  } catch {
    mintedMatch = false;
  }
  if (!mintedMatch) {
    return json(
      { error: "mint_verification_failed", detail: "minted_event_mismatch" },
      400,
    );
  }

  // ── Bind to the caller's personal best + record the mint ─
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // The scoreId must belong to the verified FID's personal best. This is
  // what binds the on-chain mint to *this* user (tx sender ≠ fid).
  const { data: pb, error: pbErr } = await supabase
    .from("personal_bests")
    .select("fid, score_id")
    .eq("fid", verifiedFid)
    .eq("score_id", scoreId)
    .maybeSingle();
  if (pbErr) {
    return json({ error: "record_lookup_failed", detail: pbErr.message }, 500);
  }
  if (!pb) {
    return json({ error: "score_mismatch" }, 403);
  }

  const mintedAt = new Date().toISOString();
  const { error: updErr } = await supabase
    .from("personal_bests")
    .update({ nft_token_id: tokenId, nft_minted_at: mintedAt })
    .eq("fid", verifiedFid);
  if (updErr) {
    return json({ error: "record_update_failed", detail: updErr.message }, 500);
  }

  return json({ ok: true, tokenId, mintedAt }, 200);
});
