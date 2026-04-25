// Registry of background-music tracks + persistence helpers.
//
// Why a separate module: AudioManager owns playback mechanics (HTMLAudio
// element, fade scheduling), and the engine + GameCanvas + Settings
// all need to agree on the catalogue of available tracks and the
// localStorage key/shape. Keeping the registry here means
//   - one source of truth for track ids, display names, and src urls
//   - storage validation in a single place (no copy-paste of "is this
//     id one of the known ones?" between the engine init path and the
//     Settings selector)
//   - the AudioManager API stays narrow (`setBgmTrack(id)` / `getBgmTrack()`)
//     while UI code can still iterate `BGM_TRACKS` for the picker.

export type BgmTrackId =
  | "bamboo_mist_drift"
  | "incense_drift"
  | "temple_rain"
  | "moonlit_sakura";

export type BgmTrack = {
  id: BgmTrackId;
  name: string;
  src: string;
};

export const BGM_TRACKS: readonly BgmTrack[] = [
  {
    id: "bamboo_mist_drift",
    name: "Bamboo Mist Drift",
    src: "/audio/bgm/bamboo_mist_drift.mp3",
  },
  {
    id: "incense_drift",
    name: "Incense Drift",
    src: "/audio/bgm/incense_drift.mp3",
  },
  {
    id: "temple_rain",
    name: "Temple Rain",
    src: "/audio/bgm/temple_rain.mp3",
  },
  {
    id: "moonlit_sakura",
    name: "Moonlit Sakura",
    src: "/audio/bgm/moonlit_sakura.mp3",
  },
] as const;

const VALID_IDS: ReadonlySet<BgmTrackId> = new Set(BGM_TRACKS.map((t) => t.id));

const STORAGE_KEY = "kami_bgm_track";

/**
 * Read the user's last-selected track from localStorage. Returns
 * `null` (not a track id) when:
 *   - we're on the server (no `window`),
 *   - storage is unavailable (private mode, quota),
 *   - nothing was ever stored,
 *   - the stored value isn't a recognised id (corrupted or stale).
 *
 * Callers are expected to fall back to `pickRandomTrack()` on null.
 */
export function loadStoredTrack(): BgmTrackId | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return VALID_IDS.has(raw as BgmTrackId) ? (raw as BgmTrackId) : null;
  } catch {
    return null;
  }
}

export function saveTrack(id: BgmTrackId): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // quota / privacy mode — silent, pick is still honoured in-memory
  }
}

/**
 * Uniform pick across all tracks. Used on a fresh visit (no stored
 * track) and as a fallback when storage holds an unrecognised id.
 */
export function pickRandomTrack(): BgmTrackId {
  const idx = Math.floor(Math.random() * BGM_TRACKS.length);
  return BGM_TRACKS[idx].id;
}

/** Lookup helper — returns `undefined` for unknown ids. */
export function getBgmTrack(id: BgmTrackId): BgmTrack | undefined {
  return BGM_TRACKS.find((t) => t.id === id);
}
