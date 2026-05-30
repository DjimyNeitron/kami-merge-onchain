// Per-yokai display-scale compensation for GALLERY contexts only.
//
// All 11 sprite PNGs (`/yokai/*.png`) are 512×512, but the visible
// (alpha-bound) content fills the frame at different ratios — kodama
// 80 %, hitodama 99 %, tanuki 48 % (worst outlier), etc. Rendered with
// a uniform `object-fit: contain` box, this makes tanuki appear ~⅔ the
// size of hitodama in the splash chain / settings grid / in-game HUD
// chain.
//
// Compensation = 512 / max(visibleW, visibleH), measured once via
// `magick … -alpha extract -trim -format '%wx%h'`. Apply as a CSS
// `transform: scale(...)` on the `<img>` so the LAYOUT box stays
// fixed (24 / 40 / 48 px) and only the rendered content scales.
//
// DO NOT consume this in `engine.ts` / Matter.js rendering — engine
// draws each sprite at its physics-radius size, where the empty
// padding is part of the visual mass and contributes to the
// "size = the mechanic" feel. This map is GALLERY-only.

import type { YokaiName } from "./yokai";

export const YOKAI_DISPLAY_SCALE: Record<YokaiName, number> = {
  kodama: 1.01,
  hitodama: 1.0,
  tanuki: 1.38,
  kappa: 1.01,
  kitsune: 1.01,
  jorogumo: 1.0,
  tengu: 1.01,
  oni: 1.02,
  raijin: 1.01,
  ryujin: 1.0,
  amaterasu: 1.01,
};

/** Safe lookup that defaults to 1.0 for unknown names (no-op). */
export function yokaiScale(name: string): number {
  return YOKAI_DISPLAY_SCALE[name.toLowerCase() as YokaiName] ?? 1.0;
}
