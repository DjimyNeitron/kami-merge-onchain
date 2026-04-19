// Seasonal decoration system.
// The background image never changes — only overlay tint + seasonal particles
// swap. This module owns the current season, the 90s auto-cycle, and a
// pub/sub for components that need to react (tint, particle spawner, badge).

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
    fireflyMultiplier: 0.5,
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

const ORDER: Season[] = [Season.HARU, Season.NATSU, Season.AKI, Season.FUYU];

export const CYCLE_DURATION_SEC = 90;
export const TINT_FADE_MS = 3000;
export const MAX_PARTICLES = 60;

function realWorldSeason(): Season {
  // JS months are 0-indexed: 0=Jan, 1=Feb, 2=Mar, ...
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return Season.HARU; // Mar–May
  if (month >= 5 && month <= 7) return Season.NATSU; // Jun–Aug
  if (month >= 8 && month <= 10) return Season.AKI; // Sep–Nov
  return Season.FUYU; // Dec–Feb
}

let currentSeason: Season = realWorldSeason();
const listeners = new Set<(s: Season) => void>();
let timerId: ReturnType<typeof setInterval> | null = null;

export function getCurrentSeason(): Season {
  return currentSeason;
}

/** Advance to the next season in the HARU→NATSU→AKI→FUYU cycle. */
export function cycleSeason(): void {
  const idx = ORDER.indexOf(currentSeason);
  currentSeason = ORDER[(idx + 1) % ORDER.length];
  listeners.forEach((cb) => {
    try {
      cb(currentSeason);
    } catch (err) {
      console.error("[Seasons] listener error", err);
    }
  });
}

/**
 * Subscribe to season changes. Returns an unsubscribe function.
 * The auto-cycle timer is refcounted — it runs while any subscriber exists.
 */
export function subscribe(cb: (s: Season) => void): () => void {
  listeners.add(cb);
  if (timerId === null) {
    timerId = setInterval(cycleSeason, CYCLE_DURATION_SEC * 1000);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  };
}
