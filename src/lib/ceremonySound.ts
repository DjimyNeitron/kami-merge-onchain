// ceremonySound — procedural Web Audio cues for the MintCeremony.
//
// Three sounds, all synthesised at runtime via oscillators — no audio
// files ship with the bundle. The caller (MintCeremony) decides when
// to fire each and gates them on its own soundEnabled flag; these
// functions just play unconditionally when called.
//
// A single AudioContext is created lazily and reused. Browsers
// suspend a context created outside a user gesture (autoplay policy),
// so getCtx() calls resume() defensively each time — by the time a
// real ceremony runs (post-game-over) the page has seen plenty of
// gestures and the context is unlocked. On a cold dev-route load the
// first ceremony may be silent until the first click; that's
// acceptable for an internal tool.

import { type Tier } from "@/config/yokai";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

// One-shot oscillator note with a linear attack + exponential decay.
function note(
  c: AudioContext,
  freq: number,
  type: OscillatorType,
  startAt: number,
  peakGain: number,
  decay: number
): void {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(peakGain, startAt + 0.02);
  // exponentialRamp can't target 0 — 0.001 is effectively silent.
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + decay);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(startAt);
  osc.stop(startAt + decay);
}

/**
 * Spinning tick — a very subtle high marimba blip. Fired once per tier
 * change while the slot drum is spinning. Volume 0.08 — present but
 * never overwhelming across a fast cycle.
 */
export function playTick(): void {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "triangle";
  osc.frequency.value = 1760; // A6
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.08, t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.05);
}

// Tier chord — note count scales with rarity, so the ear hears how
// rare the result is before reading the label. Common = a 2-note
// dyad, Legendary = a full 5-note stack.
const CHIME_NOTES: Record<Tier, number[]> = {
  common: [523.25, 659.25], // C5 E5
  rare: [523.25, 659.25, 783.99], // C5 E5 G5
  epic: [523.25, 659.25, 783.99, 1046.5], // + C6
  legendary: [523.25, 659.25, 783.99, 1046.5, 1318.51], // + E6
};

/**
 * Final-stop chime — fired the moment the spin lands and the card
 * starts to materialise. Notes stagger 40 ms apart into a shimmering
 * chord; richer chord = rarer tier.
 */
export function playChime(tier: Tier): void {
  const c = getCtx();
  if (!c) return;
  CHIME_NOTES[tier].forEach((freq, i) => {
    note(c, freq, "sine", c.currentTime + i * 0.04, 0.25, 1.2);
  });
}

// Ascending C-major arpeggio for the mint-complete flourish.
const ARPEGGIO = [523.25, 659.25, 783.99, 1046.5, 1318.51];

/**
 * Mint-success arpeggio — fired when the mock mint completes. Five
 * triangle notes climbing 80 ms apart.
 */
export function playMintSuccess(): void {
  const c = getCtx();
  if (!c) return;
  ARPEGGIO.forEach((freq, i) => {
    note(c, freq, "triangle", c.currentTime + i * 0.08, 0.2, 0.4);
  });
}
