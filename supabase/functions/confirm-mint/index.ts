// ============================================================
// Kami Merge — confirm-mint Edge Function (v3: SIWE / address)
// ============================================================
// Records a completed on-chain NFT mint, bound to the player's WALLET
// ADDRESS. Mirrors submit-score v5's auth/CORS/structure.
//
// What changed vs v2:
//   • Auth: Farcaster Quick Auth JWT  →  our SIWE session JWT
//     (identity = `sub` = lowercased wallet address).
//   • Binding: scoreId must belong to the authenticated ADDRESS
//     (scores.wallet_address = sub) instead of the FID.
//   • PB stamp keyed by wallet_address; minter_address stored lowercased.
//   • On-chain verification is UNCHANGED.
//
// Anti-spoof (unchanged): we do NOT trust the client's claim that a mint
// happened. We re-verify on-chain via viem against Soneium mainnet:
//   1. fetch the tx receipt for `txHash`,
//   2. confirm it succeeded and was sent to OUR contract,
//   3. confirm it emitted a `Minted` event whose tokenId matches.
// Then we bind the mint via scoreId ownership — the scoreId must be one
// of the authenticated address's score rows. The wallet that signed the
// mint on-chain need not equal the authenticated address; we record the
// on-chain minter as `minter_address`.
//
// Environment:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (bypasses RLS)
//   SIWE_JWT_SECRET (shared with siwe-verify / submit-score)
//
// Deploy: npx supabase functions deploy confirm-mint --project-ref ehbhmnfxdwjmhwjowjop --no-verify-jwt

import { createClient } from "jsr:@supabase/supabase-js@2";
import { jwtVerify } from "npm:jose";
import { createPublicClient, http, parseEventLogs } from "npm:viem";
import { soneium } from "npm:viem/chains";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_ORIGIN = "kami-merge.vercel.app"; // JWT audience
const ADDR_RE = /^0x[0-9a-f]{40}$/;

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // ── Auth: verify our SIWE session JWT ───────────────────
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "missing_auth" }, 401);
  const token = authHeader.slice("Bearer ".length);

  const secret = Deno.env.get("SIWE_JWT_SECRET");
  if (!secret) return json({ error: "server_misconfig" }, 500);

  let address: string;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      audience: ALLOWED_ORIGIN,
      issuer: "kami-merge",
    });
    address = String(payload.sub ?? "").toLowerCase();
    if (!ADDR_RE.test(address)) throw new Error("bad sub");
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
  if (!Number.isInteger(tokenId) || tokenId < 1) return json({ error: "invalid_token_id" }, 400);
  if (!Number.isInteger(typeId) || typeId < 0 || typeId > MAX_TYPE_ID) {
    return json({ error: "invalid_type_id" }, 400);
  }
  if (typeof txHash !== "string" || !TX_RE.test(txHash)) return json({ error: "invalid_tx_hash" }, 400);
  if (typeof scoreId !== "string" || !UUID_RE.test(scoreId)) return json({ error: "invalid_score_id" }, 400);

  // ── Anti-spoof: verify the mint on-chain via viem ───────
  const client = createPublicClient({ chain: soneium, transport: http(RPC_URL) });
  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });
  } catch {
    return json({ error: "mint_verification_failed", detail: "receipt_not_found" }, 400);
  }
  if (receipt.status !== "success") {
    return json({ error: "mint_verification_failed", detail: "tx_not_successful" }, 400);
  }
  if (!receipt.to || receipt.to.toLowerCase() !== CONTRACT.toLowerCase()) {
    return json({ error: "mint_verification_failed", detail: "wrong_contract" }, 400);
  }
  let mintedMatch = false;
  try {
    const events = parseEventLogs({ abi: MINTED_ABI, logs: receipt.logs, eventName: "Minted" });
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
    return json({ error: "mint_verification_failed", detail: "minted_event_mismatch" }, 400);
  }

  // ── Bind to the authenticated address + record the mint ─
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // The scoreId must be one of the authenticated address's score rows.
  // (Binding is by score ownership, not the on-chain minter — the mint
  // can be signed by any wallet; we record it as minter_address.)
  const { data: scoreRow, error: scoreErr } = await supabase
    .from("scores")
    .select("id, wallet_address")
    .eq("id", scoreId)
    .eq("wallet_address", address)
    .maybeSingle();
  if (scoreErr) {
    return json({ error: "record_lookup_failed", detail: scoreErr.message }, 500);
  }
  if (!scoreRow) return json({ error: "score_mismatch" }, 403);

  const mintedAt = new Date().toISOString();
  const minterAddress = (receipt.from ?? "").toLowerCase();

  // Record the mint. Idempotent: a retry with the same tx_hash / token_id
  // (unique constraints) is a benign no-op success, not an error.
  const { error: insErr } = await supabase.from("mints").insert({
    score_id: scoreId,
    token_id: tokenId,
    type_id: typeId,
    tx_hash: txHash,
    minter_address: minterAddress,
    minted_at: mintedAt,
    // fid intentionally omitted (nullable) — identity is the address.
  });
  if (insErr && insErr.code !== "23505") {
    return json({ error: "record_insert_failed", detail: insErr.message }, 500);
  }
  const alreadyRecorded = insErr?.code === "23505";

  // Shrine display: stamp personal_bests with the NFT only when this
  // scoreId IS the address's current PB row. Non-PB runs leave PB
  // untouched (their NFT lives in `mints`).
  const { data: pb } = await supabase
    .from("personal_bests")
    .select("score_id")
    .eq("wallet_address", address)
    .maybeSingle();
  if (pb?.score_id === scoreId) {
    await supabase
      .from("personal_bests")
      .update({ nft_token_id: tokenId, nft_minted_at: mintedAt })
      .eq("wallet_address", address);
  }

  return json({ ok: true, tokenId, mintedAt, alreadyRecorded }, 200);
});
