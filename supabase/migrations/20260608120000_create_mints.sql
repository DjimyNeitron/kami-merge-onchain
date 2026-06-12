-- Mint-economy-v2: a `mints` table.
--
-- "Mint every qualifying run" means many NFTs per player, which the single
-- personal_bests.nft_token_id slot can't hold. This table records every
-- recorded mint (one row per on-chain token). confirm-mint v2 inserts here;
-- personal_bests keeps its nft_token_id/nft_minted_at as the shrine display
-- of the PB run's NFT only (backwards-compatible).
--
-- NOT auto-applied — applied via MCP after review.

create table public.mints (
  id uuid primary key default gen_random_uuid(),
  fid bigint not null references public.users(fid),
  score_id uuid not null references public.scores(id),
  token_id bigint not null unique,
  type_id smallint not null check (type_id between 0 and 43),
  tx_hash text not null unique,
  minter_address text not null,
  minted_at timestamptz not null default now()
);

alter table public.mints enable row level security;

create policy "mints are publicly readable"
  on public.mints for select using (true);

create index mints_fid_idx on public.mints(fid);
