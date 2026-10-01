"use client";

// useLeaderboard — anon, read-only leaderboard data for the game-over screen.
//
// Two reads, both covered by indexes on personal_bests(score DESC):
//   1. Top-N      — the highest `limit` personal bests, joined to users.
//   2. Player rank — count of personal bests strictly above the player's
//                    best; rank = that count + 1 (ties share a rank).
//
// Everything here is anon SELECT (RLS public read). Writes never happen
// here — runs are submitted through the `submit-score` edge function.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const TOP_N = 50;

export type LeaderboardEntry = {
  rank: number; // 1-based position in the top-N list
  fid: number | null; // display only (Farcaster name/pfp); null for SIWE rows
  score: number;
  username: string | null;
  displayName: string | null;
  pfpUrl: string | null;
  // Lowercased wallet address — the player's identity (own-row match) and
  // the display fallback when there's no Farcaster username.
  address: string | null;
};

export type UseLeaderboardResult = {
  topN: LeaderboardEntry[];
  myRank: number | null;
  myBest: number | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

type EmbeddedUser = {
  username: string | null;
  display_name: string | null;
  pfp_url: string | null;
};

type EmbeddedScore = {
  wallet_address: string | null;
};

/**
 * @param address    the viewer's wallet address (any case; lowercased here)
 *                   for the own-row highlight + rank. Identity is the wallet:
 *                   submit-score v5 no longer writes fid, so fid can't match.
 *                   undefined (no wallet) → no own row / rank.
 * @param seededBest the player's personal best straight from the submit
 *                   response, so we can show their rank without a round-trip
 *                   to fetch their own row. Falls back to a fetch if absent.
 */
export function useLeaderboard(
  address: string | null | undefined,
  seededBest: number | null | undefined,
): UseLeaderboardResult {
  const viewer = address ? address.toLowerCase() : null;
  const [topN, setTopN] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [myBest, setMyBest] = useState<number | null>(seededBest ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1 — Top-N. Both embeds are LEFT joins (no `!inner`), so address-only
      // rows (fid null, no users match) are KEPT — they just come back with
      // `users: null`. The address is personal_bests.wallet_address, with the
      // linked score's wallet_address (score_id → scores) as a fallback.
      const { data, error: topErr } = await supabase
        .from("personal_bests")
        .select(
          "score, fid, wallet_address, users(username, display_name, pfp_url), scores(wallet_address)",
        )
        .order("score", { ascending: false })
        .limit(TOP_N);
      if (topErr) throw topErr;

      const rows: LeaderboardEntry[] = (data ?? []).map((r, i) => {
        // supabase-js may type a FK embed as an object or a 1-element array
        // depending on cardinality inference — handle both.
        const rawUser = r.users as EmbeddedUser | EmbeddedUser[] | null;
        const u = Array.isArray(rawUser) ? rawUser[0] ?? null : rawUser;
        const rawScore = r.scores as EmbeddedScore | EmbeddedScore[] | null;
        const s = Array.isArray(rawScore) ? rawScore[0] ?? null : rawScore;
        return {
          rank: i + 1,
          fid: r.fid ?? null,
          score: r.score,
          username: u?.username ?? null,
          displayName: u?.display_name ?? null,
          pfpUrl: u?.pfp_url ?? null,
          address:
            (r.wallet_address ?? s?.wallet_address)?.toLowerCase() ?? null,
        };
      });
      setTopN(rows);

      // 2 — The player's best: prefer the seed from the submit response,
      // else fetch their own row by wallet. Skip entirely without a wallet.
      let best = seededBest ?? null;
      if (best == null && viewer) {
        const { data: mine, error: mineErr } = await supabase
          .from("personal_bests")
          .select("score")
          .eq("wallet_address", viewer)
          .maybeSingle();
        if (mineErr) throw mineErr;
        best = mine?.score ?? null;
      }
      setMyBest(best);

      // 3 — Rank = (count of personal bests strictly greater) + 1. Indexed
      // count, head-only (no rows transferred). Ties share a rank.
      if (best != null) {
        const { count, error: rankErr } = await supabase
          .from("personal_bests")
          .select("*", { count: "exact", head: true })
          .gt("score", best);
        if (rankErr) throw rankErr;
        setMyRank((count ?? 0) + 1);
      } else {
        setMyRank(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  }, [viewer, seededBest]);

  useEffect(() => {
    load();
  }, [load]);

  return { topN, myRank, myBest, loading, error, refetch: load };
}
