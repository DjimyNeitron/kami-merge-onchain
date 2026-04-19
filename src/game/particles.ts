// Seasonal particle pool. Abstract base + four concrete types + a system
// that manages spawning and drawing. On season change the primary kind
// swaps, but particles already in flight keep falling so the transition
// feels organic. Fireflies are always present (ambient) — the multiplier
// just changes how many.

import type { ParticleKind } from "./seasons";
import { MAX_PARTICLES } from "./seasons";

/** 60fps reference frame, used to scale per-frame motion by actual dt. */
const FRAME_MS = 16.67;

export abstract class Particle {
  abstract update(dt: number): void;
  abstract draw(ctx: CanvasRenderingContext2D): void;
  abstract isAlive(): boolean;
}

// ───────────────────────────────────────────── SakuraPetal ──

export class SakuraPetal extends Particle {
  private static COLORS = ["#ffb7c5", "#ff9eb5", "#ffc1cc"];
  private x: number;
  private y: number;
  private vy: number;
  private swayPhase: number;
  private swaySpeed: number;
  private swayAmp: number;
  private angle: number;
  private angVel: number;
  private size: number;
  private color: string;
  private alpha: number;
  private canvasHeight: number;
  private alive = true;

  constructor(canvasWidth: number, canvasHeight: number, fromTop = true) {
    super();
    this.canvasHeight = canvasHeight;
    this.x = Math.random() * canvasWidth;
    this.y = fromTop ? -10 - Math.random() * 50 : Math.random() * canvasHeight;
    this.vy = 0.3 + Math.random() * 0.3;
    this.swayPhase = Math.random() * Math.PI * 2;
    this.swaySpeed = 0.015 + Math.random() * 0.02;
    this.swayAmp = 3 + Math.random() * 5;
    this.angle = Math.random() * Math.PI * 2;
    this.angVel = (Math.random() - 0.5) * 0.03;
    this.size = 3 + Math.random() * 3;
    this.color =
      SakuraPetal.COLORS[Math.floor(Math.random() * SakuraPetal.COLORS.length)];
    this.alpha = 0.3 + Math.random() * 0.2;
  }

  update(dt: number): void {
    const f = dt / FRAME_MS;
    this.y += this.vy * f;
    this.swayPhase += this.swaySpeed * f;
    this.angle += this.angVel * f;
    if (this.y - this.size > this.canvasHeight) this.alive = false;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const drawX = this.x + Math.sin(this.swayPhase) * this.swayAmp;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.translate(drawX, this.y);
    ctx.rotate(this.angle);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, this.size, this.size * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  isAlive(): boolean {
    return this.alive;
  }
}

// ───────────────────────────────────────────── Firefly ──

export class Firefly extends Particle {
  private x: number;
  private y: number;
  private vx: number;
  private vy: number;
  private r: number;
  private phase: number;
  private phaseSpeed: number;
  private life = 0;
  private maxLife: number;
  private fadeIn = 2000;
  private fadeOut = 2000;
  private canvasWidth: number;
  private canvasHeight: number;
  private alive = true;

  constructor(cw: number, ch: number) {
    super();
    this.canvasWidth = cw;
    this.canvasHeight = ch;
    this.x = Math.random() * cw;
    this.y = Math.random() * ch;
    this.vx = (Math.random() - 0.5) * 0.3;
    this.vy = (Math.random() - 0.5) * 0.3;
    this.r = 1 + Math.random();
    this.phase = Math.random() * Math.PI * 2;
    this.phaseSpeed = 0.003 + Math.random() * 0.003;
    this.maxLife = 15000 + Math.random() * 15000;
  }

  update(dt: number): void {
    const f = dt / FRAME_MS;
    this.x += this.vx * f;
    this.y += this.vy * f;
    if (this.x < 0 || this.x > this.canvasWidth) this.vx = -this.vx;
    if (this.y < 0 || this.y > this.canvasHeight) this.vy = -this.vy;
    this.phase += this.phaseSpeed * f;
    this.life += dt;
    if (this.life >= this.maxLife) this.alive = false;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const twinkle = 0.3 + 0.4 * (0.5 + 0.5 * Math.sin(this.phase));
    let env = 1;
    if (this.life < this.fadeIn) env = this.life / this.fadeIn;
    else if (this.life > this.maxLife - this.fadeOut)
      env = Math.max(0, (this.maxLife - this.life) / this.fadeOut);
    const alpha = twinkle * env;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#f6c343";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha * 0.3;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  isAlive(): boolean {
    return this.alive;
  }
}

// ───────────────────────────────────────────── MapleLeaf ──

export class MapleLeaf extends Particle {
  private static COLORS = ["#d14d2a", "#e07138", "#c23a1c", "#eb9c4a"];
  private x: number;
  private y: number;
  private vy: number;
  private swayPhase: number;
  private swaySpeed: number;
  private swayAmp: number;
  private angle: number;
  private angVel: number;
  private size: number;
  private color: string;
  private alpha: number;
  private canvasHeight: number;
  private alive = true;

  constructor(cw: number, ch: number, fromTop = true) {
    super();
    this.canvasHeight = ch;
    this.x = Math.random() * cw;
    this.y = fromTop ? -10 - Math.random() * 50 : Math.random() * ch;
    this.vy = 0.4 + Math.random() * 0.4;
    this.swayPhase = Math.random() * Math.PI * 2;
    this.swaySpeed = 0.02 + Math.random() * 0.03;
    this.swayAmp = 5 + Math.random() * 8;
    this.angle = Math.random() * Math.PI * 2;
    this.angVel = (Math.random() - 0.5) * 0.08;
    this.size = 4 + Math.random() * 4;
    this.color =
      MapleLeaf.COLORS[Math.floor(Math.random() * MapleLeaf.COLORS.length)];
    this.alpha = 0.4 + Math.random() * 0.3;
  }

  update(dt: number): void {
    const f = dt / FRAME_MS;
    this.y += this.vy * f;
    this.swayPhase += this.swaySpeed * f;
    this.angle += this.angVel * f;
    if (this.y - this.size > this.canvasHeight) this.alive = false;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const dx = this.x + Math.sin(this.swayPhase) * this.swayAmp;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.translate(dx, this.y);
    ctx.rotate(this.angle);
    // Leaf body — elongated ellipse with a darker midrib
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, this.size * 1.1, this.size * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(60, 20, 10, 0.35)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-this.size * 1.1, 0);
    ctx.lineTo(this.size * 1.1, 0);
    ctx.stroke();
    ctx.restore();
  }

  isAlive(): boolean {
    return this.alive;
  }
}

// ───────────────────────────────────────────── Snowflake ──

export class Snowflake extends Particle {
  private x: number;
  private y: number;
  private vy: number;
  private swayPhase: number;
  private swaySpeed: number;
  private swayAmp: number;
  private size: number;
  private alpha: number;
  private canvasHeight: number;
  private alive = true;

  constructor(cw: number, ch: number, fromTop = true) {
    super();
    this.canvasHeight = ch;
    this.x = Math.random() * cw;
    this.y = fromTop ? -5 - Math.random() * 30 : Math.random() * ch;
    this.vy = 0.15 + Math.random() * 0.25;
    this.swayPhase = Math.random() * Math.PI * 2;
    this.swaySpeed = 0.01 + Math.random() * 0.015;
    this.swayAmp = 4 + Math.random() * 6;
    this.size = 1.5 + Math.random() * 2;
    this.alpha = 0.6 + Math.random() * 0.35;
  }

  update(dt: number): void {
    const f = dt / FRAME_MS;
    this.y += this.vy * f;
    this.swayPhase += this.swaySpeed * f;
    if (this.y - this.size > this.canvasHeight) this.alive = false;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const dx = this.x + Math.sin(this.swayPhase) * this.swayAmp;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(dx, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    // Soft halo
    ctx.globalAlpha = this.alpha * 0.25;
    ctx.beginPath();
    ctx.arc(dx, this.y, this.size * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  isAlive(): boolean {
    return this.alive;
  }
}

// ───────────────────────────────────────────── ParticleSystem ──

/**
 * Owns the active particle pool and spawns new particles at time-based
 * rates. Fireflies always spawn (scaled by multiplier). The primary
 * seasonal particle also spawns when its kind isn't "firefly".
 */
export class ParticleSystem {
  /** Base particles per second per kind. */
  private static RATES: Record<ParticleKind, number> = {
    sakura: 0.8,
    firefly: 0.3,
    maple_leaf: 0.6,
    snowflake: 1.2,
  };

  private particles: Particle[] = [];
  private canvasWidth: number;
  private canvasHeight: number;
  private maxCount: number;

  private primaryKind: ParticleKind = "sakura";
  private fireflyMultiplier = 1;

  /** Fractional "carry-over" of unspawned particles per kind. */
  private debt: Record<ParticleKind, number> = {
    sakura: 0,
    firefly: 0,
    maple_leaf: 0,
    snowflake: 0,
  };

  constructor(cw: number, ch: number, maxCount = MAX_PARTICLES) {
    this.canvasWidth = cw;
    this.canvasHeight = ch;
    this.maxCount = maxCount;
    // Seed a few fireflies so the scene isn't empty on first render
    for (let i = 0; i < 8; i++) {
      this.particles.push(new Firefly(cw, ch));
    }
  }

  /** Switch the season's primary particle + firefly density. */
  setSeason(primary: ParticleKind, fireflyMultiplier: number) {
    this.primaryKind = primary;
    this.fireflyMultiplier = fireflyMultiplier;
    // Reset debt so old accumulation doesn't burst-spawn in the new season
    this.debt = { sakura: 0, firefly: 0, maple_leaf: 0, snowflake: 0 };
  }

  /** Resize canvas bounds (for future responsive use). */
  setCanvasSize(cw: number, ch: number) {
    this.canvasWidth = cw;
    this.canvasHeight = ch;
  }

  private make(kind: ParticleKind): Particle {
    switch (kind) {
      case "sakura":
        return new SakuraPetal(this.canvasWidth, this.canvasHeight, true);
      case "firefly":
        return new Firefly(this.canvasWidth, this.canvasHeight);
      case "maple_leaf":
        return new MapleLeaf(this.canvasWidth, this.canvasHeight, true);
      case "snowflake":
        return new Snowflake(this.canvasWidth, this.canvasHeight, true);
    }
  }

  update(dt: number) {
    // Guard against garbage dt (e.g. very first tick or a tab-switch spike)
    const safeDt = typeof dt === "number" && dt > 0 ? Math.min(dt, 100) : 16;
    const dtSec = safeDt / 1000;

    // Accumulate spawn debt for fireflies (always) and the seasonal kind
    this.debt.firefly +=
      ParticleSystem.RATES.firefly * this.fireflyMultiplier * dtSec;
    if (this.primaryKind !== "firefly") {
      this.debt[this.primaryKind] +=
        ParticleSystem.RATES[this.primaryKind] * dtSec;
    }

    const spawn = (k: ParticleKind) => {
      while (this.debt[k] >= 1 && this.particles.length < this.maxCount) {
        this.particles.push(this.make(k));
        this.debt[k] -= 1;
      }
      // Cap debt so a backgrounded tab doesn't burst-spawn on return
      if (this.debt[k] > 2) this.debt[k] = 2;
    };
    spawn("firefly");
    if (this.primaryKind !== "firefly") spawn(this.primaryKind);

    // Advance every live particle, then compact the array. Filter-based
    // prune keeps the array dense — no null holes to trip over later.
    for (const p of this.particles) {
      if (!p) continue;
      p.update(safeDt);
    }
    this.particles = this.particles.filter((p) => p && p.isAlive());
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      if (!p) continue;
      p.draw(ctx);
    }
  }

  /** For diagnostics / tests. */
  get count(): number {
    return this.particles.length;
  }
}
