// ============================================================
// Kami Merge — confirm-mint Edge Function (v5: multichain + audit hardening)
// ============================================================
// Records a completed on-chain NFT mint, bound to the player's WALLET
// ADDRESS, on EITHER Soneium (1868) or Base (8453).
//
// What changed vs v4 (v3 SIWE) — each item maps to an audit finding:
//   • MULTICHAIN: a server-side CHAINS map holds {rpc, contract} per
//     chainId. The client sends only a chainId KEY (1868 | 8453); we never
//     trust a client-supplied RPC or contract address. mints.chain_id is
//     recorded. (fixes the single-chain limitation / F6 at the app layer)
//   • F1 — typeId is now taken FROM the on-chain `Minted` event, NOT from
//     the client. The client's typeId (if sent) is ignored for recording;
//     we store the event's typeId. A client can no longer log a rarer kami
//     than they actually minted.
//   • F2 — the on-chain RECIPIENT (Minted.to) must equal the authenticated
//     wallet (JWT sub). You can no longer bind someone else's mint to your
//     own score/Shrine. minter_address records that recipient.
//   • F10 — jwtVerify pins algorithms: ["HS256"] (no alg confusion).
//   • F9 — error responses no longer leak internal `detail:` strings.
//
// Corrections vs the first v5 draft:
//   • No `receipt.to === contract` check. Smart-wallet (ERC-4337) mints are
//     sent to the EntryPoint, not the NFT contract, so that check rejected
//     valid mints. The Minted-log address check below is sufficient: only
//     our contract can emit a Minted log at its own address.
//   • minter_address = Minted.to (the player), not receipt.from (which is
//     the bundler for a smart-wallet mint).
//   • No personal_bests nft_* write. The NFT is decoupled from the
//     leaderboard: `mints` is the record, the Shrine reads ownership
//     on-chain, and the PB trigger never touches nft_*.
//   • A duplicate-key insert is only reported as alreadyRecorded when the
//     existing (chain_id, tx_hash) row matches this token + minter;
//     anything else is a 409 conflict, not a silent success.
//
// Unchanged guarantees: we re-verify the mint on-chain (receipt success,
// Minted event from our contract) before recording; binding requires the
// scoreId to belong to the authenticated address; idempotent on retries.
//
// Environment:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (bypasses RLS)
//   SIWE_JWT_SECRET (shared with siwe-verify / submit-score)
//
// Deploy: npx supabase functions deploy confirm-mint --project-ref ehbhmnfxdwjmhwjowjop --no-verify-jwt

import { createClient } from "jsr:@supabase/supabase-js@2";
import { jwtVerify } from "npm:jose";
import { createPublicClient, http, parseEventLogs } from "npm:viem";
import { soneium, base } from "npm:viem/chains";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_ORIGIN = "kami-merge.vercel.app"; // JWT audience
const ADDR_RE = /^0x[0-9a-f]{40}$/;
const MAX_TYPE_ID = 43;

// ── Server-authoritative chain registry ─────────────────────
// The client may only pick a KEY from here. RPC + contract are never
// client-supplied. To add a chain later, add one entry.
const CHAINS: Record<number, { chain: any; rpc: string; contract: string }> = {
  1868: {
    chain: soneium,
    rpc: "https://rpc.soneium.org/",
    contract: "0x9c21C01a52481a68dB6fad5960d5366D0779983a",
  },
  8453: {
    chain: base,
    rpc: "https://mainnet.base.org",
    contract: "0x9EDDC0156c587ace1f1636326FE7378856DeC0C4",
  },
};
const DEFAULT_CHAIN_ID = 1868; // back-compat: older clients that omit chainId

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
  typeId?: number;   // F1: accepted but IGNORED for recording (event wins)
  scoreId: string;
  chainId?: number;  // multichain: key into CHAINS; defaults to Soneium
};

const json = (body: Record<string, unknown>, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // ── Auth: verify our SIWE session JWT (F10: pin HS256) ───
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
      algorithms: ["HS256"], // F10
    });
    address = String(payload.sub ?? "").toLowerCase();
    if (!ADDR_RE.test(address)) throw new Error("bad sub");
  } catch {
    return json({ error: "auth_failed" }, 401); // F9: no detail leak
  }

  // ── Parse + validate payload ────────────────────────────
  let payload: ConfirmPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const { tokenId, txHash, scoreId } = payload;

  // Resolve chain from the server registry (never trust client rpc/contract)
  const chainId = Number.isInteger(payload.chainId) ? Number(payload.chainId) : DEFAULT_CHAIN_ID;
  const chainCfg = CHAINS[chainId];
  if (!chainCfg) return json({ error: "unsupported_chain" }, 400);

  if (!Number.isInteger(tokenId) || tokenId < 1) return json({ error: "invalid_token_id" }, 400);
  if (typeof txHash !== "string" || !TX_RE.test(txHash)) return json({ error: "invalid_tx_hash" }, 400);
  if (typeof scoreId !== "string" || !UUID_RE.test(scoreId)) return json({ error: "invalid_score_id" }, 400);

  // ── Anti-spoof: verify the mint on-chain via viem ───────
  const client = createPublicClient({ chain: chainCfg.chain, transport: http(chainCfg.rpc) });
  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });
  } catch {
    return json({ error: "mint_verification_failed" }, 400); // F9
  }
  if (receipt.status !== "success") return json({ error: "mint_verification_failed" }, 400);
  // No receipt.to check: smart-wallet mints target the EntryPoint. The
  // Minted-log address check below pins the event to our contract.

  // F1 + F2: pull typeId + recipient FROM the on-chain event (source of truth).
  let eventTypeId: number | null = null;
  let eventRecipient: string | null = null;
  try {
    const events = parseEventLogs({ abi: MINTED_ABI, logs: receipt.logs, eventName: "Minted" });
    for (const ev of events) {
      const args = ev.args as { to: string; tokenId: bigint; typeId: number };
      if (
        ev.address.toLowerCase() === chainCfg.contract.toLowerCase() &&
        BigInt(args.tokenId) === BigInt(tokenId)
      ) {
        eventTypeId = Number(args.typeId);
        eventRecipient = String(args.to).toLowerCase();
        break;
      }
    }
  } catch {
    eventTypeId = null;
    eventRecipient = null;
  }
  if (eventTypeId === null || eventRecipient === null) {
    return json({ error: "mint_verification_failed" }, 400); // no matching Minted event
  }
  if (eventTypeId < 0 || eventTypeId > MAX_TYPE_ID) {
    return json({ error: "mint_verification_failed" }, 400);
  }
  // F2: the NFT recipient must be the authenticated wallet — you can only
  // record a mint that landed in YOUR wallet, not someone else's.
  if (eventRecipient !== address) {
    return json({ error: "recipient_mismatch" }, 403);
  }

  // ── Bind to the authenticated address + record the mint ─
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // The scoreId must be one of the authenticated address's score rows.
  const { data: scoreRow, error: scoreErr } = await supabase
    .from("scores")
    .select("id, wallet_address")
    .eq("id", scoreId)
    .eq("wallet_address", address)
    .maybeSingle();
  if (scoreErr) return json({ error: "record_lookup_failed" }, 500); // F9
  if (!scoreRow) return json({ error: "score_mismatch" }, 403);

  const mintedAt = new Date().toISOString();
  // The player who received the NFT (Minted.to) — already proven equal to
  // the authenticated address above. Not receipt.from, which is the
  // bundler for a smart-wallet mint.
  const minterAddress = eventRecipient;

  // Record the mint. typeId + chain_id are server-derived, not client-trusted.
  const { error: insErr } = await supabase.from("mints").insert({
    score_id: scoreId,
    token_id: tokenId,
    type_id: eventTypeId,   // F1: from event
    tx_hash: txHash,
    minter_address: minterAddress,
    minted_at: mintedAt,
    chain_id: chainId,      // multichain
    // fid intentionally omitted (nullable) — identity is the address.
  });
  if (insErr && insErr.code !== "23505") {
    return json({ error: "record_insert_failed" }, 500); // F9
  }

  // Duplicate key (23505) on UNIQUE(chain_id, tx_hash) or
  // UNIQUE(chain_id, token_id). Only a genuine retry of THIS mint is a
  // benign no-op: the existing (chain_id, tx_hash) row must carry the same
  // token_id and minter. Anything else (e.g. the token is already recorded
  // under a different tx) is a conflict, never a silent success.
  let alreadyRecorded = false;
  if (insErr) {
    const { data: existing, error: dupErr } = await supabase
      .from("mints")
      .select("token_id, minter_address")
      .eq("chain_id", chainId)
      .eq("tx_hash", txHash)
      .maybeSingle();
    if (dupErr) return json({ error: "record_lookup_failed" }, 500); // F9
    if (
      !existing ||
      Number(existing.token_id) !== tokenId ||
      String(existing.minter_address).toLowerCase() !== minterAddress
    ) {
      return json({ error: "record_conflict" }, 409);
    }
    alreadyRecorded = true;
  }

  return json({ ok: true, tokenId, typeId: eventTypeId, chainId, mintedAt, alreadyRecorded }, 200);
});
