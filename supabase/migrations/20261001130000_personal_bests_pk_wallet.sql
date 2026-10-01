-- personal_bests: PRIMARY KEY (wallet_address), matching production.
--
-- 20261001120000 dropped the original PRIMARY KEY (fid) so fid could become
-- nullable, leaving only UNIQUE(wallet_address). Production's PK is
-- wallet_address. Guarded: a no-op wherever any PK already exists
-- (production); on a fresh database it adds the PK and drops the then-
-- redundant UNIQUE(wallet_address) added by 20261001120000.
-- (The PK makes wallet_address NOT NULL; every row the wallet-keyed
-- trigger writes has one.)
--
-- NOT auto-applied — applied via MCP after review.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.personal_bests'::regclass and contype = 'p'
  ) then
    alter table public.personal_bests
      add constraint personal_bests_pkey primary key (wallet_address);

    if exists (
      select 1 from pg_constraint
      where conrelid = 'public.personal_bests'::regclass
        and contype = 'u'
        and conname = 'personal_bests_wallet_address_key'
    ) then
      alter table public.personal_bests
        drop constraint personal_bests_wallet_address_key;
    end if;
  end if;
end $$;
