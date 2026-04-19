// Seasonal decoration system.
//
// DEACTIVATED: the auto-cycle, tint overlay, and season badge were removed.
// The module is locked to a single STATIC_SEASON (HARU) — consumers still
// call getCurrentSeason() / subscribe() as before, but no timer fires and
// no cycleSeason() mutation happens. MapleLeaf + Snowflake particle classes
// remain in particles.ts but are never spawned because primaryParticle
// stays "sakura".
//
// To re-enable cycling: set STATIC_SEASON = null and restore the original
// setInterval logic in subscribe() (see commit history for the prior body).

export enum Season {
  HARU = "haru", // spring
  NATSU = "natsu", // summer
  AKI = "aki", // autumn
  FUYU = "fuyu", // winter
}

export type ParticleKind = "sakura" | "firefly" | "maple_leaf" | "snowflake";

export type SeasonConfig = {
  primaryParticle: ParticleKind;
  tintColor: string;
  tintOpacity: number;
  fireflyMultiplier: number;
};

export const SEASON_CONFIG: Record<Season, SeasonConfig> = {
  [Season.HARU]: {
    primaryParticle: "sakura",
    tintColor: "#ffb3d9",
    tintOpacity: 0.08,
    // Bumped from 0.5 → 2.0 so fireflies read as a full ambient layer now
    // that HARU is the only active season. At base rate 0.3/s × 2.0 with
    // 15-30s lifetime this settles around 13-17 fireflies on screen.
    fireflyMultiplier: 2.0,
  },
  [Season.NATSU]: {
    primaryParticle: "firefly",
    tintColor: "#b3d9c4",
    tintOpacity: 0.06,
    fireflyMultiplier: 1.8,
  },
  [Season.AKI]: {
    primaryParticle: "maple_leaf",
    tintColor: "#ffb366",
    tintOpacity: 0.1,
    fireflyMultiplier: 0.5,
  },
  [Season.FUYU]: {
    primaryParticle: "snowflake",
    tintColor: "#cce6ff",
    tintOpacity: 0.12,
    fireflyMultiplier: 0.3,
  },
};

export const CYCLE_DURATION_SEC = 90;
export const TINT_FADE_MS = 3000;
export const MAX_PARTICLES = 60;

// Permanent season — used as a single source of truth for all consumers.
const STATIC_SEASON: Season = Season.HARU;

const currentSeason: Season = STATIC_SEASON;
const listeners = new Set<(s: Season) => void>();

export function getCurrentSeason(): Season {
  return currentSeason;
}

/** No-op: cycling is disabled. Kept as a named export for API stability. */
export function cycleSeason(): void {
  /* deactivated */
}

/**
 * Subscribe to season changes. The API is preserved for existing consumers,
 * but no timer is started and no subsequent callbacks are ever fired —
 * the season never changes. Consumers should also call getCurrentSeason()
 * for their initial value.
 */
export function subscribe(cb: (s: Season) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
