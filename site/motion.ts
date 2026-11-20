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
// tap, so the page has a "Follow device tilt" switch (`TiltToggle` in
// Landing.tsx): switching it on asks, and switching it off goes back to the
// replayed path. The component never asks on its own; an app asks, as here.

import { useSyncExternalStore } from "react";
import { requestIncrediCardMotionAccess } from "../src";

export type MotionMode = "pointer" | "drag" | "tilt";

type Sensors = "unknown" | "granted" | "denied";

let sensors: Sensors = "unknown";
let granted = false;
// The question has been put to the person, whatever the answer.
let asked = false;
// Waiting on the person's answer.
let asking = false;
// The "Follow device tilt" switch. On by default, so a phone whose tilt the
// card can already read follows it from the start.
let following = true;
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
  return following && tiltReadable() ? "tilt" : "drag";
}

/** How this device's cards follow motion: the stage's pointer, a replayed drag, or the phone's tilt. */
export function useMotionMode(): MotionMode {
  return useSyncExternalStore(subscribe, getMode);
}

export type TiltToggle = "hidden" | "on" | "off";

function getToggle(): TiltToggle {
  if (hasHoverPointer() || !canHearOrientation() || sensors === "denied") return "hidden";
  // Asked and refused: iOS won't ask again, so there's nothing to switch on.
  if (asked && !asking && !tiltReadable()) return "hidden";
  return following && (asking || tiltReadable()) ? "on" : "off";
}

/** The "Follow device tilt" switch: hidden where the phone's tilt can't reach the cards. */
export function useTiltToggle(): TiltToggle {
  return useSyncExternalStore(subscribe, getToggle);
}

/**
 * Turns following the phone's tilt on or off. Turning it on where iOS
 * hasn't been asked yet asks, so call it straight from the tap's handler,
 * with nothing awaited first.
 */
export function setFollowTilt(on: boolean) {
  following = on;
  if (on && !tiltReadable() && !asked) {
    const pending = requestIncrediCardMotionAccess();
    asked = true;
    asking = true;
    void pending.then((access) => {
      asking = false;
      if (access === "granted") granted = true;
      else following = false;
      notify();
    });
  }
  notify();
}
