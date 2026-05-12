export interface YokaiType {
  id: number;
  name: string;
  kanji: string;
  radius: number;
  color: string;
  score: number;
  sprite: string;
  description: string;
}

// Merge chain: 11 levels, smallest to largest
// Radii are sized to match the sprite silhouette so visual and physical
// collision line up — no more "balls that look touching but don't merge".
export const YOKAI_CHAIN: YokaiType[] = [
  {
    id: 1,
    name: "Kodama",
    kanji: "木霊",
    radius: 20,
    color: "#7ec87e",
    score: 1,
    sprite: "/yokai/kodama.png",
    description:
      "Spirits of ancient trees, born from forests that have stood for centuries. Their silent presence is a blessing — woodcutters leave the oldest trees untouched for a reason.",
  },
  {
    id: 2,
    name: "Hitodama",
    kanji: "人魂",
    radius: 28,
    color: "#7ecae8",
    score: 3,
    sprite: "/yokai/hitodama.png",
    description:
      "Wandering souls drifting between worlds, pale and weightless. They mean no harm — most are simply lost, looking for the way home.",
  },
  {
    id: 3,
    name: "Tanuki",
    kanji: "狸",
    radius: 37,
    color: "#c49a6c",
    score: 6,
    sprite: "/yokai/tanuki.png",
    description:
      "Shapeshifters and tricksters, famous for round bellies and a love of sake. Mischief is their nature, but their hearts are kind.",
  },
  {
    id: 4,
    name: "Kappa",
    kanji: "河童",
    radius: 44,
    color: "#3a9e6e",
    score: 10,
    sprite: "/yokai/kappa.png",
    description:
      "River imps who carry a dish of sacred water on their heads. Bow to them politely and they'll bow back — it's just good manners.",
  },
  {
    id: 5,
    name: "Kitsune",
    kanji: "狐",
    radius: 55,
    color: "#f0a030",
    score: 15,
    sprite: "/yokai/kitsune.png",
    description:
      "Fox spirits, messengers of Inari, the rice deity. The more tails they grow, the older and wiser they become — up to nine.",
  },
  {
    id: 6,
    name: "Jorogumo",
    kanji: "絡新婦",
    radius: 64,
    color: "#9b59b6",
    score: 21,
    sprite: "/yokai/jorogumo.png",
    description:
      "The 'binding bride,' weaver of silken threads. Feared in the old tales — though in truth, she spends most of her time knitting webs no one ever gets stuck in.",
  },
  {
    id: 7,
    name: "Tengu",
    kanji: "天狗",
    radius: 76,
    color: "#e74c3c",
    score: 28,
    sprite: "/yokai/tengu.png",
    description:
      "Mountain spirits and masters of the sword. Proud guardians of sacred peaks — quick to anger, but fiercely loyal once you earn their respect.",
  },
  {
    id: 8,
    name: "Oni",
    kanji: "鬼",
    radius: 87,
    color: "#8b1a1a",
    score: 36,
    sprite: "/yokai/oni.png",
    description:
      "Horned demons of legend. Loud and fearsome in stories, though many spend their days guarding temple gates against things far worse than themselves.",
  },
  {
    id: 9,
    name: "Raijin",
    kanji: "雷神",
    radius: 101,
    color: "#f1c40f",
    score: 45,
    sprite: "/yokai/raijin.png",
    description:
      "The thunder god, whose drumbeats shake the heavens. Where he passes, storms follow.",
  },
  {
    id: 10,
    name: "Ryujin",
    kanji: "龍神",
    radius: 117,
    color: "#5b8dcc",
    score: 55,
    sprite: "/yokai/ryujin.png",
    description:
      "The dragon god of the sea, ruler of tides from his coral palace. He commands the rain and the waves alike.",
  },
  {
    id: 11,
    name: "Amaterasu",
    kanji: "天照",
    radius: 138,
    color: "#ffefd5",
    score: 66,
    sprite: "/yokai/amaterasu.png",
    description:
      "The sun goddess herself, from whom all light flows. When she hides, the world falls dark — when she returns, morning comes.",
  },
];

// Only the first 5 yokai can spawn (like Suika)
export const SPAWNABLE_IDS = [1, 2, 3, 4, 5];

export function getYokai(id: number): YokaiType | undefined {
  return YOKAI_CHAIN.find((y) => y.id === id);
}

export function getNextYokai(id: number): YokaiType | undefined {
  return YOKAI_CHAIN.find((y) => y.id === id + 1);
}

export function getRandomSpawnable(): YokaiType {
  const idx = Math.floor(Math.random() * SPAWNABLE_IDS.length);
  return YOKAI_CHAIN[SPAWNABLE_IDS[idx] - 1];
}

// ─────────────────────────────────────────────────────────────────────────────
// NFT card metadata (Stage 3.3+)
//
// The merge-chain `YOKAI_CHAIN` above is the source of truth for in-game
// physics: it ships capitalised display names, per-yokai descriptions used by
// pre-NFT modals, and the round-ball sprite paths. The constants below
// supplement that with the NFT-side data: lowercase yokai keys (which match
// the asset filename convention `{yokai}_{tier}.png` produced by
// `scripts/stage2_render.py`), tier-flavored description fragments, the
// element taxonomy locked in Brief v13 Session B, and the per-tier aurora
// opacity scaling.
//
// Existing constants and YokaiType interface above are intentionally left
// untouched — they're consumed by GameCanvas / engine / SplashScreen and
// changing them would require a wider refactor outside Stage 3.3 scope.
// ─────────────────────────────────────────────────────────────────────────────

export type Tier = "common" | "rare" | "epic" | "legendary";

export type YokaiName =
  | "kodama"
  | "hitodama"
  | "tanuki"
  | "kappa"
  | "kitsune"
  | "jorogumo"
  | "tengu"
  | "oni"
  | "raijin"
  | "ryujin"
  | "amaterasu";

// Canonical chain order (tier 1 → 11). Mirrors `YOKAI_CHAIN[*].id - 1`
// indexing but exposed as a lowercase-keyed array for NFT consumers that
// don't care about physics metadata.
export const YOKAI_ORDER: YokaiName[] = [
  "kodama",
  "hitodama",
  "tanuki",
  "kappa",
  "kitsune",
  "jorogumo",
  "tengu",
  "oni",
  "raijin",
  "ryujin",
  "amaterasu",
];

// Rarity ramp, ascending. Used for filename composition and the demo
// page's column ordering.
export const TIER_ORDER: Tier[] = ["common", "rare", "epic", "legendary"];

// Lowercase-keyed kanji map. Duplicates `YOKAI_CHAIN[*].kanji` but with a
// schema NFT-side code prefers (the merge chain entries also embed physics
// fields that NFT card consumers don't need).
export const KANJI: Record<YokaiName, string> = {
  kodama: "木霊",
  hitodama: "人魂",
  tanuki: "狸",
  kappa: "河童",
  kitsune: "狐",
  jorogumo: "絡新婦",
  tengu: "天狗",
  oni: "鬼",
  raijin: "雷神",
  ryujin: "龍神",
  amaterasu: "天照",
};

// 1:1 yokai → element mapping locked in Brief v13 Session B. Ships as
// the "Element" attribute in NFT metadata; also drives any element-keyed
// visual styling we add later (palette, particle tint, etc).
export const ELEMENT_MAP: Record<YokaiName, string> = {
  kodama: "Forest",
  hitodama: "Spirit",
  tanuki: "Earth",
  kappa: "Water",
  kitsune: "Fox",
  jorogumo: "Shadow",
  tengu: "Sky",
  oni: "Fire",
  raijin: "Storm",
  ryujin: "Sea",
  amaterasu: "Sun",
};

// Per-tier aurora-layer opacity. Scaled so Common reads as a calm
// background shimmer and Legendary as a saturated halo. NFT metadata
// also exposes this as the "Aurora Opacity" attribute so secondary
// markets can read the tier without parsing the image.
export const AURORA_OPACITY: Record<Tier, number> = {
  common: 0.45,
  rare: 0.6,
  epic: 0.75,
  legendary: 0.9,
};

// Base lore — kept verbatim from `docs/design/NFT_Lore.md` (Session B
// deliverable). Each NFT's full description is composed as
// `BASE_LORE[yokai] + "\n\n" + TIER_FLAVOR[tier]`, giving 11 + 4 = 15
// unique strings rather than 44 hand-written ones.
export const BASE_LORE: Record<YokaiName, string> = {
  kodama:
    "Kodama (木霊) — the gentle spirits of ancient trees in Japanese folklore. They embody the quiet wisdom of the forest, and the rustle of leaves is said to be their voice. Felling a kodama-inhabited tree brings misfortune.",
  hitodama:
    "Hitodama (人魂) — wandering soul-flames glimpsed at dusk above graveyards and forgotten paths. In folklore they are the spirits of the recently departed, drifting before the journey beyond. A pale blue-white glow, unmistakable to those who have lost someone.",
  tanuki:
    "Tanuki (狸) — shapeshifting tricksters of the forest fringe. Folk tales paint them as round-bellied wanderers who deceive travelers for amusement, never malice. A tanuki statue with sake jug and straw hat stands outside taverns across Japan.",
  kappa:
    "Kappa (河童) — child-sized river yokai with turtle shells and a water-filled dish atop their heads. They love cucumbers and sumo, but tales warn of those who drown the unwary near deep pools. Empty the dish and a kappa loses its strength.",
  kitsune:
    "Kitsune (狐) — fox spirits gaining tails with age, up to nine for the most powerful. They serve Inari, deity of rice and prosperity, often guarding shrine gates. Shapeshifters and illusionists, their gaze sees through deception and weaves it.",
  jorogumo:
    "Jorogumo (絡新婦) — the spider-woman who haunts waterfalls and remote mountain inns. Folklore tells of an ancient spider gaining human form upon her 400th year, weaving silk to ensnare the unwary. Beauty is her trap, patience her hunt.",
  tengu:
    "Tengu (天狗) — winged mountain warriors of Japanese folklore. Once vengeful spirits of the proud, now guardians of sacred peaks. Their crimson faces and long noses appear in temple iconography across the archipelago.",
  oni: "Oni (鬼) — horned ogres of Japanese demonology, wielding iron clubs and prowling the boundaries between worlds. Red or blue-skinned, fanged and fierce, they appear in temple wood-carvings as both threat and warning. Beans hurled at festivals drive them back.",
  raijin:
    "Raijin (雷神) — god of thunder and storms, ringed by taiko drums that beat the heavens. Depicted as a fierce, demon-like figure on classical screens, he commands lightning with each strike. Folk belief says he eats the navels of careless children during storms.",
  ryujin:
    "Ryujin (龍神) — dragon king of the deep, ruler of all sea creatures from his palace at the ocean floor. He commands the tides with the kanju and manju jewels, raising or stilling waves at will. Sailors prayed to him before any long voyage.",
  amaterasu:
    "Amaterasu (天照) — goddess of the sun and ruler of Takamagahara, the high celestial plain. She is the most revered kami in Shinto tradition, ancestor of the Imperial line. Her retreat into a cave once plunged the world into darkness.",
};

// Tier-flavor strings — appended to base lore to produce the 44 final
// descriptions. Per Brief v13 Session B and `NFT_Lore.md`.
export const TIER_FLAVOR: Record<Tier, string> = {
  common:
    "Common tier: At rest in quiet form. Presence felt, not asserted.",
  rare: "Rare tier: Power gathers. Aurora deepens, focus sharpens, intent begins to stir.",
  epic: "Epic tier: Elemental command made visible. Force, voice, and presence converge.",
  legendary:
    "Legendary tier: Apex form. The shape that legends remember.",
};

// Convenience composer — single source for downstream metadata generator
// (Stage 7) and any UI that wants to render the full description.
export function buildNFTDescription(yokai: YokaiName, tier: Tier): string {
  return `${BASE_LORE[yokai]}\n\n${TIER_FLAVOR[tier]}`;
}
