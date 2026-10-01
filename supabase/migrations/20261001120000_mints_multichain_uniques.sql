-- Repo ↔ production schema sync: multichain mints + SIWE wallet model +
-- score-only personal-best trigger.
--
-- Brings the repo schema in line with what is ALREADY LIVE in production
-- (applied there via MCP). Every step is guarded, so running this against
-- production is a no-op; against a fresh database it upgrades the original
-- schema (20260430000001 + 20260608120000).
--
-- 1–3. Multichain mints. Both KamiMergeNFT contracts (Soneium 1868, Base
--      8453) number tokens from 1, so a global UNIQUE(token_id) makes Base
--      token #N collide with Soneium token #N. Uniqueness is per chain.
--      confirm-mint v5 relies on UNIQUE(chain_id, tx_hash) to detect retries.
-- 4–8. SIWE wallet model: identity is the wallet address, so fid becomes
--      nullable and personal_bests is unique per wallet_address.
-- 9.   update_personal_best() keyed by wallet_address, updating the SCORE
--      only — it never touches nft_* (the NFT is decoupled from the PB).
--
-- NOT auto-applied — applied via MCP after review.

-- 1. Chain columns (no-op if they already exist).
alter table public.mints
  add column if not exists chain_id integer not null default 1868;

alter table public.personal_bests
  add column if not exists nft_chain_id integer;

-- 2. Drop any single-column UNIQUE constraint on token_id or tx_hash
--    (the original global uniques). Looked up by definition, not by name.
do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.conrelid = 'public.mints'::regclass
      and c.contype = 'u'
      and array_length(c.conkey, 1) = 1
      and a.attname in ('token_id', 'tx_hash')
  loop
    execute format('alter table public.mints drop constraint %I', r.conname);
  end loop;
end $$;

-- 3. Add the per-chain uniques unless an equivalent unique constraint or
--    unique index already exists (matched by column set, not by name).
do $$
begin
  if not exists (
    select 1
    from pg_index ix
    where ix.indrelid = 'public.mints'::regclass
      and ix.indisunique
      and array(
            select a.attname::text
            from unnest(ix.indkey::int2[]) as k(attnum)
            join pg_attribute a
              on a.attrelid = ix.indrelid and a.attnum = k.attnum
            order by 1
          ) = array['chain_id', 'token_id']
  ) then
    alter table public.mints
      add constraint mints_chain_id_token_id_key unique (chain_id, token_id);
  end if;

  if not exists (
    select 1
    from pg_index ix
    where ix.indrelid = 'public.mints'::regclass
      and ix.indisunique
      and array(
            select a.attname::text
            from unnest(ix.indkey::int2[]) as k(attnum)
            join pg_attribute a
              on a.attrelid = ix.indrelid and a.attnum = k.attnum
            order by 1
          ) = array['chain_id', 'tx_hash']
  ) then
    alter table public.mints
      add constraint mints_chain_id_tx_hash_key unique (chain_id, tx_hash);
  end if;
end $$;

-- 4. The fid-keyed weekly view predates the wallet model; drop it.
drop view if exists public.weekly_leaderboard;

-- 5. scores: wallet identity + per-wallet replay protection.
alter table public.scores add column if not exists wallet_address text;
alter table public.scores add column if not exists client_nonce text;
create unique index if not exists scores_addr_nonce_idx
  on public.scores (wallet_address, client_nonce);

-- 6. personal_bests: one row per wallet (the trigger upserts ON CONFLICT
--    (wallet_address), which needs a unique constraint on it).
alter table public.personal_bests add column if not exists wallet_address text;
do $$
begin
  if not exists (
    select 1
    from pg_index ix
    join pg_attribute a
      on a.attrelid = ix.indrelid and a.attnum = ix.indkey[0]
    where ix.indrelid = 'public.personal_bests'::regclass
      and ix.indisunique
      and ix.indnatts = 1
      and a.attname = 'wallet_address'
  ) then
    alter table public.personal_bests
      add constraint personal_bests_wallet_address_key unique (wallet_address);
  end if;
end $$;

-- 7. personal_bests.fid was the PRIMARY KEY in the original schema. A PK
--    column can't be nullable, so drop that PK if it is still on fid.
do $$
declare
  pk name;
begin
  select c.conname into pk
  from pg_constraint c
  join pg_attribute a
    on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
  where c.conrelid = 'public.personal_bests'::regclass
    and c.contype = 'p'
    and a.attname = 'fid';
  if pk is not null then
    execute format('alter table public.personal_bests drop constraint %I', pk);
  end if;
end $$;

-- 8. fid is optional under the wallet model (address-only SIWE players).
do $$
declare
  t text;
begin
  foreach t in array array['scores', 'personal_bests', 'mints'] loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t
        and column_name = 'fid' and is_nullable = 'NO'
    ) then
      execute format('alter table public.%I alter column fid drop not null', t);
    end if;
  end loop;
end $$;

-- 9. Live score-only trigger function (pulled from production). Keyed by
--    wallet_address; never touches nft_*.
create or replace function public.update_personal_best()
 returns trigger language plpgsql set search_path to 'public', 'pg_catalog' as $$
begin
  insert into public.personal_bests (wallet_address, fid, score, score_id, updated_at)
  values (new.wallet_address, new.fid, new.score, new.id, now())
  on conflict (wallet_address) do update
    set score = excluded.score, score_id = excluded.score_id,
        fid = excluded.fid, updated_at = excluded.updated_at
    where excluded.score > public.personal_bests.score;
  return new;
end; $$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.scores'::regclass
      and tgname = 'scores_update_pb'
      and not tgisinternal
  ) then
    create trigger scores_update_pb
      after insert on public.scores
      for each row execute function public.update_personal_best();
  end if;
end $$;
