import { useSyncExternalStore } from "react";

// The device-orientation half of this component's pointer effects:
// `holographic`, `tilt` and `chipReflection` all read a position signal.
// On a phone there is no pointer, so without this module all three would
// sit at their resting visual.
//
// WHAT THIS MODULE DELIBERATELY DOES NOT DO: prompt. iOS gates
// `deviceorientation` behind a permission whose prompt is ONE SHOT and
// remembered per origin, so where it is spent matters more than anything
// technical here. Asking from inside the card would spend it on the tap
// that opens the keyboard mid card-entry -- the moment a reflexive Deny
// is both most likely and unrecoverable. So the component never calls
// `requestIncrediCardMotionAccess` itself; your app asks once, early (at
// first sign-in, say), and this module notices when access arrives.
//
// The signal is expressed as a VIRTUAL POINTER POSITION -- an `{x, y}` in
// the same -0.5..0.5, center-origin space `useIncrediCardTilt` derives
// from a real pointer -- rather than as three per-effect orientation
// mappings. That is the load-bearing decision in this file. Each effect's
// mapping from position to its visual is tuned against a real cursor, and
// reusing those mappings unchanged means device response cannot drift
// from pointer response, and the only orientation-specific logic is the
// single orientation->position step below rather than three of them.

// ---------------------------------------------------------------------
// The math (pure, and exported for its own test -- the unit runner's
// environment is "node", so nothing below may touch a DOM).
// ---------------------------------------------------------------------

export type IncrediCardOffset = {
  /** -0.5 at the left edge, 0 at center, 0.5 at the right edge. */
  x: number;
  /** -0.5 at the top edge, 0 at center, 0.5 at the bottom edge. */
  y: number;
};

export type IncrediCardOrientationSample = {
  /** Front-to-back tilt, degrees. `null` on a device without the sensor. */
  beta: number | null;
  /** Left-to-right tilt, degrees. `null` on a device without the sensor. */
  gamma: number | null;
};

// How far the device has to tilt from its resting posture to drive an
// effect to its own full extent. 22deg is a deliberate choice about wrist
// comfort rather than a sensor limit: a phone held while typing a card
// number is already at some arbitrary angle, and the useful gesture is a
// small wrist roll, not a full rotation. Anything much larger makes the
// effects feel unresponsive; much smaller makes them twitch under normal
// hand tremor, which is what the smoothing below is separately for.
export const INCREDICARD_ORIENTATION_RANGE_DEG = 22;

// The VERTICAL axis gets a shorter range than the horizontal one, and the
// asymmetry is the point rather than an oversight.
//
// With both axes at the same range, the card responds to left-right roll
// but reads as dead top-to-bottom. The reason is ergonomic, not
// arithmetic. Rolling a phone side to side barely changes what you can
// see, so the full 22deg is easy to reach while watching the card.
// Pitching it top-away tilts the screen out of your face -- you run out
// of viewing angle before you run out of range, so the vertical axis only
// ever gets driven through a fraction of its travel and looks inert next
// to the horizontal one.
//
// A shorter range means less gesture is needed for the same visual
// response.
//
// 8 is tuned by hand on a real phone, not calculated: the right value
// depends on how far a wrist can pitch while the screen stays readable,
// which is not something this file can derive. Larger values (12, say)
// still read as subtler than the pointer gives.
//
// At 8deg the vertical axis is nearly three times more responsive per
// degree than the horizontal one. That sounds extreme stated as a ratio
// and is correct as a gesture: the two directions cost a completely
// different amount of movement to perform while still looking at the
// card. The smoothing below is what keeps this from twitching under
// normal hand tremor at the shorter range.
//
// Applied AFTER the screen-angle remap, deliberately. "Vertical" here
// means vertical to the person looking at the screen, not a fixed device
// axis -- in landscape the remap swaps which sensor feeds it, and the
// awkward direction is still the one that tips the screen away.
//
// The DeviceTilt story's `peak |x| / |y|` row is how to retune this: tilt
// as far as is comfortable each way and compare the two peaks.
export const INCREDICARD_ORIENTATION_PITCH_RANGE_DEG = 8;

// Exponential smoothing factor, applied per event. `deviceorientation`
// fires at roughly 60Hz and its raw values are noisy enough that writing
// them straight to a CSS custom property reads as jitter rather than
// motion -- unlike a pointer, which the OS has already smoothed. 0.18
// settles in ~15 events (a quarter second) while still filtering tremor.
export const INCREDICARD_ORIENTATION_SMOOTHING = 0.18;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Screen angle remapping. `beta`/`gamma` are reported in the DEVICE's own
// frame, which stops matching the page's frame the moment the phone is
// held sideways: in landscape, a left-right wrist roll shows up on `beta`
// rather than `gamma`, so an unremapped mapping would make the highlight
// travel vertically when the user tilts horizontally.
//
// The four cases below are the standard remapping, reasoned from the
// spec rather than verified on hardware in every orientation. If a real
// device disagrees, this function is the one place to fix, and both
// callers inherit the correction.
function remapForScreenAngle(
  deltaBeta: number,
  deltaGamma: number,
  screenAngle: number,
): { horizontal: number; vertical: number } {
  switch (((screenAngle % 360) + 360) % 360) {
    case 90:
      return { horizontal: deltaBeta, vertical: -deltaGamma };
    case 180:
      return { horizontal: -deltaGamma, vertical: -deltaBeta };
    case 270:
      return { horizontal: -deltaBeta, vertical: deltaGamma };
    default:
      return { horizontal: deltaGamma, vertical: deltaBeta };
  }
}

// Turns one orientation reading into a virtual pointer position, relative
// to a NEUTRAL posture rather than to absolute level.
//
// Relative, because absolute would be wrong for every real holding
// position. A phone read at a desk sits near `beta: 45`, one held up in
// front of a face nearer `beta: 80`, and one flat on a table at `beta: 0`
// -- absolute values would park the effect at a different fixed offset in
// each case, and hard against its own clamp in most of them. Calibrating
// to the first sample makes "however you happen to be holding it right
// now" the center, which is also what makes the effect discoverable: the
// first small wrist roll always does something.
//
// Returns `null` for a sample carrying no angles at all. That is a real
// case, not defensive padding: a desktop browser with no sensor fires
// `deviceorientation` exactly once with `beta`/`gamma` both `null`, and
// treating that as 0 would announce a live signal that will never move.
export function offsetFromOrientation(
  sample: IncrediCardOrientationSample,
  neutral: IncrediCardOrientationSample,
  screenAngle = 0,
  rangeDeg = INCREDICARD_ORIENTATION_RANGE_DEG,
  pitchRangeDeg = INCREDICARD_ORIENTATION_PITCH_RANGE_DEG,
): IncrediCardOffset | null {
  if (sample.beta === null || sample.gamma === null) return null;
  if (neutral.beta === null || neutral.gamma === null) return null;

  // `beta` wraps at +-180 and `gamma` at +-90, so a device turned through
  // a boundary produces a delta of several hundred degrees. Deliberately
  // NOT unwrapped: the clamp below pins such a reading to the edge of the
  // range, which is where a device rotated that far past its neutral
  // posture genuinely belongs. Unwrapping would instead teleport the
  // effect to the opposite extreme.
  const { horizontal, vertical } = remapForScreenAngle(
    sample.beta - neutral.beta,
    sample.gamma - neutral.gamma,
    screenAngle,
  );

  return {
    x: clamp(horizontal / rangeDeg, -1, 1) * 0.5,
    y: clamp(vertical / pitchRangeDeg, -1, 1) * 0.5,
  };
}

export function smoothOffset(
  previous: IncrediCardOffset | null,
  target: IncrediCardOffset,
  factor = INCREDICARD_ORIENTATION_SMOOTHING,
): IncrediCardOffset {
  // No previous reading means this IS the resting position -- easing
  // toward it from an invented origin would produce a visible slide on
  // the first event that no device movement caused.
  if (!previous) return target;
  return {
    x: previous.x + (target.x - previous.x) * factor,
    y: previous.y + (target.y - previous.y) * factor,
  };
}

// ---------------------------------------------------------------------
// The subscription
// ---------------------------------------------------------------------

// Narrow enough that a test can hand in a plain object. The unit runner's
// environment is "node", so the listener lifecycle below is only testable
// at all because the target is a parameter rather than a hardcoded
// `window` -- which is the whole reason this is not written as a hook.
export type IncrediCardOrientationTarget = {
  addEventListener: (type: "deviceorientation", listener: (event: IncrediCardOrientationSample) => void) => void;
  removeEventListener: (type: "deviceorientation", listener: (event: IncrediCardOrientationSample) => void) => void;
};

export type SubscribeToDeviceOrientationOptions = {
  /** Defaults to reading `screen.orientation.angle` when a DOM is present. */
  getScreenAngle?: () => number;
  rangeDeg?: number;
  /** Vertical range; shorter than `rangeDeg` on purpose -- see its constant. */
  pitchRangeDeg?: number;
  smoothing?: number;
};

function defaultScreenAngle(): number {
  if (typeof screen === "undefined") return 0;
  return screen.orientation?.angle ?? 0;
}

// Calls `onOffset` with a smoothed virtual pointer position for every
// usable reading, and never at all if none arrives. Returns its
// unsubscribe function.
//
// "Never at all if none arrives" is the behavior that makes the resting
// visual correct by construction rather than by a second check: on an
// origin iOS has not granted, adding this listener is legal and silent,
// so a card whose permission never came through writes no custom
// property and renders exactly as it does without device tilt.
export function subscribeToDeviceOrientation(
  target: IncrediCardOrientationTarget,
  onOffset: (offset: IncrediCardOffset) => void,
  options: SubscribeToDeviceOrientationOptions = {},
): () => void {
  const { getScreenAngle = defaultScreenAngle, rangeDeg, pitchRangeDeg, smoothing } = options;
  let neutral: IncrediCardOrientationSample | null = null;
  let smoothed: IncrediCardOffset | null = null;

  function handleOrientation(event: IncrediCardOrientationSample) {
    if (event.beta === null || event.gamma === null) return;
    if (!neutral) {
      // The first usable reading defines the resting posture AND emits
      // {0, 0} rather than being swallowed. Consumers read that as "a
      // signal is live now" -- `--incredicard-chip-light-active` in particular
      // is what switches the hologram's glare layers on at all -- so
      // staying silent here would leave the effects dark until the user
      // happened to move, with nothing on screen suggesting they should.
      neutral = { beta: event.beta, gamma: event.gamma };
    }
    const offset = offsetFromOrientation(
      event,
      neutral,
      getScreenAngle(),
      rangeDeg,
      pitchRangeDeg,
    );
    if (!offset) return;
    smoothed = smoothOffset(smoothed, offset, smoothing);
    onOffset(smoothed);
  }

  target.addEventListener("deviceorientation", handleOrientation);
  return () => {
    target.removeEventListener("deviceorientation", handleOrientation);
  };
}

// ---------------------------------------------------------------------
// Permission
// ---------------------------------------------------------------------

export type IncrediCardMotionAccess =
  /** Events will reach the page: either granted, or never gated here. */
  | "granted"
  /** iOS asked and the user said no. Remembered per origin. */
  | "denied"
  /** No orientation sensor API on this device at all. */
  | "unsupported"
  /**
   * The request could not be made: called outside a user gesture, or on
   * an insecure origin. Distinct from "denied" -- nothing was asked, and
   * nothing was spent.
   */
  | "unavailable";

type PermissionCapableDeviceOrientationEvent = {
  requestPermission?: () => Promise<"granted" | "denied">;
};

let motionGranted = false;
const accessListeners = new Set<() => void>();

function markGranted() {
  if (motionGranted) return;
  motionGranted = true;
  // Cards already on screen when the grant lands start responding without
  // a remount. In the usual app-level flow the ask happens long before any
  // card is mounted, but a request triggered from a settings screen can
  // happen with one visible.
  for (const listener of accessListeners) listener();
}

function getRequestPermission(): (() => Promise<"granted" | "denied">) | undefined {
  if (typeof window === "undefined") return undefined;
  const ctor = (window as { DeviceOrientationEvent?: PermissionCapableDeviceOrientationEvent })
    .DeviceOrientationEvent;
  const request = ctor?.requestPermission;
  // Bound, not returned bare. It is a static method on the constructor,
  // and calling a detached reference throws `Illegal invocation` in
  // Safari rather than prompting -- which would surface as "the prompt
  // never appears" on the one platform this whole code path exists for.
  return typeof request === "function" ? request.bind(ctor) : undefined;
}

/**
 * Asks the device for permission to read orientation. Call it from your
 * app's own first-run flow (the Storybook DeviceTilt story calls it from a
 * button). Nothing inside IncrediCard calls it; see this file's header for
 * why.
 *
 * MUST be called synchronously from inside a user-gesture handler. An
 * `await` of anything before this line loses user activation, and iOS
 * then rejects with `NotAllowedError` instead of prompting.
 *
 * Only iOS Safari 13+ gates orientation at all. Everywhere else this
 * resolves `"granted"` immediately without prompting, which is the point
 * of feature-detecting `requestPermission` rather than sniffing for iOS:
 * treating "no requestPermission" as "unsupported" would silently kill
 * the feature across all of Android.
 */
export function requestIncrediCardMotionAccess(): Promise<IncrediCardMotionAccess> {
  // Deliberately not an `async` function. The body would still run
  // synchronously up to its first `await`, so `async` would work -- but
  // the synchronous-call requirement above is the single easiest thing
  // to break here while editing, and a plain promise-returning function
  // makes any `await` that creeps in ahead of the call visible.
  if (typeof window === "undefined" || !("ondeviceorientation" in window)) {
    return Promise.resolve("unsupported");
  }

  const request = getRequestPermission();
  if (!request) {
    markGranted();
    return Promise.resolve("granted");
  }

  let pending: Promise<"granted" | "denied">;
  try {
    pending = request();
  } catch {
    return Promise.resolve("unavailable");
  }

  return pending.then(
    (state) => {
      if (state !== "granted") return "denied";
      markGranted();
      return "granted";
    },
    // Rejects, rather than resolving "denied", when there was no user
    // activation to spend. Nothing was asked, so this is not a refusal.
    () => "unavailable",
  );
}

// ---------------------------------------------------------------------
// Availability, as something an effect can depend on
// ---------------------------------------------------------------------

function getMotionAvailable(): boolean {
  if (typeof window === "undefined") return false;
  if (!("ondeviceorientation" in window)) return false;
  // `deviceorientation` does not fire on an insecure origin, silently.
  // This is the most likely way for the whole feature to look broken
  // during development: a dev server reached from a phone over http:// on
  // a LAN address is not a secure context, so every listener would attach
  // and never hear anything. Checked here so "nothing is listening" is the
  // honest state rather than a hidden one.
  if (!window.isSecureContext) return false;
  // Where iOS gates orientation, a listener attached before the grant
  // hears nothing -- so not attaching is both cheaper and truthful.
  if (getRequestPermission() && !motionGranted) return false;
  return true;
}

function subscribeToMotionAccess(onStoreChange: () => void): () => void {
  accessListeners.add(onStoreChange);
  return () => {
    accessListeners.delete(onStoreChange);
  };
}

// False on the server: it cannot know, and false is the honest default
// (the resting visual, corrected on hydration) rather than a guess that
// would flash an effect off again.
function getServerMotionAvailable(): boolean {
  return false;
}

/**
 * Whether device orientation can reach this page right now. Reactive, so
 * a grant arriving mid-session starts the effects on cards that are
 * already mounted.
 */
export function useIncrediCardMotionAvailable(): boolean {
  return useSyncExternalStore(
    subscribeToMotionAccess,
    getMotionAvailable,
    getServerMotionAvailable,
  );
}
