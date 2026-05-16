// tierFromScore — derives an NFT tier from a run's final score using
// the Brief v13 locked drop matrix.
//
// The matrix is a gacha-style weighted distribution: higher scores
// shift probability mass toward the rarer tiers without ever fully
// guaranteeing them. A 5000+ run is overwhelmingly likely to be
// Legendary (55%) but can still land Common (1%) — the small tail
// keeps every reveal genuinely uncertain, which is the whole point
// of the spinning ceremony.
//
// Scores below 500 are not mint-eligible — the function returns null
// and the caller must not open the ceremony at all.
//
// Determinism: pass a `seed` string for a reproducible result (used
// by tests + the dev route's tier-override-off mode so a given
// yokai+score always lands the same tier on replay). Without a seed,
// Math.random() drives a fresh roll each call.

import { TIER_ORDER, type Tier } from "@/config/yokai";

// Brief v13 locked drop matrix. Each row sums to 100. Keyed by the
// lower bound of the score bracket for readability; bracketFor()
// does the actual range mapping.
const DROP_MATRIX: Record<string, Record<Tier, number>> = {
  "500-1499": { common: 50, rare: 37, epic: 11, legendary: 2 },
  "1500-2999": { common: 22, rare: 48, epic: 25, legendary: 5 },
  "3000-4999": { common: 5, rare: 25, epic: 50, legendary: 20 },
  "5000+": { common: 1, rare: 9, epic: 35, legendary: 55 },
};

/** Minimum score for an NFT drop. Below this, no ceremony. */
export const MIN_MINT_SCORE = 500;

function bracketFor(score: number): Record<Tier, number> {
  if (score >= 5000) return DROP_MATRIX["5000+"];
  if (score >= 3000) return DROP_MATRIX["3000-4999"];
  if (score >= 1500) return DROP_MATRIX["1500-2999"];
  return DROP_MATRIX["500-1499"];
}

// FNV-1a-style string hash → float in [0, 1). Deterministic: the same
// seed string always maps to the same float. Math.imul keeps the
// multiply in 32-bit space; `>>> 0` coerces to unsigned before the
// modulo so the result is always non-negative.
function hashToUnit(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1_000_000) / 1_000_000;
}

/**
 * Derive a tier from a run score.
 *
 * @param score Final run score.
 * @param seed  Optional — when provided, the roll is deterministic
 *              (same seed → same tier). Without it, Math.random().
 * @returns The drawn Tier, or null when score < MIN_MINT_SCORE.
 */
export function tierFromScore(score: number, seed?: string): Tier | null {
  if (score < MIN_MINT_SCORE) return null;

  const weights = bracketFor(score);
  // roll ∈ [0, 100): a position on the cumulative weight line.
  const roll = (seed !== undefined ? hashToUnit(seed) : Math.random()) * 100;

  let cumulative = 0;
  for (const tier of TIER_ORDER) {
    cumulative += weights[tier];
    if (roll < cumulative) return tier;
  }
  // Floating-point safety net — roll can only reach here if it
  // rounded up to exactly 100. The last tier owns that edge.
  return TIER_ORDER[TIER_ORDER.length - 1];
}
