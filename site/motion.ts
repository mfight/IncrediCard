// How the landing page's cards should move on this device, and the page's
// one request for motion access.
//
// A device with a hovering pointer gets the stage's pointer, replayed as
// mouse moves. A touch device gets the card's own touch signals instead:
// the phone's tilt, once the card can read it, and until then the stage's
// path replayed as a finger dragging across the card (see LiveCard).
//
// The card can read the tilt where the browser doesn't gate it, where the
// motion sensors are already granted (Chrome reports them granted without
// asking), or once iOS has been asked and said yes. iOS asks only from a
// tap, so the page shows a button for it (`MotionButton` in Landing.tsx).
// The component never asks on its own; an app asks once, early, as here.

import { useSyncExternalStore } from "react";
import { requestIncrediCardMotionAccess } from "../src";

export type MotionMode = "pointer" | "drag" | "tilt";

type Sensors = "unknown" | "granted" | "denied";

let sensors: Sensors = "unknown";
let granted = false;
// The question has been put to the person, whatever the answer.
let asked = false;
let queried = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function hasHoverPointer() {
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

function canHearOrientation() {
  return window.isSecureContext && "ondeviceorientation" in window;
}

function requestPermission() {
  return (window as { DeviceOrientationEvent?: { requestPermission?: unknown } }).DeviceOrientationEvent
    ?.requestPermission;
}

// The same check the card makes before it listens to orientation.
function tiltReadable() {
  if (!canHearOrientation() || sensors === "denied") return false;
  return granted || sensors === "granted" || typeof requestPermission() !== "function";
}

function querySensors() {
  if (queried) return;
  queried = true;
  const permissions = navigator.permissions;
  if (typeof permissions?.query !== "function") return;
  Promise.all(
    ["accelerometer", "gyroscope"].map((name) => permissions.query({ name } as unknown as PermissionDescriptor)),
  ).then(
    (statuses) => {
      const update = () => {
        const states = statuses.map((status) => status.state);
        const next: Sensors = states.includes("denied")
          ? "denied"
          : states.every((state) => state === "granted")
            ? "granted"
            : "unknown";
        if (next === sensors) return;
        sensors = next;
        notify();
      };
      update();
      for (const status of statuses) status.addEventListener("change", update);
    },
    // iOS doesn't know these names. Its answer comes from the button.
    () => {},
  );
}

function subscribe(listener: () => void) {
  querySensors();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getMode(): MotionMode {
  if (hasHoverPointer()) return "pointer";
  return tiltReadable() ? "tilt" : "drag";
}

/** How this device's cards follow motion: the stage's pointer, a replayed drag, or the phone's tilt. */
export function useMotionMode(): MotionMode {
  return useSyncExternalStore(subscribe, getMode);
}

function getCanAsk() {
  return !hasHoverPointer() && !asked && canHearOrientation() && !tiltReadable();
}

/** Whether a tap could still turn on the phone's tilt: iOS, not yet asked. */
export function useCanAskForMotion(): boolean {
  return useSyncExternalStore(subscribe, getCanAsk);
}

/** Asks for motion access. Call it straight from the tap's handler, with nothing awaited first. */
export function askForMotion() {
  const pending = requestIncrediCardMotionAccess();
  asked = true;
  notify();
  void pending.then((access) => {
    if (access !== "granted") return;
    granted = true;
    notify();
  });
}
