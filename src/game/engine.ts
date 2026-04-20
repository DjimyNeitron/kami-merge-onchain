import Matter from "matter-js";
import { AudioManager } from "@/game/audio";
import { ParticleSystem } from "@/game/particles";
import type { ParticleKind } from "@/game/seasons";
import { isDevModeActive } from "@/hooks/useDevMode";
import {
  YokaiType,
  YOKAI_CHAIN,
  getYokai,
  getNextYokai,
  getRandomSpawnable,
} from "@/config/yokai";
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  WALL_THICKNESS,
  PLAY_OFFSET_X,
  PLAY_OFFSET_Y,
  GAME_OVER_LINE_Y,
  GRAVITY,
  BOUNCE,
  FRICTION,
  AIR_FRICTION,
  DROP_COOLDOWN_MS,
  GAME_OVER_GRACE_MS,
} from "@/config/constants";

const HIGH_SCORE_KEY = "kamiMerge_highScore";
const SPAWN_Y = PLAY_OFFSET_Y + 50;
const DROP_GRACE_MS = 600;

// VFX tuning
const PARTICLE_COUNT = 10;
const PARTICLE_LIFE_MS = 500;
const FLASH_LIFE_MS = 300;
const SPAWN_ANIM_MS = 150;
const SHAKE_LIFE_MS = 200;
const COMBO_WINDOW_MS = 1500;
const COMBO_TEXT_LIFE_MS = 1000;
const PARTICLE_GRAVITY = 400; // px/sec^2

export type EngineCallbacks = {
  onScoreChange?: (score: number, highScore: number) => void;
  onNextChange?: (current: YokaiType, next: YokaiType) => void;
  onGameOver?: (finalScore: number) => void;
  onReachedChange?: (reachedIds: number[]) => void;
  onUnlockChange?: (unlockedIds: number[]) => void;
};

const UNLOCKED_STORAGE_KEY = "kami_unlocked_yokai";

function readUnlocked(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(UNLOCKED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is number => typeof x === "number");
  } catch {
    return [];
  }
}

function writeUnlocked(ids: number[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(UNLOCKED_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* ignore quota */
  }
}

type TaggedBody = Matter.Body & { yokaiId?: number };

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  radius: number;
  color: string;
};

type Flash = {
  x: number;
  y: number;
  life: number;
  maxLife: number;
};

type SpawnAnim = {
  body: Matter.Body;
  life: number;
  maxLife: number;
  yokai: YokaiType;
};

type ComboText = {
  count: number;
  life: number;
  maxLife: number;
};

type Shake = {
  life: number;
  maxLife: number;
  magnitude: number;
};

export class GameEngine {
  private engine: Matter.Engine;
  private render: Matter.Render;
  private runner: Matter.Runner;
  private world: Matter.World;

  private dropX = CANVAS_WIDTH / 2;
  private lastDropTime = 0;
  private currentYokai: YokaiType;
  private nextYokai: YokaiType;
  private score = 0;
  private highScore = 0;
  private gameOver = false;
  private godMode = false; // Dev-only; toggled via setGodMode()

  private merging = new Set<number>();
  private droppedBodies = new Set<number>();
  private dangerSince = new Map<number, number>();

  // VFX state
  private particles: Particle[] = [];
  private flashes: Flash[] = [];
  private spawnAnims = new Map<number, SpawnAnim>();
  private combo: ComboText | null = null;
  private comboCount = 0;
  private lastMergeTime = 0;
  private shake: Shake | null = null;
  private lastFrameTime = 0;

  // Sprite cache — preloaded PNG images keyed by yokai id
  private spriteCache = new Map<number, HTMLImageElement>();

  // Yokai ids that have been created (spawned or merged-into) this run
  private reached = new Set<number>();

  // Persistent "collection" — yokai ids the player has ever seen merge into
  // across all sessions. Initialized from localStorage in the constructor.
  private unlocked: Set<number> = new Set();

  // SFX generator (Web Audio)
  private audio = new AudioManager();
  private bgmStarted = false;

  // Seasonal particle pool — drives sakura/maple/snow + ambient fireflies.
  // Initialized as a field so it's ready BEFORE Matter's render loop starts
  // firing afterRender events (the previous in-constructor assignment ran
  // too late and the first tick hit `this.atmosphere.update(...)` as
  // undefined → "Cannot read properties of undefined (reading 'update')").
  private atmosphere: ParticleSystem = new ParticleSystem(
    CANVAS_WIDTH,
    CANVAS_HEIGHT
  );

  private callbacks: EngineCallbacks;

  constructor(container: HTMLElement, callbacks: EngineCallbacks = {}) {
    try {
      console.log("[GameEngine] constructor start", {
        containerTag: container.tagName,
        containerSize: {
          w: container.clientWidth,
          h: container.clientHeight,
        },
        canvas: { w: CANVAS_WIDTH, h: CANVAS_HEIGHT },
        play: { w: GAME_WIDTH, h: GAME_HEIGHT },
        offset: { x: PLAY_OFFSET_X, y: PLAY_OFFSET_Y },
        matterLoaded: typeof Matter,
        matterEngine: typeof Matter?.Engine,
        matterRender: typeof Matter?.Render,
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent : "n/a",
      });
    } catch (err) {
      console.error("[GameEngine] init-log failed", err);
    }
    this.callbacks = callbacks;

    try {
      this.engine = Matter.Engine.create();
      this.engine.gravity.y = GRAVITY;
      this.engine.gravity.scale = 0.001;
      this.world = this.engine.world;
      console.log("[GameEngine] engine created");

      this.render = Matter.Render.create({
        element: container,
        engine: this.engine,
        options: {
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          wireframes: false,
          // Transparent so the page's bg_game.jpg shows through outside of
          // the lantern frame and in empty play-zone space.
          background: "transparent",
        },
      });
      console.log("[GameEngine] render created", {
        canvasWidth: this.render.canvas.width,
        canvasHeight: this.render.canvas.height,
      });

      this.runner = Matter.Runner.create();
    } catch (err) {
      console.error("[GameEngine] FATAL during engine/render setup:", err);
      throw err;
    }

    const wallOpts: Matter.IChamferableBodyDefinition = {
      isStatic: true,
      render: { visible: false },
    };
    Matter.World.add(this.world, [
      // bottom
      Matter.Bodies.rectangle(
        CANVAS_WIDTH / 2,
        PLAY_OFFSET_Y + GAME_HEIGHT + WALL_THICKNESS / 2,
        CANVAS_WIDTH,
        WALL_THICKNESS,
        wallOpts
      ),
      // left
      Matter.Bodies.rectangle(
        PLAY_OFFSET_X - WALL_THICKNESS / 2,
        CANVAS_HEIGHT / 2,
        WALL_THICKNESS,
        CANVAS_HEIGHT * 2,
        wallOpts
      ),
      // right
      Matter.Bodies.rectangle(
        PLAY_OFFSET_X + GAME_WIDTH + WALL_THICKNESS / 2,
        CANVAS_HEIGHT / 2,
        WALL_THICKNESS,
        CANVAS_HEIGHT * 2,
        wallOpts
      ),
    ]);

    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(HIGH_SCORE_KEY);
      if (stored) this.highScore = parseInt(stored, 10) || 0;
    }

    // Preload yokai sprites
    for (const y of YOKAI_CHAIN) {
      const img = new Image();
      img.src = y.sprite;
      this.spriteCache.set(y.id, img);
    }

    this.currentYokai = getRandomSpawnable();
    this.nextYokai = getRandomSpawnable();

    Matter.Events.on(this.engine, "collisionStart", (e) =>
      this.handleCollisions(e)
    );
    Matter.Events.on(this.engine, "afterUpdate", () => this.checkGameOver());
    Matter.Events.on(this.render, "afterRender", () => this.drawOverlays());

    Matter.Render.run(this.render);
    Matter.Runner.run(this.runner, this.engine);
    console.log("[GameEngine] constructor done (render + runner running)");

    // Initialize the persistent Yokai Collection. First visit ever: seed with
    // Kodama (id 1) since that's the starting merge tier.
    const savedUnlocked = readUnlocked();
    if (savedUnlocked.length === 0) {
      this.unlocked = new Set([1]);
      writeUnlocked([1]);
    } else {
      this.unlocked = new Set(savedUnlocked);
    }

    this.callbacks.onScoreChange?.(this.score, this.highScore);
    this.callbacks.onNextChange?.(this.currentYokai, this.nextYokai);
    this.callbacks.onReachedChange?.([]);
    this.callbacks.onUnlockChange?.(Array.from(this.unlocked));
  }

  /** Configure which atmospheric particle kind to spawn for the season. */
  setSeasonSpawn(primary: ParticleKind, fireflyMultiplier: number) {
    if (!this.atmosphere) return;
    this.atmosphere.setSeason(primary, fireflyMultiplier);
  }

  private drawMist(ctx: CanvasRenderingContext2D) {
    // Period ≈ 8.4 seconds
    const t = Date.now() * 0.00075;
    const baseY = PLAY_OFFSET_Y + GAME_HEIGHT - 45;
    const blobs: Array<[number, number, number]> = [
      [PLAY_OFFSET_X + GAME_WIDTH * 0.25, 0, 0],
      [PLAY_OFFSET_X + GAME_WIDTH * 0.55, 14, 2.1],
      [PLAY_OFFSET_X + GAME_WIDTH * 0.8, 5, 4.2],
    ];
    for (const [cx, dy, phase] of blobs) {
      const driftX = Math.sin(t + phase) * 25;
      const x = cx + driftX;
      const y = baseY + dy;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1.6, 0.55);
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 70);
      grad.addColorStop(0, "rgba(220, 230, 255, 0.1)");
      grad.addColorStop(1, "rgba(220, 230, 255, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, 70, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawLanternFrame(ctx: CanvasRenderingContext2D) {
    // Thin elegant gold border on three sides (top stays open for drops).
    // The static torii/pagoda art already lives on the page background image.
    const left = PLAY_OFFSET_X;
    const right = PLAY_OFFSET_X + GAME_WIDTH;
    const top = PLAY_OFFSET_Y;
    const bottom = PLAY_OFFSET_Y + GAME_HEIGHT;
    const r = 8;

    ctx.save();
    ctx.strokeStyle = "rgba(200, 168, 78, 0.3)";
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(left, bottom - r);
    ctx.quadraticCurveTo(left, bottom, left + r, bottom);
    ctx.lineTo(right - r, bottom);
    ctx.quadraticCurveTo(right, bottom, right, bottom - r);
    ctx.lineTo(right, top);
    ctx.stroke();
    ctx.restore();
  }

  private markReached(id: number) {
    if (!this.reached.has(id)) {
      this.reached.add(id);
      this.callbacks.onReachedChange?.(Array.from(this.reached));
    }
  }

  /**
   * Add an id to the persistent unlocked collection on first-ever encounter.
   * No-op if already known; persists immediately and notifies listeners.
   */
  private markUnlocked(id: number) {
    if (this.unlocked.has(id)) return;
    this.unlocked.add(id);
    const ids = Array.from(this.unlocked).sort((a, b) => a - b);
    writeUnlocked(ids);
    this.callbacks.onUnlockChange?.(ids);
  }

  private createYokaiBody(x: number, y: number, yokai: YokaiType): TaggedBody {
    const body = Matter.Bodies.circle(x, y, yokai.radius, {
      restitution: BOUNCE,
      friction: FRICTION,
      frictionAir: AIR_FRICTION,
      density: 0.001,
      // Sprites are drawn manually in afterRender; Matter's default render
      // would just paint a solid circle under them.
      render: { visible: false },
    }) as TaggedBody;
    body.yokaiId = yokai.id;
    return body;
  }

  private addBodyWithGrace(body: Matter.Body) {
    Matter.World.add(this.world, body);
    const id = body.id;
    this.droppedBodies.add(id);
    setTimeout(() => this.droppedBodies.delete(id), DROP_GRACE_MS);
  }

  private spawnMergeParticles(x: number, y: number) {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 140;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        life: 0,
        maxLife: PARTICLE_LIFE_MS,
        radius: 3 + Math.random() * 2,
        color: "#f6c343",
      });
    }
  }

  private spawnFlash(x: number, y: number) {
    this.flashes.push({ x, y, life: 0, maxLife: FLASH_LIFE_MS });
  }

  private triggerShake(magnitude: number) {
    if (!this.shake || magnitude >= this.shake.magnitude) {
      this.shake = { life: 0, maxLife: SHAKE_LIFE_MS, magnitude };
    }
  }

  private registerMergeForCombo(now: number) {
    if (now - this.lastMergeTime < COMBO_WINDOW_MS) {
      this.comboCount += 1;
    } else {
      this.comboCount = 1;
    }
    this.lastMergeTime = now;
    if (this.comboCount >= 2) {
      // Visual COMBO x N! text above the merge point. The audible combo
      // feedback is handled per-merge by playMergeWithCombo() (pentatonic
      // scale), so there's no secondary sound layer here.
      this.combo = {
        count: this.comboCount,
        life: 0,
        maxLife: COMBO_TEXT_LIFE_MS,
      };
    }
  }

  private comboMultiplier(): number {
    if (this.comboCount >= 3) return 2;
    if (this.comboCount === 2) return 1.5;
    return 1;
  }

  private handleCollisions(event: Matter.IEventCollision<Matter.Engine>) {
    for (const pair of event.pairs) {
      const a = pair.bodyA as TaggedBody;
      const b = pair.bodyB as TaggedBody;
      // Bounce SFX was removed for a quieter, more meditative feel —
      // the collision handler now only runs merge-detection. Non-merge
      // branches just skip ahead silently.
      if (!a.yokaiId || !b.yokaiId) continue;
      if (a.yokaiId !== b.yokaiId) continue;
      if (a.yokaiId === 11) continue;
      if (this.merging.has(a.id) || this.merging.has(b.id)) continue;

      this.merging.add(a.id);
      this.merging.add(b.id);

      const midX = (a.position.x + b.position.x) / 2;
      const midY = (a.position.y + b.position.y) / 2;
      const next = getNextYokai(a.yokaiId);

      Matter.World.remove(this.world, a);
      Matter.World.remove(this.world, b);
      this.dangerSince.delete(a.id);
      this.dangerSince.delete(b.id);
      this.spawnAnims.delete(a.id);
      this.spawnAnims.delete(b.id);

      if (next) {
        const merged = this.createYokaiBody(midX, midY, next);
        this.addBodyWithGrace(merged);
        Matter.Body.setVelocity(merged, { x: 0, y: -2 });
        this.markReached(next.id);
        this.markUnlocked(next.id);

        // Scale-up anim tracked purely for visual scale in afterRender.
        this.spawnAnims.set(merged.id, {
          body: merged,
          life: 0,
          maxLife: SPAWN_ANIM_MS,
          yokai: next,
        });

        // Flash + particle burst at the merge point
        this.spawnFlash(midX, midY);
        this.spawnMergeParticles(midX, midY);

        // Merge SFX — ascending pentatonic scale keyed by combo streak
        // (not by yokai tier). First merge in a streak is C4, each next
        // is one note up; resets after 1.5s of silence.
        this.audio.playMergeWithCombo();

        // Screen shake for heavier yokai
        if (next.id >= 9) this.triggerShake(5);
        else if (next.id >= 7) this.triggerShake(3);

        // Combo tracking + score with multiplier
        const now = performance.now();
        this.registerMergeForCombo(now);
        const mult = this.comboMultiplier();
        this.score += Math.round(next.score * mult);

        if (this.score > this.highScore) {
          this.highScore = this.score;
          // Dev mode: score can climb in-session but is NOT persisted to
          // localStorage, so testing flows don't corrupt the player's
          // real high score between real sessions.
          if (typeof window !== "undefined" && !isDevModeActive()) {
            window.localStorage.setItem(HIGH_SCORE_KEY, String(this.highScore));
          }
        }
        this.callbacks.onScoreChange?.(this.score, this.highScore);
      }
    }
  }

  private checkGameOver() {
    if (this.gameOver) return;
    if (this.godMode) return; // Dev-mode guard: red line crossed is ignored
    const now = performance.now();
    const bodies = Matter.Composite.allBodies(this.world) as TaggedBody[];
    const live = new Set<number>();

    for (const body of bodies) {
      if (!body.yokaiId) continue;
      if (this.merging.has(body.id)) continue;
      if (this.droppedBodies.has(body.id)) continue;
      live.add(body.id);

      const yokai = getYokai(body.yokaiId);
      if (!yokai) continue;
      const topY = body.position.y - yokai.radius;
      const speed = Math.hypot(body.velocity.x, body.velocity.y);

      if (topY < GAME_OVER_LINE_Y && speed < 0.6) {
        if (!this.dangerSince.has(body.id)) {
          this.dangerSince.set(body.id, now);
        } else if (now - this.dangerSince.get(body.id)! > GAME_OVER_GRACE_MS) {
          this.triggerGameOver();
          return;
        }
      } else {
        this.dangerSince.delete(body.id);
      }
    }

    for (const id of Array.from(this.dangerSince.keys())) {
      if (!live.has(id)) this.dangerSince.delete(id);
    }
  }

  private triggerGameOver() {
    this.gameOver = true;
    this.audio.playGameOver();
    this.callbacks.onGameOver?.(this.score);
  }

  private updateVfx(dt: number) {
    // Particles — integrate position/velocity and expire
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      const s = dt / 1000;
      p.x += p.vx * s;
      p.y += p.vy * s;
      p.vy += PARTICLE_GRAVITY * s;
      p.life += dt;
      if (p.life >= p.maxLife) this.particles.splice(i, 1);
    }

    // Flashes — just advance life
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.life += dt;
      if (f.life >= f.maxLife) this.flashes.splice(i, 1);
    }

    // Spawn anims — advance life; bodies keep rendering via sprite draw loop
    for (const [id, anim] of this.spawnAnims) {
      anim.life += dt;
      if (anim.life >= anim.maxLife) this.spawnAnims.delete(id);
    }

    // Combo text
    if (this.combo) {
      this.combo.life += dt;
      if (this.combo.life >= this.combo.maxLife) this.combo = null;
    }

    // Shake — apply CSS transform to canvas
    if (this.shake) {
      this.shake.life += dt;
      const t = this.shake.life / this.shake.maxLife;
      if (t < 1) {
        const decay = 1 - t;
        const dx = (Math.random() * 2 - 1) * this.shake.magnitude * decay;
        const dy = (Math.random() * 2 - 1) * this.shake.magnitude * decay;
        this.render.canvas.style.transform = `translate(${dx.toFixed(
          1
        )}px, ${dy.toFixed(1)}px)`;
      } else {
        this.render.canvas.style.transform = "";
        this.shake = null;
      }
    }
  }

  private drawOverlays() {
    const now = performance.now();
    const dt =
      this.lastFrameTime > 0 ? Math.min(100, now - this.lastFrameTime) : 16;
    this.lastFrameTime = now;
    this.updateVfx(dt);

    const ctx = this.render.context;
    const bodies = Matter.Composite.allBodies(this.world) as TaggedBody[];

    // Static atmosphere (moon/stars/stones/branches) lives on the page
    // background image. Here we only draw the animated game-UI layers on
    // top of the transparent canvas.
    this.drawLanternFrame(ctx);
    if (this.atmosphere) {
      this.atmosphere.update(dt);
      this.drawMist(ctx);
      this.atmosphere.draw(ctx);
    } else {
      this.drawMist(ctx);
    }

    // Flashes — white glow behind spawning ball
    for (const f of this.flashes) {
      const t = f.life / f.maxLife;
      const radius = 20 + 40 * t;
      const alpha = 0.8 * (1 - t);
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(f.x, f.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Yokai sprites — drawn manually (Matter render is disabled for yokai).
    // Bodies with an active spawn-anim get an elastic overshoot scale.
    // Rotation comes from body.angle.
    for (const body of bodies) {
      if (!body.yokaiId) continue;
      const yokai = getYokai(body.yokaiId);
      if (!yokai) continue;
      const anim = this.spawnAnims.get(body.id);

      // Spawn overshoot ease: 0.5 → 1.15 (first 70%) → 1.0 (last 30%)
      let spawnScale = 1;
      if (anim) {
        const p = Math.min(1, anim.life / anim.maxLife);
        if (p < 0.7) spawnScale = 0.5 + (p / 0.7) * 0.65;
        else spawnScale = 1.15 - ((p - 0.7) / 0.3) * 0.15;
      }

      const baseSize = yokai.radius * 2.2;
      const pos = body.position;
      const img = this.spriteCache.get(yokai.id);
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(body.angle);
      if (spawnScale !== 1) ctx.scale(spawnScale, spawnScale);
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, -baseSize / 2, -baseSize / 2, baseSize, baseSize);
      } else {
        // Fallback while sprite is still loading
        ctx.fillStyle = yokai.color;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, yokai.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    // Game-over line — warm gold, dashed, with a soft pulsing glow that
    // ties into the HUD palette instead of reading as a web "warning".
    // Opacity swings between ~0.55 and ~0.95 over a 2.2s cycle (sine),
    // and a shadowBlur of 8 gives a halo without needing a second pass.
    ctx.save();
    const pulse = 0.75 + Math.sin(performance.now() / 350) * 0.2;
    ctx.strokeStyle = `rgba(200, 160, 74, ${pulse})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 7]);
    ctx.shadowColor = "#c8a04a";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(PLAY_OFFSET_X, GAME_OVER_LINE_Y);
    ctx.lineTo(PLAY_OFFSET_X + GAME_WIDTH, GAME_OVER_LINE_Y);
    ctx.stroke();
    ctx.restore();

    if (!this.gameOver) {
      // Thinner, more transparent vertical guide line
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(this.dropX, 0);
      ctx.lineTo(this.dropX, CANVAS_HEIGHT);
      ctx.stroke();
      ctx.restore();

      // Ghost preview — sprite at 0.3 opacity
      const y = this.currentYokai;
      const size = y.radius * 2.2;
      const img = this.spriteCache.get(y.id);
      ctx.save();
      ctx.globalAlpha = 0.3;
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(
          img,
          this.dropX - size / 2,
          SPAWN_Y - size / 2,
          size,
          size
        );
      } else {
        ctx.fillStyle = y.color;
        ctx.beginPath();
        ctx.arc(this.dropX, SPAWN_Y, y.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
    }

    // Particles — gold spray on top
    for (const p of this.particles) {
      const t = p.life / p.maxLife;
      const alpha = Math.max(0, 1 - t);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Combo text — COMBO ×N, fade in, drift up, fade out
    if (this.combo) {
      const t = this.combo.life / this.combo.maxLife;
      let alpha: number;
      if (t < 0.15) alpha = t / 0.15;
      else if (t > 0.6) alpha = Math.max(0, 1 - (t - 0.6) / 0.4);
      else alpha = 1;
      const cx = PLAY_OFFSET_X + GAME_WIDTH / 2;
      const cy = PLAY_OFFSET_Y + GAME_HEIGHT / 2 - 30 * t;
      const mainSize = 32 + this.combo.count * 4;
      const multSize = Math.floor(mainSize * 0.6);
      const mainText = "COMBO";
      const multText = `×${this.combo.count}`;

      const drawLayered = (
        text: string,
        x: number,
        y: number,
        size: number
      ) => {
        ctx.font = `bold ${size}px Georgia, "Times New Roman", serif`;
        // Soft drop shadow (offset +2, +2)
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fillText(text, x + 2, y + 2);
        // Thin dark-gold stroke for legibility on any background
        ctx.strokeStyle = "#8a6f28";
        ctx.lineWidth = 1.5;
        ctx.strokeText(text, x, y);
        // Main gold fill
        ctx.fillStyle = "#f6c343";
        ctx.fillText(text, x, y);
      };

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      drawLayered(mainText, cx, cy, mainSize);
      drawLayered(multText, cx, cy + mainSize * 0.75, multSize);

      // Decorative thin gold lines above and below the COMBO word
      ctx.strokeStyle = "rgba(200, 168, 78, 0.4)";
      ctx.lineWidth = 1;
      const lineHalfWidth = mainSize * 1.6;
      const lineOffset = mainSize * 0.65;
      ctx.beginPath();
      ctx.moveTo(cx - lineHalfWidth, cy - lineOffset);
      ctx.lineTo(cx + lineHalfWidth, cy - lineOffset);
      ctx.moveTo(cx - lineHalfWidth, cy + lineOffset);
      ctx.lineTo(cx + lineHalfWidth, cy + lineOffset);
      ctx.stroke();
      ctx.restore();
    }
  }

  setDropX(x: number) {
    const r = this.currentYokai.radius;
    const minX = PLAY_OFFSET_X + r;
    const maxX = PLAY_OFFSET_X + GAME_WIDTH - r;
    this.dropX = Math.max(minX, Math.min(maxX, x));
  }

  drop() {
    if (this.gameOver) {
      console.log("[GameEngine] drop ignored: gameOver");
      return;
    }
    const now = performance.now();
    if (now - this.lastDropTime < DROP_COOLDOWN_MS) {
      console.log("[GameEngine] drop ignored: cooldown");
      return;
    }
    this.lastDropTime = now;
    console.log("[GameEngine] drop", {
      x: this.dropX,
      yokaiId: this.currentYokai.id,
    });

    const body = this.createYokaiBody(this.dropX, SPAWN_Y, this.currentYokai);
    this.addBodyWithGrace(body);
    Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.05);
    this.markReached(this.currentYokai.id);
    this.audio.playDrop();

    this.currentYokai = this.nextYokai;
    this.nextYokai = getRandomSpawnable();
    this.callbacks.onNextChange?.(this.currentYokai, this.nextYokai);
  }

  restart() {
    const bodies = Matter.Composite.allBodies(this.world) as TaggedBody[];
    for (const body of bodies) {
      if (body.yokaiId) Matter.World.remove(this.world, body);
    }
    this.merging.clear();
    this.droppedBodies.clear();
    this.dangerSince.clear();
    this.particles.length = 0;
    this.flashes.length = 0;
    this.spawnAnims.clear();
    this.combo = null;
    this.comboCount = 0;
    this.lastMergeTime = 0;
    this.shake = null;
    this.render.canvas.style.transform = "";
    this.score = 0;
    this.lastDropTime = 0;
    this.gameOver = false;
    this.reached.clear();
    this.currentYokai = getRandomSpawnable();
    this.nextYokai = getRandomSpawnable();
    this.callbacks.onScoreChange?.(this.score, this.highScore);
    this.callbacks.onNextChange?.(this.currentYokai, this.nextYokai);
    this.callbacks.onReachedChange?.([]);
  }

  getCanvas(): HTMLCanvasElement {
    return this.render.canvas;
  }

  unlockAudio() {
    const wasUnlocked = this.bgmStarted;
    this.audio.unlock();
    if (!wasUnlocked) {
      this.bgmStarted = true;
      this.audio.playBGM("/bgm.mp3");
    }
  }

  setMuted(muted: boolean) {
    this.audio.setMuted(muted);
  }

  isMuted(): boolean {
    return this.audio.isMuted();
  }

  setSoundEnabled(enabled: boolean) {
    this.audio.setSoundEnabled(enabled);
  }

  isSoundEnabled(): boolean {
    return this.audio.isSoundEnabled();
  }

  setMusicEnabled(enabled: boolean) {
    this.audio.setMusicEnabled(enabled);
  }

  isMusicEnabled(): boolean {
    return this.audio.isMusicEnabled();
  }

  setSfxMuted(muted: boolean) {
    this.audio.setSfxMuted(muted);
  }

  isSfxMuted(): boolean {
    return this.audio.isSfxMuted();
  }

  setBgmMuted(muted: boolean) {
    this.audio.setBgmMuted(muted);
  }

  isBgmMuted(): boolean {
    return this.audio.isBgmMuted();
  }

  pause() {
    Matter.Runner.stop(this.runner);
  }

  resume() {
    Matter.Runner.run(this.runner, this.engine);
  }

  // ─────────────────────────────── Dev-mode helpers ───────────────
  // These are the only runtime API additions for the dev-testing panel.
  // Normal gameplay never calls them. God mode is a simple flag checked
  // at the top of checkGameOver(); the other methods reuse internal
  // helpers (createYokaiBody, addBodyWithGrace, markUnlocked).

  /** Drop a specific yokai into the field, bypassing cooldown and
   *  next-yokai rotation. Spawns at canvas horizontal centre. */
  spawnYokaiById(id: number) {
    const yokai = getYokai(id);
    if (!yokai) return;
    const body = this.createYokaiBody(CANVAS_WIDTH / 2, SPAWN_Y, yokai);
    this.addBodyWithGrace(body);
    Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.05);
  }

  /** Remove every yokai body from the field without resetting score,
   *  high score, or game-over state. Clears collision/merge bookkeeping
   *  so freshly-spawned bodies don't collide with ghost ids. */
  clearField() {
    const bodies = Matter.Composite.allBodies(this.world) as TaggedBody[];
    for (const body of bodies) {
      if (body.yokaiId) Matter.World.remove(this.world, body);
    }
    this.merging.clear();
    this.droppedBodies.clear();
    this.dangerSince.clear();
    this.spawnAnims.clear();
  }

  setGodMode(enabled: boolean) {
    this.godMode = enabled;
  }

  isGodMode(): boolean {
    return this.godMode;
  }

  /** Mark all 11 yokai as unlocked in persistent storage + notify. */
  unlockAll() {
    for (let id = 1; id <= 11; id++) this.markUnlocked(id);
  }

  destroy() {
    this.audio.stopBGM();
    Matter.Render.stop(this.render);
    Matter.Runner.stop(this.runner);
    Matter.World.clear(this.world, false);
    Matter.Engine.clear(this.engine);
    this.render.canvas.remove();
    this.render.textures = {};
  }
}
