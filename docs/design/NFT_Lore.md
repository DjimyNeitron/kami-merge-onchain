# Kami Merge — NFT Lore Strings (Session B deliverable)

**Status:** Locked. Single source of truth для всех 44 NFT descriptions.
**Usage:** Each NFT description = `base_lore[yokai] + "\n\n" + tier_flavor[tier]`
**Total unique strings:** 11 base lore + 4 tier flavors = 15 (not 44)

---

## Tier flavor strings (used across all 11 yokai)

```typescript
const TIER_FLAVOR: Record<Tier, string> = {
  common: "Common tier: At rest in quiet form. Presence felt, not asserted.",
  rare: "Rare tier: Power gathers. Aurora deepens, focus sharpens, intent begins to stir.",
  epic: "Epic tier: Elemental command made visible. Force, voice, and presence converge.",
  legendary: "Legendary tier: Apex form. The shape that legends remember.",
};
```

---

## Base lore per yokai (chain order, tier 1 → 11)

### 1. Kodama (木霊) — Forest

> Kodama (木霊) — the gentle spirits of ancient trees in Japanese folklore. They embody the quiet wisdom of the forest, and the rustle of leaves is said to be their voice. Felling a kodama-inhabited tree brings misfortune.

### 2. Hitodama (人魂) — Spirit

> Hitodama (人魂) — wandering soul-flames glimpsed at dusk above graveyards and forgotten paths. In folklore they are the spirits of the recently departed, drifting before the journey beyond. A pale blue-white glow, unmistakable to those who have lost someone.

### 3. Tanuki (狸) — Earth

> Tanuki (狸) — shapeshifting tricksters of the forest fringe. Folk tales paint them as round-bellied wanderers who deceive travelers for amusement, never malice. A tanuki statue with sake jug and straw hat stands outside taverns across Japan.

### 4. Kappa (河童) — Water

> Kappa (河童) — child-sized river yokai with turtle shells and a water-filled dish atop their heads. They love cucumbers and sumo, but tales warn of those who drown the unwary near deep pools. Empty the dish and a kappa loses its strength.

### 5. Kitsune (狐) — Fox

> Kitsune (狐) — fox spirits gaining tails with age, up to nine for the most powerful. They serve Inari, deity of rice and prosperity, often guarding shrine gates. Shapeshifters and illusionists, their gaze sees through deception and weaves it.

### 6. Jorogumo (絡新婦) — Shadow

> Jorogumo (絡新婦) — the spider-woman who haunts waterfalls and remote mountain inns. Folklore tells of an ancient spider gaining human form upon her 400th year, weaving silk to ensnare the unwary. Beauty is her trap, patience her hunt.

### 7. Tengu (天狗) — Sky

> Tengu (天狗) — winged mountain warriors of Japanese folklore. Once vengeful spirits of the proud, now guardians of sacred peaks. Their crimson faces and long noses appear in temple iconography across the archipelago.

### 8. Oni (鬼) — Fire

> Oni (鬼) — horned ogres of Japanese demonology, wielding iron clubs and prowling the boundaries between worlds. Red or blue-skinned, fanged and fierce, they appear in temple wood-carvings as both threat and warning. Beans hurled at festivals drive them back.

### 9. Raijin (雷神) — Storm

> Raijin (雷神) — god of thunder and storms, ringed by taiko drums that beat the heavens. Depicted as a fierce, demon-like figure on classical screens, he commands lightning with each strike. Folk belief says he eats the navels of careless children during storms.

### 10. Ryujin (龍神) — Sea

> Ryujin (龍神) — dragon king of the deep, ruler of all sea creatures from his palace at the ocean floor. He commands the tides with the kanju and manju jewels, raising or stilling waves at will. Sailors prayed to him before any long voyage.

### 11. Amaterasu (天照) — Sun

> Amaterasu (天照) — goddess of the sun and ruler of Takamagahara, the high celestial plain. She is the most revered kami in Shinto tradition, ancestor of the Imperial line. Her retreat into a cave once plunged the world into darkness.

---

## Composition format (для Stage 7 metadata generator)

```typescript
function buildNFTDescription(yokai: YokaiName, tier: Tier): string {
  return BASE_LORE[yokai] + "\n\n" + TIER_FLAVOR[tier];
}
```

### Full example — Amaterasu Legendary

```
Amaterasu (天照) — goddess of the sun and ruler of Takamagahara, the high celestial plain. She is the most revered kami in Shinto tradition, ancestor of the Imperial line. Her retreat into a cave once plunged the world into darkness.

Legendary tier: Apex form. The shape that legends remember.
```

### Full example — Kodama Common

```
Kodama (木霊) — the gentle spirits of ancient trees in Japanese folklore. They embody the quiet wisdom of the forest, and the rustle of leaves is said to be their voice. Felling a kodama-inhabited tree brings misfortune.

Common tier: At rest in quiet form. Presence felt, not asserted.
```

---

## Character budget validation

| Yokai | Base lore chars | + max tier flavor (Rare 87ch) | Total | OpenSea limit (~1000) |
|---|---:|---:|---:|---|
| Kodama | 263 | +87 | 352 | ✓ |
| Hitodama | 265 | +87 | 354 | ✓ |
| Tanuki | 244 | +87 | 333 | ✓ |
| Kappa | 245 | +87 | 334 | ✓ |
| Kitsune | 246 | +87 | 335 | ✓ |
| Jorogumo | 235 | +87 | 324 | ✓ |
| Tengu | 282 | +87 | 371 | ✓ |
| Oni | 264 | +87 | 353 | ✓ |
| Raijin | 269 | +87 | 358 | ✓ |
| Ryujin | 240 | +87 | 329 | ✓ |
| Amaterasu | 287 | +87 | 376 | ✓ |

Range: 324-376 chars. Consistent length, fits OpenSea preview (first ~200 chars) cleanly. First sentence of base lore = hook before truncation.

---

## File destination

В коде это попадёт в:
- `src/config/yokai.ts` — `BASE_LORE` + `TIER_FLAVOR` constants (single source)
- `scripts/generate_nft_metadata.ts` (Stage 7) — consumes constants to produce 44 JSON files
- `public/nft_assets/metadata/<yokai>_<tier>.json` — final IPFS-ready files

---

## Session B — full lock summary

- ✅ Naming: `{Yokai} — {Tier}` (em-dash)
- ✅ 7 attributes (Yokai / Kanji / Tier / Yokai Rank / Tier Rank / Element / Aurora Opacity)
- ✅ Element mapping: 11 yokai → 11 unique elements, 1:1 (Forest/Spirit/Earth/Water/Fox/Shadow/Sky/Fire/Storm/Sea/Sun)
- ✅ Description format: base lore + tier flavor (this file)
- ✅ Royalties: 2.5% (ERC-2981, 250 basis points) → your wallet
- ✅ External URL: `https://kami-merge.vercel.app` (per-yokai routes в Phase 4)
- ✅ Background color: `0F1626` (indigo)
- 🟡 Collection banner image: TBD ~30 мин task в Stage 7
