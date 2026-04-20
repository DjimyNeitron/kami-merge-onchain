// Lightweight Web Audio SFX generator + HTMLAudio-based BGM hook.
// SFX are synthesised on the fly (no samples) for a meditative shrine
// atmosphere: water-droplet drop, water-echo bounce, pentatonic combo
// melody on merges, and a bonshō temple bell on game over.
// BGM is played via a regular <audio> element — pass the track URL into
// playBGM() when ready.
// iOS requires the first node be started inside a user gesture (see unlock()).

// Ascending C major pentatonic, C4 → A5. Every merge steps one note up.
// After COMBO_RESET_MS of silence the index resets to 0 (C4).
// Index past the end caps at A5 so long combos plateau instead of going
// into dog-whistle territory.
const PENTATONIC_C4_A5 = [
  261.63, // C4
  293.66, // D4
  329.63, // E4
  392.0,  // G4
  440.0,  // A4
  523.25, // C5
  587.33, // D5
  659.25, // E5
  783.99, // G5
  880.0,  // A5
];

const SOUND_STORAGE_KEY = "kami_sound_enabled";
const MUSIC_STORAGE_KEY = "kami_music_enabled";

function persistPref(key: string, value: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    /* quota / privacy-mode — ignore */
  }
}

export class AudioManager {
  private ctx: AudioContext | null = null;
  private unlocked = false;
  private sfxMuted = false;
  private bgmMuted = false;
  private lastBounceAt = 0;

  // Pentatonic combo state — index of the next note in PENTATONIC_C4_A5.
  // Resets to 0 after COMBO_RESET_MS of silence.
  private comboIndex = 0;
  private lastMergeAt = 0;
  private readonly COMBO_RESET_MS = 1500;

  // Bounce throttle: minimum ms between bounce SFX, plus a velocity floor
  // below which we emit nothing. Keeps crowded stacks from stuttering.
  private readonly BOUNCE_THROTTLE_MS = 60;
  private readonly BOUNCE_VELOCITY_THRESHOLD = 3;

  // HTMLAudio-based background music
  private bgmEl: HTMLAudioElement | null = null;
  private bgmVolume = 0.15;

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof window === "undefined") return null;
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    try {
      this.ctx = new Ctor();
    } catch (err) {
      console.warn("[Audio] AudioContext init failed", err);
      return null;
    }
    return this.ctx;
  }

  /** Must be called from a user gesture handler (touchstart/click). */
  unlock() {
    if (this.unlocked) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      if (ctx.state === "suspended") ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(gain).connect(ctx.destination);
      const t = ctx.currentTime;
      osc.start(t);
      osc.stop(t + 0.001);
      this.unlocked = true;
      console.log("[Audio] unlocked");
      // If the user had disabled sound before the first gesture, suspend the
      // context now that it exists so we're in the requested state.
      if (this.sfxMuted && ctx.state === "running") {
        ctx.suspend().catch(() => {});
      }
    } catch (err) {
      console.warn("[Audio] unlock failed", err);
    }
  }

  /**
   * Enable/disable SFX. Disabling suspends the AudioContext, which halts
   * every in-flight oscillator tail immediately (critical on iOS). Music
   * plays through a separate <audio> element and is NOT touched here —
   * the two toggles are fully independent.
   */
  async setSoundEnabled(enabled: boolean) {
    this.sfxMuted = !enabled;
    persistPref(SOUND_STORAGE_KEY, enabled);
    const ctx = this.ctx;
    if (!ctx) return;
    try {
      if (enabled) {
        if (ctx.state === "suspended") await ctx.resume();
      } else {
        if (ctx.state === "running") await ctx.suspend();
      }
    } catch (err) {
      console.warn("[Audio] setSoundEnabled state change failed", err);
    }
  }

  /**
   * Enable/disable BGM. Pauses the <audio> element (keeps playhead so
   * resume continues from where we left off). Never touches the
   * AudioContext — BGM is HTMLAudio and independent of SFX routing.
   */
  async setMusicEnabled(enabled: boolean) {
    this.bgmMuted = !enabled;
    persistPref(MUSIC_STORAGE_KEY, enabled);
    const el = this.bgmEl;
    if (!el) return;
    if (enabled) {
      if (el.paused) {
        try {
          await el.play();
        } catch (err) {
          console.warn("[Audio] BGM resume failed", err);
        }
      }
    } else {
      el.pause();
    }
  }

  isSoundEnabled(): boolean {
    return !this.sfxMuted;
  }

  isMusicEnabled(): boolean {
    return !this.bgmMuted;
  }

  /** Umbrella toggle — mutes both SFX and BGM together. */
  setMuted(muted: boolean) {
    this.setSoundEnabled(!muted);
    this.setMusicEnabled(!muted);
  }

  /** True only when both SFX and BGM are silenced. */
  isMuted(): boolean {
    return this.sfxMuted && this.bgmMuted;
  }

  setSfxMuted(muted: boolean) {
    this.setSoundEnabled(!muted);
  }

  isSfxMuted(): boolean {
    return this.sfxMuted;
  }

  setBgmMuted(muted: boolean) {
    this.setMusicEnabled(!muted);
  }

  isBgmMuted(): boolean {
    return this.bgmMuted;
  }

  /**
   * Start (or switch) the background track. Creates an HTMLAudioElement with
   * loop=true and volume=0.15. Respects the current mute state.
   * No-op if the same src is already playing.
   */
  playBGM(src: string) {
    if (this.bgmEl) {
      const current = this.bgmEl.src;
      if (current.endsWith(src) || current === src) return;
      this.stopBGM();
    }
    const el = new Audio(src);
    el.loop = true;
    el.volume = this.bgmVolume;
    this.bgmEl = el;
    // Only start playback if the user has music enabled. Later toggles via
    // Settings call setMusicEnabled(true), which resumes play() inside that
    // click handler — still a valid user gesture on iOS, so unlock survives.
    if (this.isMusicEnabled()) {
      el.play().catch((err) =>
        console.warn("[Audio] BGM play failed:", err)
      );
    }
    console.log(
      "[Audio] BGM loaded",
      src,
      this.isMusicEnabled() ? "(playing)" : "(paused — music disabled)"
    );
  }

  stopBGM() {
    if (!this.bgmEl) return;
    try {
      this.bgmEl.pause();
      this.bgmEl.src = "";
      this.bgmEl.load();
    } catch {
      /* ignore */
    }
    this.bgmEl = null;
  }

  private canPlay(): AudioContext | null {
    if (this.sfxMuted) return null;
    const ctx = this.ctx;
    if (!ctx || !this.unlocked) return null;
    // Belt-and-suspenders: only schedule oscillators when the context is
    // actually running. If it's suspended for any reason (tab visibility,
    // recent user toggle race), try to resume but skip this SFX call — the
    // next one will find state === "running".
    if (ctx.state !== "running") {
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      return null;
    }
    return ctx;
  }

  /**
   * Single soft sine tone with a gentle attack and exponential decay.
   * All SFX are composed of these — no harsh square/triangle, no noise.
   */
  private softTone(
    ctx: AudioContext,
    startFreq: number,
    endFreq: number,
    duration: number,
    peakGain: number,
    attack = 0.02,
    startOffset = 0
  ) {
    const t0 = ctx.currentTime + startOffset;
    const safeAttack = Math.min(Math.max(attack, 0.001), duration * 0.5);
    const peak = Math.max(0.0001, peakGain);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(startFreq, t0);
    if (endFreq !== startFreq) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(1, endFreq),
        t0 + duration
      );
    }
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + safeAttack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  /**
   * Soft water-droplet "plink" — single sine with a sharp downward pitch
   * bend (1200→400 Hz), short decay, and a highpass that strips any
   * low-end thump so it reads as "droplet into still water", not a thud.
   */
  playDrop() {
    const ctx = this.canPlay();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.15);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.005); // 5ms attack
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3); // 300ms decay

    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(800, now);
    filter.Q.setValueAtTime(1, now);

    osc.connect(gain).connect(filter).connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  }

  /**
   * Water-echo bounce — softer, shorter cousin of playDrop. Velocity
   * scales volume (harder hit = louder, but capped so it never overpowers
   * the combo bell). Throttled 60ms + velocity floor of 3 units so dense
   * stacks of barely-moving yokai don't chatter.
   */
  playBounce(velocity: number = 0) {
    if (velocity < this.BOUNCE_VELOCITY_THRESHOLD) return;

    const perfNow = performance.now();
    if (perfNow - this.lastBounceAt < this.BOUNCE_THROTTLE_MS) return;
    this.lastBounceAt = perfNow;

    const ctx = this.canPlay();
    if (!ctx) return;
    const t = ctx.currentTime;

    // Cap scale at 1.0 — a very fast impact still stays soft.
    const volumeScale = Math.min(velocity / 15, 1.0);

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.08);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.06 * volumeScale, t + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);

    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(600, t);

    osc.connect(gain).connect(filter).connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.45);
  }

  /**
   * Unified merge SFX: plays the next note of the C-major pentatonic
   * scale. Replaces the old `playMerge(yokaiId)` + separate `playCombo`
   * pair — every merge is now one step of an ascending melody, which
   * gives direct audible feedback for combo streaks without a second
   * layered sound. Resets to C4 after COMBO_RESET_MS of silence; caps
   * at A5 so long streaks plateau instead of climbing forever.
   */
  playMergeWithCombo() {
    const perfNow = performance.now();
    if (perfNow - this.lastMergeAt > this.COMBO_RESET_MS) {
      this.comboIndex = 0;
    }
    this.lastMergeAt = perfNow;

    const ctx = this.canPlay();
    if (!ctx) {
      // Advance the index even when muted so resuming mid-streak still
      // steps forward — but honour the reset window above.
      this.comboIndex = Math.min(
        this.comboIndex + 1,
        PENTATONIC_C4_A5.length - 1
      );
      return;
    }

    const idx = Math.min(this.comboIndex, PENTATONIC_C4_A5.length - 1);
    const freq = PENTATONIC_C4_A5[idx];
    this.comboIndex = Math.min(
      this.comboIndex + 1,
      PENTATONIC_C4_A5.length - 1
    );

    this.playBellTone(ctx, freq);
  }

  /**
   * Singing-bowl-ish bell tone — fundamental + two harmonics routed
   * through a soft lowpass. Used by playMergeWithCombo; centralised so
   * all combo notes have identical timbre and only the pitch changes.
   */
  private playBellTone(ctx: AudioContext, frequency: number) {
    const now = ctx.currentTime;

    // Fundamental
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(frequency, now);

    // Octave harmonic (brightness)
    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(frequency * 2, now);

    // Third harmonic (subtle sparkle)
    const osc3 = ctx.createOscillator();
    osc3.type = "sine";
    osc3.frequency.setValueAtTime(frequency * 3, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);

    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0.0001, now);
    gain2.gain.linearRampToValueAtTime(0.08, now + 0.005);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 1.0);

    const gain3 = ctx.createGain();
    gain3.gain.setValueAtTime(0.0001, now);
    gain3.gain.linearRampToValueAtTime(0.03, now + 0.005);
    gain3.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);

    // Soft lowpass — tames the upper harmonics, keeps the bowl character.
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(4000, now);
    filter.Q.setValueAtTime(0.5, now);

    osc.connect(gain).connect(filter);
    osc2.connect(gain2).connect(filter);
    osc3.connect(gain3).connect(filter);
    filter.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 1.6);
    osc2.start(now);
    osc2.stop(now + 1.1);
    osc3.start(now);
    osc3.stop(now + 0.8);
  }

  /** Bonshō temple bell — three harmonic layers with a gentle tremolo. */
  playGameOver() {
    const ctx = this.canPlay();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const longest = 2.5;
    const attack = 0.1;

    // Shared tremolo LFO — slow, subtle
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 3;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.01;
    lfo.connect(lfoDepth);
    lfo.start(t0);
    lfo.stop(t0 + longest + 0.1);

    const layers: Array<[number, number, number]> = [
      [90, 2.5, 0.15],
      [180, 2.0, 0.08],
      [270, 1.5, 0.04],
    ];
    for (const [freq, dur, peak] of layers) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(
        Math.max(0.0001, peak),
        t0 + attack
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      // Modulate the gain param with the tremolo LFO
      lfoDepth.connect(gain.gain);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    }
  }
}
