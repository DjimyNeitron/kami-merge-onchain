"use client";

// useGyroTilt — DeviceOrientationEvent-driven tilt for mobile NFT cards.
//
// Module-singleton design: one shared listener + one shared state record,
// every component that calls the hook subscribes to it. Permission
// granted on iOS via the demo's "Enable Motion" button propagates to all
// mounted cards instantly. (PR #20 used per-instance hooks which left
// each card stuck on needsPermission until tapped individually.)
//
// Lifecycle:
//   - Module load: state initialised with permissionState 'unknown'.
//     We DO NOT touch `window` at this point — module evaluation runs
//     during SSR where `typeof window === 'undefined'` would force us
//     into the 'unsupported' branch and bake that into the SSR HTML.
//     React would then hydrate with 'unsupported' and never re-detect.
//     That was the iOS-stuck-at-'unsupported' bug reported after PR #21.
//   - First component mount: useEffect adds the subscriber FIRST, THEN
//     calls detectAndInitialize. Order matters: detect's notifySubscribers
//     synchronously fires the just-added forceUpdate, so the consumer
//     re-renders with the real detected state in the same tick. If we
//     subscribed AFTER detect, the first component would miss its own
//     init notify and stay stuck at the initial 'unknown'.
//   - Subsequent mounts: detectAndInitialize early-returns via the
//     isInitialized guard. The new subscriber gets added; no extra
//     notify needed because shared state already reflects the platform.
//
// Cross-platform behaviour:
//   - Server / no `window`: permissionState 'unknown', no listener.
//   - Desktop browser w/o DeviceOrientationEvent: 'unsupported'.
//   - Android (auto-permission): listener attaches immediately, state
//     flips to 'granted'. First orientation event then sets eventCount=1.
//   - iOS 13+ (requestPermission gate): 'pending' until requestPermission
//     resolves, then 'granted' or 'denied'.
//
// Tilt-active gate:
//   isActive := permissionState === 'granted' && eventCount > 0
//
// We require at least one event because Android can resolve 'granted'
// instantly via auto-attach, but the first orientation event still
// takes a frame or two. Without the event-count gate, the smoothed
// (alpha, beta, gamma) all sit at 0, and the beta calibration
// (-(0 - 45)/TILT_SCALE = +11.25°) would render every card with a
// permanent forward-tilt "calibration ghost" — the cosmetic glitch
// reported after PR #21. When inactive we return rotateX / rotateY = 0
// outright so consumers' transform writes go to the neutral pose.
//
// Smoothing: EMA with α = 0.15 on β / γ. α (compass) is passed through
// raw — we never use it for tilt, only display.
//
// Tilt clamp: ±MAX_TILT_DEG (12°) to match the desktop mouse-tilt range.

import { useEffect, useReducer } from "react";

const SMOOTHING = 0.15;
const MAX_TILT_DEG = 12;
const BETA_NEUTRAL_OFFSET = 45;
const TILT_SCALE = 4;

export type GyroPermissionState =
  | "unknown" // pre-detection (SSR + first render before useEffect)
  | "pending" // iOS detected, awaiting user gesture
  | "granted" // listener attached
  | "denied" // user denied or error
  | "unsupported"; // DeviceOrientationEvent not available

interface SharedState {
  alpha: number;
  beta: number;
  gamma: number;
  eventCount: number;
  permissionState: GyroPermissionState;
}

interface DeviceOrientationCtor {
  requestPermission?: () => Promise<"granted" | "denied">;
}

export interface UseGyroTilt {
  alpha: number;
  beta: number;
  gamma: number;
  rotateX: number;
  rotateY: number;
  isActive: boolean;
  needsPermission: boolean;
  permissionState: GyroPermissionState;
  eventCount: number;
  requestPermission: () => Promise<void>;
}

// ─── Module-level singleton ───
// Initial state intentionally NEUTRAL — we do not probe `window` here.
// All detection deferred to useEffect on first mount (client-only).

const sharedState: SharedState = {
  alpha: 0,
  beta: 0,
  gamma: 0,
  eventCount: 0,
  permissionState: "unknown",
};

const subscribers = new Set<() => void>();
let listenerAttached = false;
let isInitialized = false;

function notifySubscribers(): void {
  subscribers.forEach((fn) => fn());
}

function handleOrientation(event: DeviceOrientationEvent): void {
  sharedState.alpha = event.alpha ?? 0;
  sharedState.beta =
    sharedState.beta + ((event.beta ?? 0) - sharedState.beta) * SMOOTHING;
  sharedState.gamma =
    sharedState.gamma + ((event.gamma ?? 0) - sharedState.gamma) * SMOOTHING;
  sharedState.eventCount += 1;
  notifySubscribers();
}

function attachListenerOnce(): void {
  if (listenerAttached) return;
  if (typeof window === "undefined") return;
  window.addEventListener("deviceorientation", handleOrientation);
  listenerAttached = true;
}

function detectAndInitialize(): void {
  if (isInitialized) return;
  if (typeof window === "undefined") return; // never fires on server
  isInitialized = true;

  if (!("DeviceOrientationEvent" in window)) {
    sharedState.permissionState = "unsupported";
    notifySubscribers();
    return;
  }

  const D = window.DeviceOrientationEvent as unknown as DeviceOrientationCtor;
  if (typeof D.requestPermission === "function") {
    // iOS — wait for user gesture (the demo's Enable Motion button or
    // any NFTCard onClick fall-through).
    sharedState.permissionState = "pending";
    notifySubscribers();
    return;
  }

  // Android — auto-attach + flip to granted.
  attachListenerOnce();
  sharedState.permissionState = "granted";
  notifySubscribers();
}

async function requestGyroPermission(): Promise<void> {
  if (typeof window === "undefined") return;
  const D = window.DeviceOrientationEvent as unknown as DeviceOrientationCtor;
  if (typeof D.requestPermission !== "function") return;

  try {
    const result = await D.requestPermission();
    if (result === "granted") {
      attachListenerOnce();
      sharedState.permissionState = "granted";
    } else {
      sharedState.permissionState = "denied";
    }
  } catch {
    sharedState.permissionState = "denied";
  }
  notifySubscribers();
}

// ─── React hook ───

export function useGyroTilt(): UseGyroTilt {
  // useReducer's increment dispatcher is the cheapest "force a render"
  // primitive React exposes; we don't actually care about the count.
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    // ORDER MATTERS: subscribe BEFORE detect.
    // detectAndInitialize() synchronously calls notifySubscribers() on
    // first invocation. If forceUpdate is not yet in the subscribers
    // set, the consumer misses its own init signal and stays stuck on
    // the initial 'unknown' state. Subscribing first means the post-
    // init notify finds us and triggers the second render with the
    // real platform state in the same tick. (This was the iOS-stuck-
    // at-'unknown' bug reported after PR #21.)
    subscribers.add(forceUpdate);
    detectAndInitialize();
    return () => {
      subscribers.delete(forceUpdate);
    };
  }, []);

  // Tighter active gate: must be granted AND have received at least
  // one orientation event. See file-level comment for why eventCount=0
  // would otherwise produce the "calibration ghost" +11.25° default.
  const isActive =
    sharedState.permissionState === "granted" && sharedState.eventCount > 0;

  const rotateX = isActive
    ? Math.max(
        -MAX_TILT_DEG,
        Math.min(
          MAX_TILT_DEG,
          -(sharedState.beta - BETA_NEUTRAL_OFFSET) / TILT_SCALE
        )
      )
    : 0;
  const rotateY = isActive
    ? Math.max(
        -MAX_TILT_DEG,
        Math.min(MAX_TILT_DEG, sharedState.gamma / TILT_SCALE)
      )
    : 0;

  return {
    alpha: sharedState.alpha,
    beta: sharedState.beta,
    gamma: sharedState.gamma,
    rotateX,
    rotateY,
    isActive,
    // Derived rather than separately tracked — single source of truth.
    needsPermission: sharedState.permissionState === "pending",
    permissionState: sharedState.permissionState,
    eventCount: sharedState.eventCount,
    requestPermission: requestGyroPermission,
  };
}
