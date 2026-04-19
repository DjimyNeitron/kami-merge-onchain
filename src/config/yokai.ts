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
