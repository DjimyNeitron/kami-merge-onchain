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

// Stage 3.5d — mellow pass. The marimba buffers are C5–A5; the ceremony
// plays them one octave DOWN (playbackRate 0.5 → C4–A4) with a gentle
// 15 ms attack so the reveal feels deep, soft, and meditative rather
// than bright and percussive. The game's in-game merge SFX use a
// separate playback path (AudioManager.playMergeWithCombo) and a
// separate AudioManager instance, so they keep their native C5–A5 pitch.
const CEREMONY_PITCH = 0.35; // ~G3 region — deepest while keeping clarity
const CEREMONY_ATTACK = 0.035; // 35 ms — softest attack yet

/**
 * Spinning tick — the lowest marimba note, pitched down, very quiet.
 * Fired once per tier change while the slot drum spins.
 */
export function playTick(): void {
  audioManager.playSampleAt(0, {
    volume: 0.035,
    pitch: CEREMONY_PITCH,
    attack: CEREMONY_ATTACK,
  });
}

// Tier chord — note count scales with rarity. Every sequence starts on
// C (grounded); legendary fills the pentatonic with no octave jumps.
// Indices reference the C5–A5 buffers (heard an octave down here).
const CHIME_SEQUENCES: Record<Tier, number[]> = {
  common: [0, 2], // C4 E4 — gentle 2-note
  rare: [0, 2, 3], // C4 E4 G4 — triad
  epic: [0, 2, 3, 4], // C4 E4 G4 A4
  legendary: [0, 1, 2, 3, 4], // C4 D4 E4 G4 A4 — full pentatonic
};

/**
 * Final-stop chime — fired the moment the spin lands. Notes stagger
 * 260 ms apart at volume 0.14 — deep, very calm bowl-chime feel.
 */
export function playChime(tier: Tier): void {
  CHIME_SEQUENCES[tier].forEach((index, i) => {
    window.setTimeout(
      () =>
        audioManager.playSampleAt(index, {
          volume: 0.14,
          pitch: CEREMONY_PITCH,
          attack: CEREMONY_ATTACK,
        }),
      i * 260
    );
  });
}

/**
 * Mint-success cascade — fired when the mock mint completes. A slow,
 * contemplative ascending run at 320 ms spacing, volume 0.12, with the
 * gentlest 40 ms attack.
 */
export function playMintSuccess(): void {
  [0, 2, 3, 4].forEach((index, i) => {
    window.setTimeout(
      () =>
        audioManager.playSampleAt(index, {
          volume: 0.12,
          pitch: CEREMONY_PITCH,
          attack: 0.04,
        }),
      i * 320
    );
  });
}
