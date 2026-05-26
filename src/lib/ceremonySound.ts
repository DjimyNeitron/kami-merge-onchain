// ceremonySound — audio cues for the MintCeremony.
//
// Stage 3.5h: switched from the pitch-shifted marimba SAMPLES to
// synthesized SINGING BOWL tones (audioManager.playBowlTone — sine +
// inharmonic overtones + lowpass + slow attack + long decay + reverb).
// Marimba, however softened, still read as a struck-wood transient; the
// bowl synthesis gives the authentically gentle, sustained, meditative
// character the ceremony wants. The game's in-game merge SFX are
// untouched — they keep the marimba samples via a separate path.
//
// The caller (MintCeremony) gates these on its soundEnabled flag.

import { audioManager } from "@/game/audio";
import { type Tier } from "@/config/yokai";

// Low-register pentatonic, in Hz. Deep enough to feel like temple bowls
// while staying musical (E3–D4).
const BOWL = {
  E3: 164.81,
  G3: 196.0,
  A3: 220.0,
  B3: 246.94,
  D4: 293.66,
} as const;

/**
 * Spinning tick — a whisper-soft, short bowl tap per tier change while
 * the slot drum spins. Faster attack than the chime so it still reads
 * as a "tick", but rounded, not clicky.
 */
export function playTick(): void {
  audioManager.playBowlTone({
    frequency: BOWL.A3,
    duration: 1.5,
    volume: 0.035,
    attack: 0.05,
    useReverb: true,
  });
}

// Tier chord — note count scales with rarity, ascending the pentatonic.
const CHIME_SEQUENCES: Record<Tier, number[]> = {
  common: [BOWL.A3, BOWL.D4],
  rare: [BOWL.G3, BOWL.A3, BOWL.D4],
  epic: [BOWL.E3, BOWL.G3, BOWL.A3, BOWL.D4],
  legendary: [BOWL.E3, BOWL.G3, BOWL.A3, BOWL.B3, BOWL.D4],
};

/**
 * Final-stop chime — fired the moment the spin lands. Slow-attack bowls
 * 450 ms apart, each ringing for 5 s, richer = rarer tier.
 */
export function playChime(tier: Tier): void {
  CHIME_SEQUENCES[tier].forEach((frequency, i) => {
    window.setTimeout(
      () =>
        audioManager.playBowlTone({
          frequency,
          duration: 5.0,
          volume: 0.12,
          attack: 0.5,
          useReverb: true,
        }),
      i * 450
    );
  });
}

/**
 * Mint-success cascade — fired when the mock mint completes. A slow
 * ascending bowl arpeggio, the final note ringing out for 6 s.
 */
export function playMintSuccess(): void {
  [BOWL.E3, BOWL.G3, BOWL.A3, BOWL.D4].forEach((frequency, i) => {
    window.setTimeout(
      () =>
        audioManager.playBowlTone({
          frequency,
          duration: 6.0,
          volume: 0.13,
          attack: 0.6,
          useReverb: true,
        }),
      i * 550
    );
  });
}
