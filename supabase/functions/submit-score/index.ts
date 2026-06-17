// ============================================================
// Kami Merge — submit-score Edge Function (v5: SIWE / address)
// ============================================================
// Accepts a game-over POST, verifies the player's SIWE session JWT
// (issued by `siwe-verify`), sanity-checks the payload against the
// same plausibility rules as before, then inserts the score keyed by
// WALLET ADDRESS. The DB trigger on `scores` keeps `personal_bests`
// (now address-keyed) in sync.
//
// What changed vs v4:
//   • Auth: Farcaster Quick Auth JWT  →  our SIWE session JWT.
//     identity = `sub` (lowercased wallet address), not FID.
//   • Replay: (fid, client_nonce)  →  (wallet_address, client_nonce)
//     [DB unique index scores_addr_nonce_idx].
//   • Rate limit: per FID  →  per wallet_address.
//   • We no longer store client-supplied fid / username / pfp
//     (identity is the address; storing client-claimed Farcaster
//     fields invites cosmetic spoofing). Display is address-based;
//     trusted profile enrichment (Startale / ENS) is a later step.
//   • Plausibility rules are UNCHANGED (same constants/thresholds).
//
// Auth model:
//   • Caller MUST send `Authorization: Bearer <jwt>` where the JWT was
//     issued by `siwe-verify` (HS256, SIWE_JWT_SECRET, aud
//     kami-merge.vercel.app, iss kami-merge). The verified `sub` is the
//     wallet address and the source of truth — a client cannot submit
//     under another address.
//
// Environment:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (bypasses RLS)
//   SIWE_JWT_SECRET (shared with siwe-verify / confirm-mint)
//
// Deploy: npx supabase functions deploy submit-score --project-ref ehbhmnfxdwjmhwjowjop --no-verify-jwt

import { createClient } from "jsr:@supabase/supabase-js@2";
import { jwtVerify } from "npm:jose";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_ORIGIN = "kami-merge.vercel.app"; // JWT audience
const ADDR_RE = /^0x[0-9a-f]{40}$/;

type SubmitPayload = {
  score: number;
  runDurationMs: number;
  mergeCount: number;
  highestYokai: number;
  clientNonce: string;
};

// Plausibility floor: 1 point per 25ms is roughly the upper bound of
// how fast even perfect cascade play accrues score in Kami Merge.
// Calibrated against: 50K-in-5s bot (rejects), 8.5K-in-4min skilled
// run (allows), 30K-in-15min top-tier run (allows).
function scoreIsPlausible(p: SubmitPayload): boolean {
  if (p.score < 0 || p.score > 1_000_000) return false;
  if (p.runDurationMs < 1000) return false; // sub-1s game = bot
  if (p.runDurationMs > 7_200_000) return false; // 2h cap
  if (p.mergeCount < 0) return false;
  if (p.highestYokai < 0 || p.highestYokai > 10) return false;

  // Score per merge ceiling — top yokai (Amaterasu, tier 10) is worth
  // 8192 in the current scoring table. A run can't exceed mergeCount*8192.
  const maxScorePerMerge = 8192;
  if (p.score > p.mergeCount * maxScorePerMerge) return false;

  // Timing floor: total run must take at least ~25ms per accumulated
  // point. Catches "1M points in 5 seconds" / "50K in 5s" bot patterns.
  const minMsForScore = p.score * 25;
  if (p.runDurationMs < minMsForScore) return false;

  return true;
}

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

  // ── Parse + shallow-validate payload ────────────────────
  let payload: SubmitPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (typeof payload.clientNonce !== "string" || payload.clientNonce.length === 0) {
    return json({ error: "invalid_nonce" }, 400);
  }
  if (
    typeof payload.score !== "number" ||
    typeof payload.runDurationMs !== "number" ||
    typeof payload.mergeCount !== "number" ||
    typeof payload.highestYokai !== "number"
  ) {
    return json({ error: "invalid_payload" }, 400);
  }
  if (!scoreIsPlausible(payload)) return json({ error: "implausible_score" }, 400);

  // ── DB writes via service_role (bypasses RLS) ───────────
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Rate limit: 1 submission per wallet per 60s.
  const sixtySecAgo = new Date(Date.now() - 60_000).toISOString();
  const { count: recentCount, error: rateErr } = await supabase
    .from("scores")
    .select("id", { count: "exact", head: true })
    .eq("wallet_address", address)
    .gte("submitted_at", sixtySecAgo);
  if (rateErr) {
    return json({ error: "rate_check_failed", detail: rateErr.message }, 500);
  }
  if ((recentCount ?? 0) >= 1) return json({ error: "rate_limited" }, 429);

  // Insert score. Replay attempt → unique-violation (23505) on
  // scores_addr_nonce_idx (wallet_address, client_nonce) → 409.
  const { data: inserted, error: insertErr } = await supabase
    .from("scores")
    .insert({
      wallet_address: address,
      score: payload.score,
      run_duration_ms: payload.runDurationMs,
      merge_count: payload.mergeCount,
      highest_yokai: payload.highestYokai,
      client_nonce: payload.clientNonce,
      // fid intentionally omitted (nullable) — identity is the address.
    })
    .select("id, score")
    .single();

  if (insertErr) {
    if (insertErr.code === "23505") return json({ error: "duplicate_nonce" }, 409);
    return json({ error: "insert_failed", detail: insertErr.message }, 500);
  }

  // Trigger has already upserted personal_bests (address-keyed) if this
  // beat the prior PB. Read it back for "new high score!" copy.
  const { data: pb } = await supabase
    .from("personal_bests")
    .select("score, score_id")
    .eq("wallet_address", address)
    .maybeSingle();

  const isNewPersonalBest = pb?.score_id === inserted.id;

  return json(
    {
      ok: true,
      scoreId: inserted.id,
      isNewPersonalBest,
      personalBest: pb?.score ?? inserted.score,
    },
    200,
  );
});
