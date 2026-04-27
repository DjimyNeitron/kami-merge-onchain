// Hybrid Web Audio SFX + HTMLAudio BGM.
//
// SFX are sample-based: six AudioBuffers are fetched and decoded in
// the background during ctx init.
//
//   /sfx/merge_1.mp3 … merge_5.mp3
//                      pre-tuned marimba pentatonic (C5 D5 E5 G5 A5).
//                      Played directly per-merge — no playbackRate
//                      retuning. comboIndex picks the buffer.
//                      Also reused by playGameOver as a 3-note
//                      descending cadence (A5 → G5 → E5).
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

import type { BgmTrackId } from "@/game/bgmTracks";
import { BGM_TRACKS, getBgmTrack as lookupBgmTrack } from "@/game/bgmTracks";

// Pre-tuned marimba pentatonic — one buffer per note in ascending
// order (C5, D5, E5, G5, A5). comboIndex maps directly into this
// array; once it caps at length-1 the streak plateaus on A5.
const MERGE_URLS = [
  "/sfx/merge_1.mp3",
  "/sfx/merge_2.mp3",
  "/sfx/merge_3.mp3",
  "/sfx/merge_4.mp3",
  "/sfx/merge_5.mp3",
];

const DEFAULT_SFX_VOLUME = 0.15;
const DEFAULT_BGM_VOLUME = 0.35;

const DROP_URL = "/sfx/drop.mp3";
const GAMEOVER_URL = "/sfx/gameover.mp3";

const SOUND_STORAGE_KEY = "kami_sound_enabled";
const MUSIC_STORAGE_KEY = "kami_music_enabled";

// BGM track switching transition envelope: fade out current → swap src
// → fade in new. ~250ms each phase keeps the transition perceptually
// smooth without feeling sluggish (~half a second total). Single
// HTMLAudioElement throughout — no parallel crossfade layer.
const BGM_FADE_MS = 250;

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

  // Sampled instruments. mergeBuffers stays empty until loadSamples()
  // resolves the parallel decode of the five marimba notes; a method
  // whose buffer is missing simply emits silence.
  private mergeBuffers: AudioBuffer[] = [];
  private dropBuffer: AudioBuffer | null = null;
  private gameoverBuffer: AudioBuffer | null = null;
  private samplesRequested = false;

  // Pentatonic combo state — index of the next buffer in mergeBuffers.
  // Resets to 0 after COMBO_RESET_MS of silence.
  private comboIndex = 0;
  private lastMergeAt = 0;
  private readonly COMBO_RESET_MS = 1500;

  // HTMLAudio-based background music
  private bgmEl: HTMLAudioElement | null = null;
  private bgmVolume = DEFAULT_BGM_VOLUME;
  // Track identity is owned here so the engine + GameCanvas don't have
  // to re-derive it from el.src parsing. `null` means "never set yet".
  private currentTrackId: BgmTrackId | null = null;
  // Generation counter for fadeTo(). Each fade increments it; ticks
  // bail when their captured generation goes stale, so a rapid sequence
  // of setBgmTrack() calls cancels in-flight fades cleanly without
  // stacking volume animations on top of each other.
  private bgmFadeGen = 0;
  // Re-entrancy guard for setBgmTrack(). Set true while a manual track
  // switch is mid-flight (fade-out / pause / src swap / play / fade-in)
  // so the bgmEl 'ended' listener doesn't double-fire an auto-advance
  // off the brief paused state we go through during the swap.
  private bgmSwitching = false;

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
    // Pre-allocate the merge slot array so out-of-order fetches land
    // at the right index without surprising mid-decode reads (a
    // playMergeWithCombo call before the higher-numbered notes finish
    // simply hits an `undefined` and falls through to silence).
    this.mergeBuffers = new Array<AudioBuffer | undefined>(
      MERGE_URLS.length
    ) as AudioBuffer[];
    await Promise.all([
      ...MERGE_URLS.map((url, i) =>
        loadOne(url, (b) => {
          this.mergeBuffers[i] = b;
        })
      ),
      loadOne(DROP_URL, (b) => {
        this.dropBuffer = b;
      }),
      loadOne(GAMEOVER_URL, (b) => {
        this.gameoverBuffer = b;
      }),
    ]);
    const mergeReady = this.mergeBuffers.filter(Boolean).length;
    console.log(
      `[Audio] samples ready — merge: ${mergeReady}/${MERGE_URLS.length}`,
      "drop:",
      !!this.dropBuffer,
      "gameover:",
      !!this.gameoverBuffer
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
      // Cancel any in-flight fade and restore the canonical BGM volume —
      // a stale 0 from an interrupted fade would otherwise resume into
      // silence even though the toggle is back on.
      this.bgmFadeGen += 1;
      el.volume = this.bgmVolume;
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
      this.bgmEl.removeEventListener("ended", this.handleBgmEnded);
      this.bgmEl.pause();
      this.bgmEl.src = "";
      this.bgmEl.load();
    } catch {
      /* ignore */
    }
    this.bgmEl = null;
    this.currentTrackId = null;
    this.bgmFadeGen += 1; // cancel any fade pinned to the dead element
    this.bgmSwitching = false;
  }

  /**
   * The current BGM API. Plays the track identified by `id`, switching
   * from the existing one with a fade-out → src swap → fade-in (~250ms
   * each phase, single HTMLAudioElement throughout).
   *
   * Behaviour:
   *   - First call: creates the audio element with `preload="none"` so
   *     no bytes are fetched until play() actually fires (lazy load),
   *     starts at volume 0 and fades up to bgmVolume.
   *   - Same id as currently playing: no-op, returns immediately.
   *   - Music is currently muted (setMusicEnabled(false)): the new id
   *     is recorded and the element's src is updated, but playback
   *     stays paused. Re-enabling music will resume into the new
   *     track.
   *   - A second setBgmTrack arriving mid-transition cancels the
   *     stale fade (via bgmFadeGen) and bails the in-flight call out
   *     of its remaining steps.
   */
  async setBgmTrack(id: BgmTrackId): Promise<void> {
    const track = lookupBgmTrack(id);
    if (!track) {
      console.warn("[Audio] unknown BGM track id:", id);
      return;
    }
    if (id === this.currentTrackId && this.bgmEl) return;

    this.currentTrackId = id;
    this.bgmSwitching = true;
    try {
      // First-time mount: build the element, attach the 'ended' →
      // auto-advance listener, no fade-out, just fade-in.
      if (!this.bgmEl) {
        const el = new Audio();
        // loop=false so 'ended' actually fires; auto-advance hands the
        // baton to the next track in BGM_TRACKS instead of looping.
        el.loop = false;
        el.preload = "none";
        el.volume = 0;
        el.src = track.src;
        el.addEventListener("ended", this.handleBgmEnded);
        this.bgmEl = el;
        if (this.bgmMuted) return; // recorded; resume later via setMusicEnabled
        try {
          await el.play();
          if (this.currentTrackId !== id) return; // superseded
          // Release the swap guard as soon as the new track has
          // actually started — the guard's only job is to suppress
          // spurious 'ended' events during the src-swap window. From
          // here on, any 'ended' belongs to the new track and SHOULD
          // be honoured by the auto-advance handler. Critically, this
          // means the fade-in below cannot strand bgmSwitching=true
          // if rAF stalls (backgrounded tab, etc).
          this.bgmSwitching = false;
          await this.fadeBgmTo(this.bgmVolume, BGM_FADE_MS);
        } catch (err) {
          console.warn("[Audio] BGM play failed:", err);
        }
        return;
      }

      // Subsequent switch: fade out → swap src → fade in.
      const el = this.bgmEl;
      const wasAudible = !el.paused && !this.bgmMuted;
      if (wasAudible) {
        await this.fadeBgmTo(0, BGM_FADE_MS);
        if (this.currentTrackId !== id) return; // superseded mid-fade
      }
      try {
        el.pause();
        el.preload = "none";
        // No explicit el.load() — setting src already triggers a
        // fresh resource-selection cycle. Calling load() afterwards
        // races el.play() and can reject with
        //   "AbortError: The play() request was interrupted by a
        //    call to load()"
        // which we observed kicking in occasionally on the second
        // auto-advance hop.
        el.src = track.src;
      } catch {
        /* ignore — failed src swap will surface on play() below */
      }
      if (this.bgmMuted) {
        el.volume = this.bgmVolume; // primed for the next unmute
        return;
      }
      try {
        el.volume = 0;
        await el.play();
        if (this.currentTrackId !== id) return; // superseded
        // Release the swap guard immediately on play() success — see
        // the matching comment in the first-time-mount branch above.
        this.bgmSwitching = false;
        await this.fadeBgmTo(this.bgmVolume, BGM_FADE_MS);
      } catch (err) {
        console.warn("[Audio] BGM play failed (after swap):", err);
      }
    } finally {
      // Belt-and-braces: if any branch returned before the
      // play()-success release above (mute, mid-fade superseded, etc),
      // make sure the guard always ends false — never strand it.
      this.bgmSwitching = false;
    }
  }

  /**
   * Auto-advance handler — fires when the current track finishes
   * naturally (loop = false). Picks the next track in BGM_TRACKS
   * with wrap-around and delegates to setBgmTrack so all the fade
   * + persistence + cancellation logic stays in one place.
   *
   * Two early-return guards:
   *   1. bgmMuted → don't kick a new track; the user has music off.
   *      When they re-enable, setMusicEnabled resumes from where the
   *      paused element left off (which is the end of the prior
   *      track, so the next play() will be a near-noop, but harmless).
   *   2. bgmSwitching → a manual setBgmTrack is mid-flight; ignore
   *      the spurious 'ended' that the brief paused state during a
   *      src-swap can produce. setBgmTrack will set the next track
   *      explicitly anyway.
   */
  private handleBgmEnded = () => {
    if (this.bgmMuted) return;
    if (this.bgmSwitching) return;
    if (BGM_TRACKS.length === 0) return;
    const idx = BGM_TRACKS.findIndex((t) => t.id === this.currentTrackId);
    const nextIdx = idx >= 0 ? (idx + 1) % BGM_TRACKS.length : 0;
    const nextId = BGM_TRACKS[nextIdx].id;
    console.log("[Audio] BGM auto-advance →", nextId);
    void this.setBgmTrack(nextId);
  };

  getBgmTrack(): BgmTrackId | null {
    return this.currentTrackId;
  }

  /**
   * Linearly fade the BGM element's volume to `target` over `durationMs`.
   * Cancellation via `bgmFadeGen`: each invocation captures a generation,
   * and ticks abort once `bgmFadeGen` advances. Concurrent / overlapping
   * fades thus cancel cleanly without volume jitter.
   */
  private fadeBgmTo(target: number, durationMs: number): Promise<void> {
    const el = this.bgmEl;
    if (!el) return Promise.resolve();
    const myGen = ++this.bgmFadeGen;
    const start = el.volume;
    const clampedTarget = Math.min(1, Math.max(0, target));
    const dur = Math.max(durationMs, 1);
    const startTime = performance.now();
    return new Promise((resolve) => {
      const tick = () => {
        if (myGen !== this.bgmFadeGen || !this.bgmEl) {
          resolve();
          return;
        }
        const t = Math.min((performance.now() - startTime) / dur, 1);
        try {
          this.bgmEl.volume = start + (clampedTarget - start) * t;
        } catch {
          /* element gone, bail */
          resolve();
          return;
        }
        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });
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
   * Plays when a yokai leaves the spawner slot. Currently disabled
   * via early return — we're testing the feel of combo-only audio
   * (merges are the only audible feedback). Sample is still preloaded
   * by loadSamples() so flipping this back on is a one-line revert.
   *
   * Original body preserved in the commented block below.
   */
  playDrop() {
    // Temporarily disabled — testing combo-only audio feel.
    return;

    // --- Original implementation kept for easy re-enable ---
    // const ctx = this.canPlay();
    // if (!ctx) return;
    // if (!this.dropBuffer) return;
    //
    // const t = ctx.currentTime;
    // const source = ctx.createBufferSource();
    // source.buffer = this.dropBuffer;
    // source.playbackRate.setValueAtTime(1, t);
    //
    // const gain = ctx.createGain();
    // gain.gain.setValueAtTime(0.6, t);
    //
    // source.connect(gain).connect(this.sfxGain!);
    // source.start(t);
  }

  // ==============================================================
  // MERGE / COMBO — pitch-shifted koto pentatonic
  // ==============================================================

  /**
   * Unified merge SFX: plays one pre-tuned marimba note from
   * mergeBuffers (C5 D5 E5 G5 A5). Two regimes:
   *
   *   - Cascade: a merge within COMBO_RESET_MS of the previous one
   *     advances comboIndex one step, capped at lastIdx, so a long
   *     streak still climbs C5 → D5 → E5 → G5 → A5 and plateaus on A5.
   *   - Isolated: a merge after a >=COMBO_RESET_MS silence picks
   *     uniformly from {0, 1, 2} (C5 / D5 / E5). This breaks the
   *     "every merge plays C5" monotony that ~95% of Suika-physics
   *     drops produce. Higher notes (G5, A5) stay reserved for the
   *     payoff at the top of a real cascade.
   *
   * Buffers are pre-tuned, so no playbackRate / pitch math.
   */
  playMergeWithCombo() {
    const perfNow = performance.now();
    const lastIdx = Math.max(this.mergeBuffers.length - 1, 0);
    const inCascade = perfNow - this.lastMergeAt < this.COMBO_RESET_MS;
    if (inCascade) {
      this.comboIndex = Math.min(this.comboIndex + 1, lastIdx);
    } else {
      // Random low-note pick on isolated merges. Math.floor(Math.random
      // () * 3) is in {0, 1, 2}; clamp to lastIdx in case the registry
      // ever shrinks below 3 entries.
      this.comboIndex = Math.min(Math.floor(Math.random() * 3), lastIdx);
    }
    this.lastMergeAt = perfNow;

    const ctx = this.canPlay();
    if (!ctx) return; // muted / not unlocked — silent (state already advanced)

    const buffer = this.mergeBuffers[this.comboIndex];
    if (!buffer) return; // sample for this slot not yet decoded — silent

    const t = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    // No playbackRate change — sample is already pre-tuned.

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);

    source.connect(gain).connect(this.sfxGain!);
    source.start(t);
  }

  // ==============================================================
  // GAME OVER — pre-rendered 4-note minor cadence (~4.8s).
  // The asset already bakes in the loudness emphasis vs merge SFX,
  // so the playback path is plain: no per-source gain, no scheduling.
  // ==============================================================

  playGameOver() {
    const ctx = this.canPlay();
    if (!ctx) return;
    if (!this.gameoverBuffer) return; // sample not yet decoded — silent

    const source = ctx.createBufferSource();
    source.buffer = this.gameoverBuffer;
    source.connect(this.sfxGain!);
    source.start(ctx.currentTime);
  }

  // ==============================================================
  // BOUNCE — removed on purpose. Collisions are silent now; drop and
  // merge provide all the feedback. The former playBounce(velocity)
  // method has been deleted entirely, and the engine no longer calls
  // any bounce SFX from its collisionStart handler.
  // ==============================================================
}
