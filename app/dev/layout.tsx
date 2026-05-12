// Route-segment layout for /dev/*. Restores normal document scrolling.
//
// The root layout (app/layout.tsx) targets the game route, which runs
// as a `fixed inset-0` canvas + splash composition that never overflows
// the viewport. To keep that surface pixel-locked, `app/globals.css`
// pins both `html` and `body`:
//
//   html { position: fixed; overflow: hidden; width: 100%; height: 100%; }
//   body { overflow: hidden; height: 100%; ... }
//
// Those rules are correct for `/` (the game). For any *other* route
// — starting with `/dev/nft-cards` — they silently clip everything
// past the first viewport, with no scrollbar to recover. Touching
// globals.css to scope the lock to the game route would be a wider
// refactor (the game depends on those rules through the splash + the
// Matter.js canvas + the GameCanvasLoader chain).
//
// Instead, this segment-level layout emits a <style> block that
// overrides the lock for the entire /dev/* tree. The override uses
// !important because the globals.css rules also have no !important
// — same-specificity later wins, but to insulate the override from
// any future global tightening we force it.
//
// React 19 (the version Next 15 ships with) renders <style> elements
// natively without needing `styled-jsx` or `dangerouslySetInnerHTML`.
// When the user navigates out of /dev/* the layout unmounts, the
// <style> goes with it, and the game route gets its locked viewport
// back automatically.
//
// Background override: the game route paints `bg_game.jpg` (a shrine
// scene) onto body, which would bleed through any translucent dev UI
// and clash with the dark demo grid. Force a flat dark background
// for the segment.

import type { ReactNode } from "react";

const SEGMENT_OVERRIDE = `
  html {
    position: static !important;
    overflow: auto !important;
    height: auto !important;
    width: auto !important;
  }
  body {
    overflow: auto !important;
    height: auto !important;
    min-height: 100vh;
    background: #0a0d22 !important;
  }
`;

export default function DevSegmentLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <style>{SEGMENT_OVERRIDE}</style>
      {children}
    </>
  );
}
