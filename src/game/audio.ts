// Hybrid Web Audio SFX + HTMLAudio BGM.
//
// All SFX are now sample-based — three AudioBuffers are fetched and
// decoded in the background during ctx init:
//
//   /sfx/koto_a4.mp3   plucked gayageum, A4 440Hz, ~2.5s
//                      → combo melody base; pitch-shifted via
//                        playbackRate per note in PENTATONIC_FREQS
//   /sfx/bonsho.mp3    temple bell (keisu), ~200Hz, ~6s → game over
//   /sfx/drop.mp3      celtic harp A3 220Hz, ~2s → yokai drop
//
// Bounce/collision SFX has been intentionally removed for a meditative
// atmosphere: drop + merge already give all the feedback the player
// needs, and silencing collisions cuts the chatter of stacked yokai.
//
// Volume design — intentionally quiet so SFX never feel loud or
// intrusive in a Mini App that may be open alongside other audio:
//   sfxGain master : 0.25
//   per-sample gain: 0.5–0.6 (further attenuation)
//   → effective SFX output ≈ 0.13–0.15
//   bgmEl.volume   : 0.35 (HTMLAudio, independent of sfxGain)
//
// Mute semantics — sfxGain flips 0 ⇄ 0.25 for SFX (cuts tails in
// flight instantly), bgmEl pauses/resumes for BGM. The two channels
// are fully independent; Settings.tsx exposes them as separate toggles.
//
// iOS still requires the first audio node be started inside a user
// gesture (see unlock()). Sample decode itself runs regardless of
// context state, so the buffers are usually ready well before the
// first merge — but if a sample happens to be un-decoded when its
// method is called, the method is silent (no synth fallback).

const PENTATONIC_FREQS = [
  261.63, // C4
  293.66, // D4
  329.63, // E4
  392.0,  // G4
  440.0,  // A4   ← unison with koto sample
  523.25, // C5
  587.33, // D5
  659.25, // E5
  783.99, // G5
  880.0,  // A5
];

const KOTO_BASE_FREQ = 440.0;

const DEFAULT_SFX_VOLUME = 0.25;
const DEFAULT_BGM_VOLUME = 0.35;

const KOTO_URL = "/sfx/koto_a4.mp3";
const BONSHO_URL = "/sfx/bonsho.mp3";
const DROP_URL = "/sfx/drop.mp3";

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
  private sfxGain: GainNode | null = null;
  private unlocked = false;
  private sfxMuted = false;
  private bgmMuted = false;

  // Sampled instruments. Null until loadSamples() resolves; a method
  // whose sample hasn't decoded yet simply emits silence.
  private kotoBuffer: AudioBuffer | null = null;
  private bonshoBuffer: AudioBuffer | null = null;
  private dropBuffer: AudioBuffer | null = null;
  private samplesRequested = false;

  // Pentatonic combo state — index of the next note in PENTATONIC_FREQS.
  // Resets to 0 after COMBO_RESET_MS of silence.
  private comboIndex = 0;
  private lastMergeAt = 0;
  private readonly COMBO_RESET_MS = 1500;

  // HTMLAudio-based background music
  private bgmEl: HTMLAudioElement | null = null;
  private bgmVolume = DEFAULT_BGM_VOLUME;

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
    // SFX gain bus — all SFX connect here, so toggling this single gain
    // mutes everything including tails already in flight.
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxMuted ? 0 : DEFAULT_SFX_VOLUME;
    this.sfxGain.connect(this.ctx.destination);
    // Kick off sample decode in parallel (non-blocking).
    this.loadSamples();
    return this.ctx;
  }

  /**
   * Fetch + decode all three samples. Idempotent. Per-sample failures
   * only silence the affected SFX — the others still play.
   */
  private async loadSamples() {
    if (this.samplesRequested) return;
    this.samplesRequested = true;
    const ctx = this.ctx;
    if (!ctx) return;
    const loadOne = async (
      url: string,
      assign: (b: AudioBuffer) => void
    ) => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const arr = await res.arrayBuffer();
        const buf = await ctx.decodeAudioData(arr);
        assign(buf);
      } catch (err) {
        console.warn(`[Audio] sample load failed (${url})`, err);
      }
    };
    await Promise.all([
      loadOne(KOTO_URL, (b) => {
        this.kotoBuffer = b;
      }),
      loadOne(BONSHO_URL, (b) => {
        this.bonshoBuffer = b;
      }),
      loadOne(DROP_URL, (b) => {
        this.dropBuffer = b;
      }),
    ]);
    console.log(
      "[Audio] samples ready — koto:",
      !!this.kotoBuffer,
      "bonshō:",
      !!this.bonshoBuffer,
      "drop:",
      !!this.dropBuffer
    );
  }

  /** Must be called from a user gesture handler (touchstart/click). */
  unlock() {
    if (this.unlocked) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      if (ctx.state === "suspended") ctx.resume();
      // Prime with a zero-gain zero-duration oscillator so iOS Safari
      // registers "audio was started inside a user gesture".
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(gain).connect(ctx.destination);
      const t = ctx.currentTime;
      osc.start(t);
      osc.stop(t + 0.001);
      this.unlocked = true;
      console.log("[Audio] unlocked");
    } catch (err) {
      console.warn("[Audio] unlock failed", err);
    }
  }

  /**
   * Enable/disable SFX. Flips the sfxGain bus between DEFAULT_SFX_VOLUME
   * and 0; silences every sampled source routed through it including
   * tails in flight. Does NOT suspend the AudioContext — BGM lives on
   * HTMLAudio (independent), and the context must stay running for any
   * later SFX calls to schedule correctly.
   */
  async setSoundEnabled(enabled: boolean) {
    this.sfxMuted = !enabled;
    persistPref(SOUND_STORAGE_KEY, enabled);
    const ctx = this.ctx;
    const bus = this.sfxGain;
    if (!ctx || !bus) return;
    try {
      bus.gain.setValueAtTime(
        enabled ? DEFAULT_SFX_VOLUME : 0,
        ctx.currentTime
      );
      if (enabled && ctx.state === "suspended") await ctx.resume();
    } catch (err) {
      console.warn("[Audio] setSoundEnabled state change failed", err);
    }
  }

  /**
   * Enable/disable BGM. Pauses the <audio> element (keeps playhead so
   * resume continues where we left off). Never touches the AudioContext
   * — BGM is HTMLAudio and fully independent of the SFX bus.
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
   * Start (or switch) the background track. Creates an HTMLAudioElement
   * with loop=true and volume=DEFAULT_BGM_VOLUME. Respects the current
   * mute state. No-op if the same src is already playing.
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

  /**
   * Shared gate for every sampled SFX method. Returns the ctx if SFX
   * is enabled, the context is running, and the SFX bus is ready.
   * Null return = caller emits silence (samples also need their buffer
   * to be decoded; that check is done per-method).
   */
  private canPlay(): AudioContext | null {
    if (this.sfxMuted) return null;
    const ctx = this.ctx;
    if (!ctx || !this.unlocked || !this.sfxGain) return null;
    if (ctx.state !== "running") {
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      return null;
    }
    return ctx;
  }

  // ==============================================================
  // DROP — celtic harp sample (A3)
  // ==============================================================

  /**
   * Plays when a yokai leaves the spawner slot. Silent if drop.mp3
   * hasn't finished decoding yet — the user almost certainly won't
   * drop anything in the first ~300ms, so this is rare in practice.
   */
  playDrop() {
    const ctx = this.canPlay();
    if (!ctx) return;
    if (!this.dropBuffer) return;

    const t = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = this.dropBuffer;
    source.playbackRate.setValueAtTime(1, t);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.6, t);

    source.connect(gain).connect(this.sfxGain!);
    source.start(t);
  }

  // ==============================================================
  // MERGE / COMBO — pitch-shifted koto pentatonic
  // ==============================================================

  /**
   * Unified merge SFX: plays the next note of the C-major pentatonic
   * scale via the koto sample. comboIndex advances per merge, caps at
   * A5, resets to 0 after COMBO_RESET_MS of silence. A fast streak
   * climbs C4→D4→E4→G4→A4→C5→…; a single merge after a long pause
   * plays C4.
   */
  playMergeWithCombo() {
    const perfNow = performance.now();
    if (perfNow - this.lastMergeAt > this.COMBO_RESET_MS) {
      this.comboIndex = 0;
    }
    this.lastMergeAt = perfNow;

    const ctx = this.canPlay();
    if (!ctx) {
      // Advance even when muted so a mid-streak un-mute steps forward.
      this.comboIndex = Math.min(
        this.comboIndex + 1,
        PENTATONIC_FREQS.length - 1
      );
      return;
    }

    const idx = Math.min(this.comboIndex, PENTATONIC_FREQS.length - 1);
    const freq = PENTATONIC_FREQS[idx];
    this.comboIndex = Math.min(
      this.comboIndex + 1,
      PENTATONIC_FREQS.length - 1
    );

    this.playKotoNote(ctx, freq);
  }

  private playKotoNote(ctx: AudioContext, frequency: number) {
    if (!this.kotoBuffer) return;
    const t = ctx.currentTime;

    const source = ctx.createBufferSource();
    source.buffer = this.kotoBuffer;
    source.playbackRate.setValueAtTime(frequency / KOTO_BASE_FREQ, t);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);

    source.connect(gain).connect(this.sfxGain!);
    source.start(t);
  }

  // ==============================================================
  // GAME OVER — bonshō temple bell
  // ==============================================================

  playGameOver() {
    const ctx = this.canPlay();
    if (!ctx) return;
    if (!this.bonshoBuffer) return;

    const t = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = this.bonshoBuffer;
    source.playbackRate.setValueAtTime(1, t);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.6, t);

    source.connect(gain).connect(this.sfxGain!);
    source.start(t);
  }

  // ==============================================================
  // BOUNCE — removed on purpose. Collisions are silent now; drop and
  // merge provide all the feedback. The former playBounce(velocity)
  // method has been deleted entirely, and the engine no longer calls
  // any bounce SFX from its collisionStart handler.
  // ==============================================================
}
