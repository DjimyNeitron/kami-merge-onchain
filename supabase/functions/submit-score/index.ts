// ============================================================
// Kami Merge — submit-score Edge Function (Phase 4 Chunk 2)
// ============================================================
// Accepts a Mini-App-side game-over POST, verifies the player's
// Farcaster Quick Auth JWT, sanity-checks the payload against
// floor / ceiling / per-merge-rate plausibility rules, then
// upserts the user profile and inserts the score row. The DB
// trigger on `scores` keeps `personal_bests` in sync.
//
// Auth model:
//   • The caller MUST send `Authorization: Bearer <jwt>` where
//     the JWT was issued by Farcaster Quick Auth via
//     `sdk.quickAuth.getToken()` from inside a Mini App host.
//   • We verify the JWT with `@farcaster/quick-auth` against the
//     hardcoded `kami-merge.vercel.app` audience.
//   • The verified `result.sub` (FID) is the source of truth.
//     The payload's `user.fid` MUST match — if it doesn't, the
//     request is rejected as `fid_mismatch` (a malicious client
//     could otherwise submit scores under another user's FID).
//
// Anti-cheat layers:
//   1. JWT auth — proves the caller is who they claim to be.
//   2. Plausibility — score ceiling, merge-rate floor, run-time
//      floor/ceiling.
//   3. Replay protection — `(fid, client_nonce)` unique index in
//      the DB; second submission with same nonce gets a 409.
//   4. Rate limit — at most 1 submission per FID per 60s.
//   5. DB constraints — last-line-of-defense check() on every
//      numeric column.
//
// CORS:
//   We allow `*` for now since we'll lock down origin in Chunk 4
//   when we know exactly which domains the frontend ships from
//   (kami-merge.vercel.app + the *.vercel.app preview URLs +
//   localhost for dev).
//
// Environment (set via `npx supabase secrets set …`):
//   SUPABASE_URL                — project URL, https://xxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY  — server-only key, bypasses RLS.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { createClient as createQuickAuth } from "npm:@farcaster/quick-auth@0.0.6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// JWT audience claim: the canonical production hostname (no
// scheme, no path). Quick Auth's verifyJwt rejects tokens whose
// `aud` claim doesn't match exactly, so this is the lock.
const ALLOWED_ORIGIN = "kami-merge.vercel.app";

type SubmitPayload = {
  score: number;
  runDurationMs: number;
  mergeCount: number;
  highestYokai: number;
  clientNonce: string;
  walletAddress?: string;
  // Snapshot of context.user from the Mini App SDK. Used to
  // upsert the profile so first-time submissions populate
  // username / pfp / displayName without an extra round-trip.
  user: {
    fid: number;
    username?: string;
    displayName?: string;
    pfpUrl?: string;
  };
};

// Plausibility floor: 1 point per 25ms is roughly the upper bound
// of how fast even perfect cascade play accrues score in Kami Merge.
// Calibrated against: 50K-in-5s bot (rejects), 8.5K-in-4min skilled
// run (allows), 30K-in-15min top-tier run (allows).
function scoreIsPlausible(p: SubmitPayload): boolean {
  if (p.score < 0 || p.score > 1_000_000) return false;
  if (p.runDurationMs < 1000) return false; // sub-1s game = bot
  if (p.runDurationMs > 7_200_000) return false; // 2h cap
  if (p.mergeCount < 0) return false;
  if (p.highestYokai < 0 || p.highestYokai > 10) return false;

  // Score per merge ceiling — top yokai (Amaterasu, tier 10)
  // is worth 8192 in the current scoring table. A run can't
  // exceed `mergeCount * 8192`.
  const maxScorePerMerge = 8192;
  if (p.score > p.mergeCount * maxScorePerMerge) return false;

  // Rough timing floor: total run must take at least ~25ms per
  // accumulated point. Catches "1M points in 5 seconds" and the
  // "50K in 5s" bot pattern. See header comment for calibration.
  const minMsForScore = p.score * 25;
  if (p.runDurationMs < minMsForScore) return false;

  return true;
}

const json = (
  body: Record<string, unknown>,
  status: number,
): Response =>
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
    const result = await quickAuth.verifyJwt({
      token,
      domain: ALLOWED_ORIGIN,
    });
    // sub is typed as number in @farcaster/quick-auth, but
    // defensive Number() handles older / forked SDKs that
    // serialize as string.
    verifiedFid = Number(result.sub);
    if (!Number.isFinite(verifiedFid)) {
      throw new Error("invalid sub");
    }
  } catch (err) {
    return json(
      { error: "auth_failed", detail: String(err) },
      401,
    );
  }

  // ── Parse + shallow-validate payload ────────────────────
  let payload: SubmitPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (!payload.user || typeof payload.user.fid !== "number") {
    return json({ error: "invalid_user" }, 400);
  }
  if (typeof payload.clientNonce !== "string" || payload.clientNonce.length === 0) {
    return json({ error: "invalid_nonce" }, 400);
  }

  // The verified JWT FID is the source of truth. A payload that
  // claims a different FID is either a bug or a tampered client.
  if (payload.user.fid !== verifiedFid) {
    return json({ error: "fid_mismatch" }, 403);
  }

  if (!scoreIsPlausible(payload)) {
    return json({ error: "implausible_score" }, 400);
  }

  // ── DB writes via service_role (bypasses RLS) ───────────
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Rate limit: 1 submission per FID per 60s. Cheaper to do as
  // a count() than a window-function query, and accurate enough
  // at our volume.
  const sixtySecAgo = new Date(Date.now() - 60_000).toISOString();
  const { count: recentCount, error: rateErr } = await supabase
    .from("scores")
    .select("id", { count: "exact", head: true })
    .eq("fid", verifiedFid)
    .gte("submitted_at", sixtySecAgo);
  if (rateErr) {
    return json(
      { error: "rate_check_failed", detail: rateErr.message },
      500,
    );
  }
  if ((recentCount ?? 0) >= 1) {
    return json({ error: "rate_limited" }, 429);
  }

  // Upsert user — first-time profile create + refresh of mutable
  // fields (username / pfp can change on Farcaster).
  const { error: upsertErr } = await supabase.from("users").upsert(
    {
      fid: verifiedFid,
      username: payload.user.username ?? null,
      display_name: payload.user.displayName ?? null,
      pfp_url: payload.user.pfpUrl ?? null,
      wallet_address: payload.walletAddress ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "fid" },
  );
  if (upsertErr) {
    return json(
      { error: "user_upsert_failed", detail: upsertErr.message },
      500,
    );
  }

  // Insert score. Replay attempt → unique-violation (23505) →
  // 409 duplicate_nonce.
  const { data: inserted, error: insertErr } = await supabase
    .from("scores")
    .insert({
      fid: verifiedFid,
      score: payload.score,
      wallet_address: payload.walletAddress ?? null,
      run_duration_ms: payload.runDurationMs,
      merge_count: payload.mergeCount,
      highest_yokai: payload.highestYokai,
      client_nonce: payload.clientNonce,
    })
    .select("id, score")
    .single();

  if (insertErr) {
    if (insertErr.code === "23505") {
      return json({ error: "duplicate_nonce" }, 409);
    }
    return json(
      { error: "insert_failed", detail: insertErr.message },
      500,
    );
  }

  // The trigger has already updated personal_bests if score >
  // existing PB. Read it back so the client can show "new high
  // score!" copy without a second round-trip.
  const { data: pb } = await supabase
    .from("personal_bests")
    .select("score, score_id")
    .eq("fid", verifiedFid)
    .single();

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
