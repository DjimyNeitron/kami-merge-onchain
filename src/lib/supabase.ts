// Supabase anon client — READ-ONLY path for the leaderboard.
//
// The leaderboard READS (top-N personal bests, player rank) run client-side
// with the public anon key, which is safe because RLS grants public SELECT
// only. All WRITES go through the `submit-score` edge function (service_role,
// server-side) — never from here. Do NOT add insert/update/upsert calls.
//
// The anon key is public by design (it ships in the client bundle); the
// `NEXT_PUBLIC_` prefix is intentional. The service-role key must never be
// imported into client code.

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Fail loud in dev/build so a missing env var is obvious, rather than
  // silently producing a client that 401s on every request at runtime.
  throw new Error(
    "[supabase] Missing NEXT_PUBLIC_SUPABASE_URL or " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY. Set both in .env.local (local) and " +
      "in the Vercel project env (production) for leaderboard reads to work.",
  );
}

// Single shared instance — reused across hooks/components so we don't spin up
// a new client (and a new realtime/websocket attempt) per render.
export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    // No user sessions here — reads are anon, writes go via the edge
    // function. Skip persistence/auto-refresh to avoid touching storage.
    persistSession: false,
    autoRefreshToken: false,
  },
});
