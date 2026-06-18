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

// Drop matrix (rarity scales with score). Each row sums to 100. Keyed by
// the lower bound of the score bracket for readability; bracketFor() does
// the actual range mapping. Higher score → meaningfully better odds, but
// Legendary is never guaranteed — the small tail keeps every reveal
// genuinely uncertain (per the locked design spirit).
//
// Recalibrated to the achievable score range: live data (13 runs / 3
// wallets) clustered 1000–2650 (median ~1963, p90 ~2483), so the old
// 3500–4999 / 5000+ brackets were never reached and Epic/Legendary leaked
// out of the low brackets. The brackets below re-fit the gradient to that
// range so Epic/Legendary require genuinely high scores. PROVISIONAL — fit
// to a small sample; pure data, fully reversible as more scores accumulate.
//
// Exported so the Help overlay's rarity table renders from this single
// source (no copied-in values) — keep the keys range-formatted as below.
export const DROP_MATRIX: Record<string, Record<Tier, number>> = {
  "1000-1799": { common: 68, rare: 30, epic: 2, legendary: 0 },
  "1800-2399": { common: 42, rare: 44, epic: 13, legendary: 1 },
  "2400-2999": { common: 22, rare: 45, epic: 28, legendary: 5 },
  "3000+": { common: 8, rare: 32, epic: 45, legendary: 15 },
};

/** Minimum score for an NFT drop. Below this, no ceremony. */
export const MIN_MINT_SCORE = 1000;

function bracketFor(score: number): Record<Tier, number> {
  if (score >= 3000) return DROP_MATRIX["3000+"];
  if (score >= 2400) return DROP_MATRIX["2400-2999"];
  if (score >= 1800) return DROP_MATRIX["1800-2399"];
  return DROP_MATRIX["1000-1799"];
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
