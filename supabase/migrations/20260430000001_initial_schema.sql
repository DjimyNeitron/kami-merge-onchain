-- ============================================================
-- Kami Merge — Initial schema (Phase 4 Chunk 2)
-- ============================================================
-- Three tables (`users`, `scores`, `personal_bests`) plus a live
-- weekly leaderboard view. RLS is enabled and only public-read
-- policies are present; all writes flow through the
-- `submit-score` Edge Function which uses the service_role key.

-- ──────────────────────────────────────────────────────────────
-- Users: keyed by Farcaster ID (FID)
-- ──────────────────────────────────────────────────────────────
create table public.users (
  fid             bigint       primary key,
  username        text,
  display_name    text,
  pfp_url         text,
  -- Snapshot of the most recently observed wallet address. Used by
  -- the NFT mint flow so we know where to send the on-chain PB
  -- token. Nullable because a player may submit before connecting
  -- a wallet (host-managed wallets in some Mini App clients).
  wallet_address  text,
  created_at      timestamptz  not null default now(),
  updated_at      timestamptz  not null default now()
);

create index users_wallet_idx
  on public.users (wallet_address)
  where wallet_address is not null;

-- ──────────────────────────────────────────────────────────────
-- Scores: every submission, append-only
-- ──────────────────────────────────────────────────────────────
create table public.scores (
  id              uuid         primary key default gen_random_uuid(),
  fid             bigint       not null
                              references public.users(fid)
                              on delete cascade,
  -- Hard ceiling at 1M; the plausibility check in the Edge Function
  -- has tighter rules but the DB constraint is the last line of defense
  -- against a misconfigured Edge Function.
  score           integer      not null check (score >= 0 and score <= 1000000),
  -- Snapshot of the wallet address at submit time. May differ from
  -- `users.wallet_address` if the user reconnects a different wallet
  -- between submissions.
  wallet_address  text,
  -- 2 hours is the longest run we believe a sane player could produce.
  run_duration_ms integer      not null
                              check (run_duration_ms > 0
                                     and run_duration_ms < 7200000),
  merge_count     integer      not null check (merge_count >= 0),
  -- Tier index 0..10 (Kodama..Amaterasu). Kept as smallint to save
  -- bytes; smallint range is plenty.
  highest_yokai   smallint     not null check (highest_yokai between 0 and 10),
  -- Replay protection: client generates a unique nonce per game and
  -- the (fid, client_nonce) unique index causes the second insert to
  -- 23505 unique-violation. The Edge Function maps that to a 409
  -- duplicate_nonce error.
  client_nonce    text         not null,
  submitted_at    timestamptz  not null default now(),
  -- Filled by Chunk 5 when the score's PB is minted on-chain.
  tx_hash         text
);

create unique index scores_fid_nonce_idx
  on public.scores (fid, client_nonce);

create index scores_fid_score_idx
  on public.scores (fid, score desc);

create index scores_score_desc_idx
  on public.scores (score desc, submitted_at asc);

create index scores_submitted_at_idx
  on public.scores (submitted_at desc);

-- ──────────────────────────────────────────────────────────────
-- Personal bests: one row per user, kept in sync via trigger
-- ──────────────────────────────────────────────────────────────
create table public.personal_bests (
  fid             bigint       primary key
                              references public.users(fid)
                              on delete cascade,
  score           integer      not null,
  -- Pointer back to the exact score row that produced this PB.
  -- Useful for showing the run's metadata (duration, merge count).
  score_id        uuid         not null references public.scores(id),
  -- NFT mint state. Cleared whenever a higher score lands so the
  -- next mint replaces (rather than stacks) the previous PB token.
  nft_token_id    bigint,
  nft_minted_at   timestamptz,
  updated_at      timestamptz  not null default now()
);

-- ──────────────────────────────────────────────────────────────
-- Trigger: when a higher score lands, update personal_bests
-- ──────────────────────────────────────────────────────────────
-- Fires AFTER INSERT on scores. Upserts the PB row; the WHERE on
-- the DO UPDATE branch ensures lower scores never overwrite a
-- higher PB. The NFT fields reset on a new PB so Chunk 5's mint
-- flow can detect "PB without a current NFT" and replace.
create or replace function public.update_personal_best()
returns trigger language plpgsql as $$
begin
  insert into public.personal_bests (fid, score, score_id, updated_at)
  values (new.fid, new.score, new.id, now())
  on conflict (fid) do update
    set score = excluded.score,
        score_id = excluded.score_id,
        nft_token_id = null,
        nft_minted_at = null,
        updated_at = excluded.updated_at
    where excluded.score > public.personal_bests.score;
  return new;
end;
$$;

create trigger scores_update_pb
after insert on public.scores
for each row execute function public.update_personal_best();

-- ──────────────────────────────────────────────────────────────
-- Weekly leaderboard view (live; refreshed-via-cron version
-- comes in Chunk 6 once we have query volume to optimise for).
-- ──────────────────────────────────────────────────────────────
create view public.weekly_leaderboard as
select
  date_trunc('week', submitted_at)::date as week_start,
  fid,
  max(score) as best_score,
  count(*)   as runs
from public.scores
where submitted_at >= now() - interval '8 weeks'
group by date_trunc('week', submitted_at), fid;

-- ============================================================
-- Row-level security
-- ============================================================
-- Public read on everything (the leaderboard is open). NO
-- INSERT/UPDATE/DELETE policies — anon + authenticated roles
-- have no write access at all. The Edge Function uses the
-- service_role key, which bypasses RLS entirely.

alter table public.users          enable row level security;
alter table public.scores         enable row level security;
alter table public.personal_bests enable row level security;

create policy "scores_public_read"
  on public.scores for select using (true);

create policy "pb_public_read"
  on public.personal_bests for select using (true);

create policy "users_public_read_basic"
  on public.users for select using (true);
