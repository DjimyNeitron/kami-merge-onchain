# NFT Metadata

44 ERC-721 metadata files for the Kami Merge collection. Served statically by Vercel from `public/nft_assets/metadata/`. Consumed by the Stage 7B contract's `tokenURI(typeId)`.

## File mapping

- `typeId = yokaiIndex × 4 + tier`
- `yokaiIndex` 0..10 in canonical order: kodama, hitodama, tanuki, kappa, kitsune, jorogumo, tengu, oni, raijin, ryujin, amaterasu
- `tier` 0..3 in order: common, rare, epic, legendary
- `0.json` = Kodama Common, `43.json` = Amaterasu Legendary

## Source of truth

`src/config/yokai.ts` exports `YOKAI_ORDER`, `TIER_ORDER`, `KANJI`, `ELEMENT_MAP`, `AURORA_OPACITY`, and `buildNFTDescription`. The generator script reads from there — no constants are duplicated. If you change yokai.ts, regenerate.

## Regenerate

```bash
npx tsx scripts/generate_nft_metadata.ts
```

Idempotent — overwrites all 44 files with byte-identical output unless yokai.ts changed.
