// Play zone — the logical gameplay area
export const GAME_WIDTH = 390;
export const GAME_HEIGHT = 600;

// Thick walls to prevent tunneling
export const WALL_THICKNESS = 20;

// Canvas surrounds the play zone with PADDING on all four sides so balls
// never get clipped by canvas edges, even at the largest radius (120px).
export const PADDING = 20;
export const CANVAS_WIDTH = PADDING + GAME_WIDTH + PADDING; // 430
export const CANVAS_HEIGHT = PADDING + GAME_HEIGHT + PADDING; // 640

// Play-zone origin inside the canvas (top-left corner of the play zone)
export const PLAY_OFFSET_X = PADDING; // 20
export const PLAY_OFFSET_Y = PADDING; // 20

// Game-over line — 100px below the play-zone top, in canvas coordinates
export const GAME_OVER_LINE_Y = PLAY_OFFSET_Y + 100; // 120

// Physics
export const GRAVITY = 1.5;
export const BOUNCE = 0.45;
export const FRICTION = 0.5;
export const AIR_FRICTION = 0.01;

// Gameplay
export const DROP_COOLDOWN_MS = 500;
export const GAME_OVER_GRACE_MS = 500;
