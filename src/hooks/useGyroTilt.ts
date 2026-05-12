"use client";

// useGyroTilt — DeviceOrientationEvent-driven tilt for mobile NFT cards.
//
// Cross-platform behaviour:
//   - Android (Chrome / Firefox / Samsung): listener attaches on mount,
//     no user-permission gate. Reads `event.beta` (front-back tilt) and
//     `event.gamma` (left-right tilt) directly.
//   - iOS 13+ (Safari / Chrome iOS): `DeviceOrientationEvent.requestPermission`
//     exists as a static method. We do NOT auto-attach on mount —
//     instead we expose `needsPermission: true` and a `requestPermission`
//     callback that consumers wire to a user gesture (e.g. first card
//     tap). Granted → listener attaches; denied → silent no-op, the
//     caller's mouse / aurora paths remain unaffected.
//   - Desktop / browsers without DeviceOrientationEvent: hook stays
//     dormant (`isActive: false`, `needsPermission: false`). Callers
//     branch on `isActive` and fall back to their pointer-based tilt.
//
// Smoothing: raw orientation data is noisy (~60 Hz with fine wobble),
// so we apply an exponential moving average with α = 0.15. Trades a
// tiny bit of latency for cards that don't jitter when the phone is
// resting on a table.
//
// Calibration: we subtract 45° from beta before mapping to rotateX,
// because the natural way someone holds a phone vertically while
// looking at a card is ~45° back-tilt — that should read as the card
// being held flat, not tilted forward. Without the offset, every card
// would render with a permanent forward pitch on iOS lock-screen
// orientation.
//
// Tilt range: clamped to ±MAX_TILT_DEG (12°) to match the desktop
// mouse-tilt range, so the visual treatment is consistent across input
// methods.
//
// Listener count: each hook call attaches its OWN window listener.
// For a grid of 44 cards this means 44 listeners + 44 setState calls
// per orientation event. React 18+ batches the setState within one
// event, so the renders all collapse to a single commit per tick.
// We accept the listener-count cost over a more invasive
// singleton-store refactor since the simpler shape matches the spec
// and 44 listeners at 60 Hz is well within browser tolerance.

import { useCallback, useEffect, useRef, useState } from "react";

const SMOOTHING = 0.15;
const MAX_TILT_DEG = 12;
const BETA_NEUTRAL_OFFSET = 45;
const TILT_SCALE = 4; // divisor: gamma 24° → rotateY 6°, beta 24° → rotateX 6°

interface GyroState {
  beta: number;
  gamma: number;
  isActive: boolean;
  needsPermission: boolean;
}

// iOS Safari exposes a static `requestPermission` on the constructor
// itself; standard DOM types don't include it, so we narrow with a
// local interface rather than reaching for `any`.
interface DeviceOrientationCtor {
  requestPermission?: () => Promise<"granted" | "denied">;
}

export interface UseGyroTilt {
  /** Pitch in degrees, clamped to ±12. */
  rotateX: number;
  /** Yaw in degrees, clamped to ±12. */
  rotateY: number;
  /** True once a listener is attached (Android on mount, iOS after grant). */
  isActive: boolean;
  /** True on iOS until requestPermission() resolves 'granted'. */
  needsPermission: boolean;
  /**
   * Fire from a user gesture on iOS to trigger the system permission
   * prompt. No-op on Android / desktop / already-active.
   */
  requestPermission: () => Promise<void>;
}

export function useGyroTilt(): UseGyroTilt {
  const [state, setState] = useState<GyroState>({
    beta: 0,
    gamma: 0,
    isActive: false,
    needsPermission: false,
  });

  // Stable handler — we want the listener wrapper to be the same
  // function reference across renders so addEventListener /
  // removeEventListener pair up cleanly. The handler itself reads
  // through a ref that gets updated each render, but the wrapper
  // never changes.
  const handlerRef = useRef<((e: DeviceOrientationEvent) => void) | null>(
    null
  );
  handlerRef.current = (event: DeviceOrientationEvent) => {
    const beta = event.beta ?? 0; // -180..180 (front-back)
    const gamma = event.gamma ?? 0; // -90..90 (left-right)
    setState((s) => ({
      ...s,
      // Exponential moving average — α = SMOOTHING controls
      // responsiveness vs. jitter. Higher α → snappier, more jitter.
      beta: s.beta + (beta - s.beta) * SMOOTHING,
      gamma: s.gamma + (gamma - s.gamma) * SMOOTHING,
    }));
  };

  const attach = useCallback(() => {
    if (typeof window === "undefined") return () => {};
    const wrapper = (e: DeviceOrientationEvent) => handlerRef.current?.(e);
    window.addEventListener("deviceorientation", wrapper);
    setState((s) => ({ ...s, isActive: true }));
    return () => {
      window.removeEventListener("deviceorientation", wrapper);
    };
  }, []);

  // Mount-time platform probe + auto-attach for Android.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("DeviceOrientationEvent" in window)) return;

    const D = window.DeviceOrientationEvent as unknown as DeviceOrientationCtor;
    const requiresPermission = typeof D.requestPermission === "function";

    if (requiresPermission) {
      // iOS — wait for user gesture via requestPermission below.
      setState((s) => ({ ...s, needsPermission: true }));
      return;
    }

    // Android / non-iOS — auto-attach.
    return attach();
  }, [attach]);

  const requestPermission = useCallback(async () => {
    if (typeof window === "undefined") return;
    const D = window.DeviceOrientationEvent as unknown as DeviceOrientationCtor;
    if (typeof D.requestPermission !== "function") return;

    try {
      const result = await D.requestPermission();
      if (result === "granted") {
        setState((s) => ({ ...s, needsPermission: false }));
        attach();
      }
    } catch {
      // User denied or browser threw — silent failure. Caller's other
      // tilt sources (mouse) and the aurora effect are unaffected.
    }
  }, [attach]);

  // Map smoothed orientation → clamped tilt degrees.
  // - gamma drives Y rotation (the phone roll left/right axis maps
  //   directly to the card's vertical axis as seen by the user).
  // - beta drives X rotation, but inverted: tilting the top of the
  //   phone toward the user (beta decreasing past the 45° neutral)
  //   should tilt the card's top toward us, i.e. negative rotateX.
  const rotateY = Math.max(
    -MAX_TILT_DEG,
    Math.min(MAX_TILT_DEG, state.gamma / TILT_SCALE)
  );
  const rotateX = Math.max(
    -MAX_TILT_DEG,
    Math.min(MAX_TILT_DEG, -(state.beta - BETA_NEUTRAL_OFFSET) / TILT_SCALE)
  );

  return {
    rotateX,
    rotateY,
    isActive: state.isActive,
    needsPermission: state.needsPermission,
    requestPermission,
  };
}
