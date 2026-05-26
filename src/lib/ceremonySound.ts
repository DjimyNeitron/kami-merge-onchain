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

// Reveal = MELODY. Ascending sequential bowls, note count scaling with
// rarity — a "story" that arrives one tone at a time (discovery).
const CHIME_SEQUENCES: Record<Tier, number[]> = {
  common: [BOWL.A3, BOWL.D4],
  rare: [BOWL.G3, BOWL.A3, BOWL.D4],
  epic: [BOWL.G3, BOWL.A3, BOWL.B3, BOWL.D4],
  legendary: [BOWL.E3, BOWL.G3, BOWL.A3, BOWL.B3, BOWL.D4],
};

/**
 * Reveal chime — fired the moment the spin lands. Brighter, quicker,
 * drier (35% wet) than the mint: sequential tones, shorter ring,
 * faster attack — reads as an announcement / discovery.
 */
export function playChime(tier: Tier): void {
  CHIME_SEQUENCES[tier].forEach((frequency, i) => {
    window.setTimeout(
      () =>
        audioManager.playBowlTone({
          frequency,
          duration: 3.5,
          volume: 0.13,
          attack: 0.3,
          useReverb: true,
          reverbWet: 0.35,
        }),
      i * 380
    );
  });
}

// Mint = HARMONY. The same bowls, but overlapping into a sustained
// chord (E minor + octave) — all tones land together = arrival /
// resolution / "amen". Each note carries its own gentle stagger,
// volume, and attack so the chord blooms rather than stacks abruptly.
const MINT_CHORD: Array<{ freq: number; delay: number; volume: number; attack: number }> = [
  { freq: BOWL.E3, delay: 0, volume: 0.12, attack: 0.7 },
  { freq: BOWL.G3, delay: 80, volume: 0.1, attack: 0.6 },
  { freq: BOWL.B3, delay: 160, volume: 0.09, attack: 0.6 },
  { freq: BOWL.D4, delay: 320, volume: 0.08, attack: 0.5 },
];

/**
 * Mint-success chord — fired when the mock mint completes. Long (7 s),
 * very wet (60%) — a cathedral resolution distinct from the reveal's
 * dry ascending melody.
 */
export function playMintSuccess(): void {
  MINT_CHORD.forEach((note) => {
    window.setTimeout(
      () =>
        audioManager.playBowlTone({
          frequency: note.freq,
          duration: 7.0,
          volume: note.volume,
          attack: note.attack,
          useReverb: true,
          reverbWet: 0.6,
        }),
      note.delay
    );
  });
}
