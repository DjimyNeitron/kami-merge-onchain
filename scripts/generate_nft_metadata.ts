/**
 * generate_nft_metadata.ts — Stage 7B Task 1
 *
 * Emits 44 ERC-721 metadata JSON files to public/nft_assets/metadata/{typeId}.json
 * (typeId 0..43), one per yokai × tier. Vercel serves public/nft_assets/ as plain
 * static files (git-tracked), so the 7B contract's tokenURI(typeId) can point here.
 *
 * Single source of truth: src/config/yokai.ts. No constants are duplicated — the
 * yokai order, kanji, element taxonomy, aurora opacity, and the lore composer all
 * come from there. If yokai.ts changes, re-run this script and commit.
 *
 *   typeId = yokaiIndex * 4 + tierIndex
 *   yokaiIndex 0..10  (YOKAI_ORDER: kodama … amaterasu)
 *   tierIndex  0..3   (TIER_ORDER:  common, rare, epic, legendary)
 *   → 0.json = Kodama Common, 43.json = Amaterasu Legendary
 *
 * Idempotent: re-running produces byte-identical files.
 *
 * Run:  npx tsx scripts/generate_nft_metadata.ts
 */

import fs from "node:fs";
import path from "node:path";
import {
  YOKAI_ORDER,
  TIER_ORDER,
  KANJI,
  ELEMENT_MAP,
  AURORA_OPACITY,
  buildNFTDescription,
} from "../src/config/yokai";

const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "nft_assets", "metadata");
const BASE_URL = "https://kami-merge.vercel.app";

// YOKAI_ORDER / TIER_ORDER keys are lowercase (verified): used verbatim for the
// on-disk filenames, title-cased only for human-facing display values.
const tc = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

fs.mkdirSync(OUT_DIR, { recursive: true });

let written = 0;

YOKAI_ORDER.forEach((yokai, yi) => {
  TIER_ORDER.forEach((tier, ti) => {
    const typeId = yi * 4 + ti;
    const filename = `${yokai}_${tier}`; // lowercase → matches on-disk asset names

    const meta = {
      // em-dash U+2014, single-space padded
      name: `${tc(yokai)} — ${tc(tier)}`,
      description: buildNFTDescription(yokai, tier),
      image: `${BASE_URL}/nft_assets/static/${filename}.png`,
      animation_url: `${BASE_URL}/nft_assets/animated/${filename}.webp`,
      external_url: BASE_URL,
      background_color: "0F1626", // OpenSea convention: no '#'
      attributes: [
        { trait_type: "Yokai", value: tc(yokai) },
        { trait_type: "Kanji", value: KANJI[yokai] },
        { trait_type: "Tier", value: tc(tier) },
        { trait_type: "Element", value: ELEMENT_MAP[yokai] },
        {
          trait_type: "Yokai Rank",
          display_type: "number",
          value: yi + 1,
          max_value: 11,
        },
        {
          trait_type: "Tier Rank",
          display_type: "number",
          value: ti + 1,
          max_value: 4,
        },
        {
          trait_type: "Aurora Opacity",
          display_type: "number",
          value: AURORA_OPACITY[tier],
        },
      ],
    };

    fs.writeFileSync(
      path.join(OUT_DIR, `${typeId}.json`),
      JSON.stringify(meta, null, 2) + "\n",
      "utf-8",
    );
    written++;
  });
});

console.log(`Wrote ${written} metadata files to ${OUT_DIR}`);
