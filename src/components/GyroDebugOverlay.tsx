"use client";

// GyroDebugOverlay — floating bottom-right HUD that shows the live state
// of the DeviceOrientation hook. Intentionally only rendered from the
// internal demo route (app/dev/nft-cards/DemoClient.tsx), not from any
// production page — the inline styling and bright #0f9 text would be
// out of character on the game splash or the eventual Inventory grid.
//
// Why it exists: PR #20 added DeviceOrientation tilt to NFTCard but
// gave us no way to verify it was actually working on a given device.
// Symptoms ranged from "iOS popup never fires" (permission Cooper-blocked)
// to "Android attached but no events" (some devices report support but
// emit nothing — true on cheap Chromebooks). The overlay surfaces
// permissionState + eventCount + raw β/γ so a single screenshot is
// enough to diagnose what's wrong.
//
// The hook is a module-level singleton (see src/hooks/useGyroTilt.ts),
// so calling useGyroTilt() here doesn't add a second listener — it
// just subscribes to the same shared state every NFTCard subscribes
// to. Permission grants made by the demo's explicit button propagate
// to all consumers instantly.

import { useGyroTilt } from "@/hooks/useGyroTilt";

const containerStyle: React.CSSProperties = {
  position: "fixed",
  bottom: 12,
  right: 12,
  padding: "8px 12px",
  background: "rgba(0, 0, 0, 0.75)",
  color: "#0f9",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
  fontSize: 11,
  borderRadius: 6,
  zIndex: 9999,
  pointerEvents: "none",
  lineHeight: 1.5,
  minWidth: 132,
  // Make the overlay easier to read on busy backgrounds.
  textShadow: "0 0 2px rgba(0,0,0,0.8)",
};

export default function GyroDebugOverlay() {
  const gyro = useGyroTilt();

  return (
    <div style={containerStyle} aria-hidden="true">
      <div>state: {gyro.permissionState}</div>
      <div>events: {gyro.eventCount}</div>
      <div>α: {gyro.alpha.toFixed(1)}°</div>
      <div>β: {gyro.beta.toFixed(1)}°</div>
      <div>γ: {gyro.gamma.toFixed(1)}°</div>
      <div>tiltX: {gyro.rotateX.toFixed(1)}°</div>
      <div>tiltY: {gyro.rotateY.toFixed(1)}°</div>
    </div>
  );
}
