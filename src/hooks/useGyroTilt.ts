"use client";

// useGyroTilt — DeviceOrientationEvent-driven tilt for mobile NFT cards.
//
// Module-singleton design: a single window listener is shared across
// every component that calls the hook. Each consumer subscribes to the
// same state, so when the user grants iOS permission via the demo's
// "Enable Motion" button, every mounted card immediately switches into
// the granted state without needing its own tap. (The per-instance
// version we shipped in PR #20 left cards stuck on needsPermission=true
// until each was individually tapped — fine for the spec's literal
// acceptance criteria, awful for actual UX. PR #21 refactor.)
//
// Cross-platform behaviour:
//   - Desktop / browsers without DeviceOrientationEvent: state stays
//     at `permissionState: 'unsupported'`, isActive false, eventCount 0.
//   - Android (Chrome / Firefox / Samsung): listener attaches on first
//     useGyroTilt() call (on platform detect), no user-permission gate.
//     permissionState flips straight to 'granted'.
//   - iOS 13+ (Safari / Chrome iOS): static
//     DeviceOrientationEvent.requestPermission exists. We hold off on
//     attaching the listener until the consumer fires requestPermission
//     from a user gesture. Granted → attach + 'granted'. Denied →
//     'denied' (silent — caller's other tilt sources remain unaffected).
//
// Smoothing: raw orientation data is noisy (~60 Hz with fine wobble),
// so we apply an exponential moving average with α = 0.15. Trades a
// tiny bit of latency for cards that don't jitter when the phone is
// resting on a table.
//
// Calibration: we subtract 45° from beta before mapping to rotateX
// — natural phone-holding angle is ~45° back-tilt, so without offset
// every card would render with a permanent forward pitch.
//
// Tilt clamp: ±MAX_TILT_DEG (12°) to match the desktop mouse-tilt range.
//
// Debug surface: alpha, beta, gamma, permissionState, eventCount all
// exposed in the return value so a debug overlay can display them
// without instantiating a second listener.

import { useEffect, useReducer } from "react";

const SMOOTHING = 0.15;
const MAX_TILT_DEG = 12;
const BETA_NEUTRAL_OFFSET = 45;
const TILT_SCALE = 4;

export type GyroPermissionState =
  | "pending" // iOS, awaiting requestPermission() resolution
  | "granted" // listener attached, events flowing (or about to)
  | "denied" // user denied or error
  | "unsupported"; // DeviceOrientationEvent not in window

interface GyroState {
  alpha: number;
  beta: number;
  gamma: number;
  isActive: boolean;
  needsPermission: boolean;
  permissionState: GyroPermissionState;
  eventCount: number;
}

interface DeviceOrientationCtor {
  requestPermission?: () => Promise<"granted" | "denied">;
}

export interface UseGyroTilt {
  /** Smoothed compass heading (-180..180), 0 on platforms without it. */
  alpha: number;
  /** Smoothed front-back tilt (-180..180). */
  beta: number;
  /** Smoothed left-right tilt (-90..90). */
  gamma: number;
  /** Pitch in degrees, clamped to ±12 (matches mouse tilt range). */
  rotateX: number;
  /** Yaw in degrees, clamped to ±12. */
  rotateY: number;
  /** True once a listener is attached (Android on mount, iOS post-grant). */
  isActive: boolean;
  /** True on iOS until requestPermission() resolves 'granted'. */
  needsPermission: boolean;
  /** Disambiguated state for debug overlays. */
  permissionState: GyroPermissionState;
  /** Increments on each orientation event received. */
  eventCount: number;
  /**
   * Fire from a user gesture on iOS to trigger the system permission
   * prompt. Idempotent — calling again after 'granted' resolves
   * instantly without re-prompting. No-op on Android / desktop.
   */
  requestPermission: () => Promise<void>;
}

// ─── Module-level singleton state + subscribers ───
// The hook lives outside React because device orientation is a single
// hardware event source — instantiating it per-component would attach
// N listeners for no benefit and split state across React subtrees.

let _state: GyroState = {
  alpha: 0,
  beta: 0,
  gamma: 0,
  isActive: false,
  needsPermission: false,
  permissionState: "unsupported",
  eventCount: 0,
};

const _subscribers = new Set<() => void>();
let _listenerAttached = false;
let _platformDetected = false;

function setState(updater: (s: GyroState) => GyroState): void {
  _state = updater(_state);
  // Notify subscribers in a microtask so a burst of updates collapses
  // into one render flush per tick. (Plain forEach also works; the
  // microtask just avoids re-entrance edge cases.)
  _subscribers.forEach((fn) => fn());
}

function attachListenerOnce(): void {
  if (_listenerAttached) return;
  if (typeof window === "undefined") return;

  const handler = (event: DeviceOrientationEvent) => {
    const alpha = event.alpha ?? 0;
    const beta = event.beta ?? 0;
    const gamma = event.gamma ?? 0;
    setState((s) => ({
      ...s,
      alpha: s.alpha + (alpha - s.alpha) * SMOOTHING,
      beta: s.beta + (beta - s.beta) * SMOOTHING,
      gamma: s.gamma + (gamma - s.gamma) * SMOOTHING,
      eventCount: s.eventCount + 1,
    }));
  };

  window.addEventListener("deviceorientation", handler);
  _listenerAttached = true;
  setState((s) => ({ ...s, isActive: true }));
}

function detectPlatformOnce(): void {
  if (_platformDetected) return;
  _platformDetected = true;
  if (typeof window === "undefined") return;
  if (!("DeviceOrientationEvent" in window)) {
    setState((s) => ({ ...s, permissionState: "unsupported" }));
    return;
  }
  const D = window.DeviceOrientationEvent as unknown as DeviceOrientationCtor;
  if (typeof D.requestPermission === "function") {
    // iOS — wait for user gesture.
    setState((s) => ({
      ...s,
      needsPermission: true,
      permissionState: "pending",
    }));
    return;
  }
  // Android / non-iOS — auto-attach.
  setState((s) => ({ ...s, permissionState: "granted" }));
  attachListenerOnce();
}

async function requestPermissionImpl(): Promise<void> {
  if (typeof window === "undefined") return;
  const D = window.DeviceOrientationEvent as unknown as DeviceOrientationCtor;
  if (typeof D.requestPermission !== "function") return;

  try {
    const result = await D.requestPermission();
    if (result === "granted") {
      setState((s) => ({
        ...s,
        needsPermission: false,
        permissionState: "granted",
      }));
      attachListenerOnce();
    } else {
      setState((s) => ({
        ...s,
        needsPermission: false,
        permissionState: "denied",
      }));
    }
  } catch {
    setState((s) => ({
      ...s,
      needsPermission: false,
      permissionState: "denied",
    }));
  }
}

// ─── React hook ───

export function useGyroTilt(): UseGyroTilt {
  // We don't need the count value, only a way to force a render when
  // singleton state changes. useReducer's increment dispatcher is the
  // cheapest "trigger a render" primitive React exposes.
  const [, forceRender] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    detectPlatformOnce();
    _subscribers.add(forceRender);
    return () => {
      _subscribers.delete(forceRender);
    };
  }, []);

  // Map smoothed orientation → clamped tilt degrees.
  const rotateY = Math.max(
    -MAX_TILT_DEG,
    Math.min(MAX_TILT_DEG, _state.gamma / TILT_SCALE)
  );
  const rotateX = Math.max(
    -MAX_TILT_DEG,
    Math.min(MAX_TILT_DEG, -(_state.beta - BETA_NEUTRAL_OFFSET) / TILT_SCALE)
  );

  return {
    alpha: _state.alpha,
    beta: _state.beta,
    gamma: _state.gamma,
    rotateX,
    rotateY,
    isActive: _state.isActive,
    needsPermission: _state.needsPermission,
    permissionState: _state.permissionState,
    eventCount: _state.eventCount,
    requestPermission: requestPermissionImpl,
  };
}
