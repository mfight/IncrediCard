import { describe, expect, it, vi } from "vitest";
import {
  INCREDICARD_ORIENTATION_PITCH_RANGE_DEG,
  INCREDICARD_ORIENTATION_RANGE_DEG,
  offsetFromOrientation,
  smoothOffset,
  subscribeToDeviceOrientation,
  type IncrediCardOrientationSample,
  type IncrediCardOrientationTarget,
} from "./IncrediCardOrientation";

// What this file can and cannot prove, stated up front so a
// green run is not read as more than it is:
//
// It covers the math and the listener lifecycle -- the two parts that are
// pure logic and would otherwise only ever be checked by holding a phone.
// It cannot cover the part that actually needs hardware: whether tilting
// a real device right moves the highlight right. `remapForScreenAngle`
// and the sign of each axis are reasoned, not observed, and no assertion
// here would change if they were backwards. Final sign-off is a real
// device over HTTPS.
//
// The runner's environment is "node" (vitest.config.ts), so there is no
// `window` to dispatch against. That is why `subscribeToDeviceOrientation`
// takes its target as a parameter: the fake below is the whole reason the
// lifecycle is testable at all.

function makeTarget() {
  const listeners = new Set<(event: IncrediCardOrientationSample) => void>();
  const target: IncrediCardOrientationTarget = {
    addEventListener: (_type, listener) => {
      listeners.add(listener);
    },
    removeEventListener: (_type, listener) => {
      listeners.delete(listener);
    },
  };
  return {
    target,
    get listenerCount() {
      return listeners.size;
    },
    emit(sample: IncrediCardOrientationSample) {
      for (const listener of listeners) listener(sample);
    },
  };
}

const LEVEL = { beta: 40, gamma: 0 };

// The axis remapping negates, so a zero on a flipped axis comes back as
// `-0`, and `toEqual` separates that from `0`. Not worth normalizing in
// the source: every consumer of these numbers either multiplies them or
// interpolates them into a string, and `${-0}` is already `"0"`. Adding
// zero collapses `-0` to `0` and leaves every other value alone.
function normalize(offset: { x: number; y: number } | null) {
  if (!offset) return offset;
  return { x: offset.x + 0, y: offset.y + 0 };
}

describe("offsetFromOrientation", () => {
  it("reads the neutral posture as dead center, whatever angle it is", () => {
    // The point of calibrating rather than using absolute level: a phone
    // at 40deg (held at a desk) and one at 80deg (held up at a face) both
    // start centered, so the first wrist roll always does something.
    expect(offsetFromOrientation(LEVEL, LEVEL)).toEqual({ x: 0, y: 0 });
    const upright = { beta: 80, gamma: -12 };
    expect(offsetFromOrientation(upright, upright)).toEqual({ x: 0, y: 0 });
  });

  it("maps a full-range tilt to the edge of the box", () => {
    const range = INCREDICARD_ORIENTATION_RANGE_DEG;
    expect(
      offsetFromOrientation({ beta: 40, gamma: range }, LEVEL),
    ).toEqual({ x: 0.5, y: 0 });
    expect(
      offsetFromOrientation({ beta: 40 - range, gamma: 0 }, LEVEL),
    ).toEqual({ x: 0, y: -0.5 });
  });

  it("maps half a range to half the extent", () => {
    const half = INCREDICARD_ORIENTATION_RANGE_DEG / 2;
    expect(offsetFromOrientation({ beta: 40, gamma: half }, LEVEL)).toEqual({
      x: 0.25,
      y: 0,
    });
  });

  it("gives the vertical axis its own, shorter range", () => {
    // The two axes are deliberately NOT symmetric: rolling a
    // phone side to side barely moves the screen, while pitching it
    // top-away tilts the screen out of view, so the same number of
    // degrees is much harder to spend vertically. A shorter vertical
    // range buys the same visual response for less gesture.
    //
    // The tests above can't catch a wrong vertical range: every vertical
    // assertion there lands in clamp territory, so the vertical range
    // could be any value at or below the horizontal one and they would
    // all still pass. This test pins it.
    const pitch = INCREDICARD_ORIENTATION_PITCH_RANGE_DEG;
    expect(offsetFromOrientation({ beta: 40 + pitch, gamma: 0 }, LEVEL)).toEqual({
      x: 0,
      y: 0.5,
    });
    expect(offsetFromOrientation({ beta: 40 + pitch / 2, gamma: 0 }, LEVEL)).toEqual({
      x: 0,
      y: 0.25,
    });
    // The two assertions above are self-referential -- they feed the
    // constant into their own input, so they prove the mapping is linear
    // but would pass for ANY pitch value. This one pins which constant
    // actually feeds the vertical axis: the identical delta spent
    // horizontally must NOT reach full travel, because the horizontal
    // range is longer.
    const sideways = offsetFromOrientation({ beta: 40, gamma: pitch }, LEVEL);
    expect(Math.abs(sideways!.x)).toBeLessThan(0.5);
  });

  it("reaches full vertical travel sooner than full horizontal travel", () => {
    // The asymmetry stated as a relationship rather than as two
    // constants, so it survives retuning: whatever the numbers become,
    // an identical tilt must move the vertical axis further.
    expect(INCREDICARD_ORIENTATION_PITCH_RANGE_DEG).toBeLessThan(
      INCREDICARD_ORIENTATION_RANGE_DEG,
    );
    const sameTiltBothWays = { beta: 40 + 8, gamma: 8 };
    const offset = offsetFromOrientation(sameTiltBothWays, LEVEL);
    expect(offset!.y).toBeGreaterThan(offset!.x);
  });

  it("clamps beyond the range instead of running away", () => {
    // A card tipped past full extent stays at full extent. Without the
    // clamp, `tilt` would multiply an unbounded number into a rotation
    // and spin the card right off its own axis.
    const far = { beta: 40, gamma: INCREDICARD_ORIENTATION_RANGE_DEG * 10 };
    expect(offsetFromOrientation(far, LEVEL)).toEqual({ x: 0.5, y: 0 });
  });

  it("pins a wrapped reading to the edge rather than the opposite edge", () => {
    // `beta` wraps at +-180. Deliberately not unwrapped -- a device
    // rotated that far past neutral belongs at the extreme, and
    // unwrapping would teleport it to the other one instead.
    const wrapped = { beta: -179, gamma: 0 };
    const offset = offsetFromOrientation(wrapped, LEVEL);
    expect(offset).toEqual({ x: 0, y: -0.5 });
  });

  it("returns null for a device that reports no angles", () => {
    // A desktop browser with no sensor fires `deviceorientation` once
    // with both null. Treating that as 0 would announce a live signal
    // that never moves again -- the glare layers would fade in and then
    // sit there.
    expect(offsetFromOrientation({ beta: null, gamma: null }, LEVEL)).toBeNull();
    expect(offsetFromOrientation({ beta: 40, gamma: null }, LEVEL)).toBeNull();
  });

  it("swaps the axes in landscape", () => {
    // The gesture that means "tilt right" moves `gamma` in portrait and
    // `beta` in landscape. Unremapped, a horizontal wrist roll would send
    // the highlight vertically.
    const range = INCREDICARD_ORIENTATION_RANGE_DEG;
    const rolledRight = { beta: 40, gamma: range };
    expect(normalize(offsetFromOrientation(rolledRight, LEVEL, 0))).toEqual({ x: 0.5, y: 0 });
    expect(normalize(offsetFromOrientation(rolledRight, LEVEL, 90))).toEqual({ x: 0, y: -0.5 });
    expect(normalize(offsetFromOrientation(rolledRight, LEVEL, 180))).toEqual({ x: -0.5, y: 0 });
    expect(normalize(offsetFromOrientation(rolledRight, LEVEL, 270))).toEqual({ x: 0, y: 0.5 });
  });

  it("normalizes a screen angle outside 0-359", () => {
    const range = INCREDICARD_ORIENTATION_RANGE_DEG;
    const rolledRight = { beta: 40, gamma: range };
    expect(offsetFromOrientation(rolledRight, LEVEL, 360)).toEqual(
      offsetFromOrientation(rolledRight, LEVEL, 0),
    );
    expect(offsetFromOrientation(rolledRight, LEVEL, -90)).toEqual(
      offsetFromOrientation(rolledRight, LEVEL, 270),
    );
  });
});

describe("smoothOffset", () => {
  it("takes the first reading whole", () => {
    // Easing toward the first sample from an invented origin would show
    // a slide on mount that no movement caused.
    const first = { x: 0.4, y: -0.2 };
    expect(smoothOffset(null, first)).toEqual(first);
  });

  it("moves a fraction of the way toward the target", () => {
    expect(smoothOffset({ x: 0, y: 0 }, { x: 1, y: -1 }, 0.25)).toEqual({
      x: 0.25,
      y: -0.25,
    });
  });

  it("converges toward the target without overshooting", () => {
    let current = { x: 0, y: 0 };
    for (let i = 0; i < 60; i += 1) {
      current = smoothOffset(current, { x: 0.5, y: 0.5 }, 0.18);
      expect(current.x).toBeLessThanOrEqual(0.5);
    }
    expect(current.x).toBeCloseTo(0.5, 3);
    expect(current.y).toBeCloseTo(0.5, 3);
  });

  it("damps a single-sample spike", () => {
    // The reason smoothing exists: raw readings carry hand tremor the OS
    // has not filtered, unlike a pointer. One outlier must not throw the
    // card across its full range.
    const settled = { x: 0, y: 0 };
    const spiked = smoothOffset(settled, { x: 0.5, y: 0 }, 0.18);
    expect(spiked.x).toBeCloseTo(0.09, 5);
  });
});

describe("subscribeToDeviceOrientation", () => {
  it("stays silent when no event ever arrives", () => {
    // The case that makes the resting visual correct by construction: on
    // an origin iOS has not granted, the listener attaches and hears
    // nothing, so no custom property is ever written.
    const onOffset = vi.fn();
    const fake = makeTarget();
    subscribeToDeviceOrientation(fake.target, onOffset);
    expect(onOffset).not.toHaveBeenCalled();
  });

  it("emits center on the first usable reading", () => {
    // Not swallowed: consumers read the first emission as "a signal is
    // live now" -- it is what sets --incredicard-chip-light-active, which is
    // what switches the glare layers on at all.
    const onOffset = vi.fn();
    const fake = makeTarget();
    subscribeToDeviceOrientation(fake.target, onOffset);
    fake.emit({ beta: 63, gamma: -4 });
    expect(onOffset).toHaveBeenCalledTimes(1);
    expect(onOffset).toHaveBeenCalledWith({ x: 0, y: 0 });
  });

  it("ignores readings with no angles, and does not calibrate on one", () => {
    const onOffset = vi.fn();
    const fake = makeTarget();
    subscribeToDeviceOrientation(fake.target, onOffset);
    fake.emit({ beta: null, gamma: null });
    expect(onOffset).not.toHaveBeenCalled();
    // The next real reading is still what defines neutral -- had the null
    // one calibrated anything, this would come back off-center.
    fake.emit({ beta: 63, gamma: -4 });
    expect(onOffset).toHaveBeenLastCalledWith({ x: 0, y: 0 });
  });

  it("smooths successive readings rather than passing them through", () => {
    const onOffset = vi.fn();
    const fake = makeTarget();
    subscribeToDeviceOrientation(fake.target, onOffset, { smoothing: 0.5 });
    fake.emit({ beta: 40, gamma: 0 });
    fake.emit({ beta: 40, gamma: INCREDICARD_ORIENTATION_RANGE_DEG });
    // Raw would be 0.5; half-way from 0 is 0.25.
    expect(onOffset).toHaveBeenLastCalledWith({ x: 0.25, y: 0 });
  });

  it("re-reads the screen angle on every event", () => {
    // Rotating the phone mid-gesture has to reach the mapping. A value
    // captured once at subscribe time would leave the axes swapped for
    // as long as the card stayed mounted.
    const onOffset = vi.fn();
    const fake = makeTarget();
    const getScreenAngle = vi.fn(() => 0);
    subscribeToDeviceOrientation(fake.target, onOffset, {
      getScreenAngle,
      smoothing: 1,
    });
    fake.emit({ beta: 40, gamma: 0 });
    getScreenAngle.mockReturnValue(90);
    fake.emit({ beta: 40, gamma: INCREDICARD_ORIENTATION_RANGE_DEG });
    expect(getScreenAngle).toHaveBeenCalledTimes(2);
    expect(onOffset).toHaveBeenLastCalledWith({ x: 0, y: -0.5 });
  });

  it("detaches its listener on unsubscribe, and stops emitting", () => {
    const onOffset = vi.fn();
    const fake = makeTarget();
    const unsubscribe = subscribeToDeviceOrientation(fake.target, onOffset);
    expect(fake.listenerCount).toBe(1);
    unsubscribe();
    expect(fake.listenerCount).toBe(0);
    fake.emit({ beta: 40, gamma: 10 });
    expect(onOffset).not.toHaveBeenCalled();
  });

  it("recalibrates after a resubscribe", () => {
    // An effect re-running (the card's prop toggled, or a permission
    // grant landing) must take the CURRENT posture as neutral. Carrying
    // the old one over would park the effect off-center at rest.
    const onOffset = vi.fn();
    const fake = makeTarget();
    const unsubscribe = subscribeToDeviceOrientation(fake.target, onOffset);
    fake.emit({ beta: 40, gamma: 0 });
    unsubscribe();

    subscribeToDeviceOrientation(fake.target, onOffset);
    fake.emit({ beta: 75, gamma: 18 });
    expect(onOffset).toHaveBeenLastCalledWith({ x: 0, y: 0 });
  });
});
