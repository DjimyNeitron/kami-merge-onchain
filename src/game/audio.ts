// Lightweight Web Audio SFX generator + HTMLAudio-based BGM hook.
// SFX are synthesised on the fly (no samples) in a Japanese sonic palette:
// woodblock drop, bamboo bounce, koto merge, furin wind-chime combo, and a
// bonshō temple bell on game over. BGM is played via a regular <audio>
// element — pass the track URL into playBGM() when ready.
// iOS requires the first node be started inside a user gesture (see unlock()).

// Pentatonic notes mapped to yokai tiers — one note per tier (singing-bowl
// scale: C D E G A across rising octaves)
const PENTATONIC_NOTES = [
  262, 294, 330, 392, 440, 524, 588, 660, 784, 880, 1048,
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

  /** Water droplet "plink" — fundamental + airy overtone. */
  playDrop() {
    const ctx = this.canPlay();
    if (!ctx) return;
    this.softTone(ctx, 600, 300, 0.12, 0.15, 0.01);
    this.softTone(ctx, 900, 450, 0.08, 0.04, 0.01);
  }

  /** Bamboo tapping a stone — barely-there "tap". */
  playBounce() {
    const now = performance.now();
    if (now - this.lastBounceAt < 150) return;
    this.lastBounceAt = now;
    const ctx = this.canPlay();
    if (!ctx) return;
    this.softTone(ctx, 500, 250, 0.03, 0.04, 0.005);
  }

  /** Singing bowl — pentatonic note with octave shimmer, slow decay. */
  playMerge(yokaiId: number) {
    const ctx = this.canPlay();
    if (!ctx) return;
    const idx = Math.min(
      Math.max(yokaiId - 1, 0),
      PENTATONIC_NOTES.length - 1
    );
    const base = PENTATONIC_NOTES[idx];
    const g = Math.min(0.2, 0.08 + yokaiId * 0.01);
    // Fundamental — gentle attack, very long tail
    this.softTone(ctx, base, base, 0.8, g, 0.05);
    // Octave-up shimmer overtone
    this.softTone(ctx, base * 2, base * 2, 0.6, 0.03, 0.05);
  }

  /** Furin wind chime — 2-3 soft high sine bells with long decay. */
  playCombo(comboCount: number) {
    const ctx = this.canPlay();
    if (!ctx) return;
    const freqs = [1800, 2200, 2600];
    const count = comboCount >= 3 ? 3 : 2;
    for (let i = 0; i < count; i++) {
      this.softTone(ctx, freqs[i], freqs[i], 1.2, 0.03, 0.02, i * 0.15);
    }
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
