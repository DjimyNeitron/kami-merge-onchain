// ceremonySound — audio cues for the MintCeremony.
//
// Stage 3.5 design-alignment: the original PR #36 version synthesised
// raw oscillator tones. This version reuses the game's existing
// marimba samples (public/sfx/merge_1…5.mp3 — pre-tuned C5 D5 E5 G5
// A5) through the shared `audioManager` singleton so the ceremony
// sounds like the same instrument the player hears on every merge.
//
// Sample index map (matches AudioManager.mergeBuffers order):
//   0 = C5   1 = D5   2 = E5   3 = G5   4 = A5
//
// The caller (MintCeremony) gates these on its soundEnabled flag —
// these functions just play when called. AudioManager.playSampleAt
// lazily unlocks the context, so no explicit unlock plumbing here.

import { audioManager } from "@/game/audio";
import { type Tier } from "@/config/yokai";

/**
 * Spinning tick — the lowest marimba note (C5), quiet. Fired once per
 * tier change while the slot drum spins.
 */
export function playTick(): void {
  audioManager.playSampleAt(0, { volume: 0.15 });
}

// Tier chord — note count scales with rarity, so the ear hears how
// rare the result is. Common = a 2-note interval, Legendary = the
// full 5-note pentatonic stack. Indices reference the C5–A5 buffers.
const CHIME_SEQUENCES: Record<Tier, number[]> = {
  common: [2, 4], // E5 A5
  rare: [2, 3, 4], // E5 G5 A5
  epic: [0, 2, 3, 4], // C5 E5 G5 A5
  legendary: [0, 1, 2, 3, 4], // C5 D5 E5 G5 A5 — full
};

/**
 * Final-stop chime — fired the moment the spin lands. Notes stagger
 * 80 ms apart into a rising marimba figure; richer = rarer tier.
 */
export function playChime(tier: Tier): void {
  CHIME_SEQUENCES[tier].forEach((index, i) => {
    window.setTimeout(
      () => audioManager.playSampleAt(index, { volume: 0.5 }),
      i * 80
    );
  });
}

/**
 * Mint-success cascade — fired when the mock mint completes. An
 * ascending C5-E5-G5-A5 marimba run.
 */
export function playMintSuccess(): void {
  [0, 2, 3, 4].forEach((index, i) => {
    window.setTimeout(
      () => audioManager.playSampleAt(index, { volume: 0.4 }),
      i * 100
    );
  });
}
