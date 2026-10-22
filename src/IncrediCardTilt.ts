"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "./reducedMotion";
import {
  smoothOffset,
  subscribeToDeviceOrientation,
  useIncrediCardMotionAvailable,
  type IncrediCardOffset,
} from "./IncrediCardOrientation";

// Attaches a pointermove/pointerleave listener to the returned ref's own
// element--meant to be the whole card's own `.faceWrapper` root, the
// SAME element useIncrediCardChipLight (IncrediCardChip.tsx) already
// tracks for its own, different reason. A separate hook/listener rather
// than folding this into that one--this hook's own concern (rotate the
// whole card in 3D) and the chip/hologram light-tracking concern
// (position a highlight within the card) are different enough, and this
// component prefers small, separate pieces over one hook doing multiple
// unrelated things. IncrediCardFace.tsx/IncrediCardEmbeddedFace.tsx
// merge this hook's ref with useIncrediCardChipLight's via a local
// `mergeRefs` (the same helper IncrediCardMaskedField.tsx uses for the
// identical two-hooks-one-element need)--two listeners on the same
// element cost nothing meaningful and keep each hook's job legible on
// its own.
//
// Writes `--incredicard-tilt-x`/`-y`, already `deg`-suffixed--computed here in
// JS for the same reason IncrediCardChip.tsx's
// `--incredicard-chip-light-rotate` is (see that file's comment): CSS `calc()`
// has no operation converting a plain fraction into a `deg`-typed value,
// so the conversion has to happen before the value ever becomes a custom
// property. Read by the `.flipContainer` rule in
// IncrediCardFace.module.scss and IncrediCardEmbeddedFace.module.scss via
// ordinary CSS custom-property inheritance--no prop, and no re-render,
// ever carries the actual angle between components, the same wiring
// every other pointer-driven effect in this component uses.
//
// Inert (attaches nothing) unless `active` is true--the caller passes
// `tilt` (an opt-in prop, default off). Also inert under
// `prefers-reduced-motion`, checked the same way useIncrediCardChipLight
// checks it (in JS, not a CSS media query--nothing about writing a
// custom property from an event handler is something `@media` alone can
// stop).
//
// `(hover: hover) and (pointer: fine)` is a BRANCH, not a bail-out, for
// the same reason as in useIncrediCardChipLight (see that hook's note).
// The tilt never invents a pointer position on a touch or coarse-pointer
// device. What those devices get instead are real signals: dragging the
// card with a finger (relative to where the press started), and device
// orientation, which is a physical signal about how the device is being
// held. A card that tips as you tip the phone fits this effect's intent
// better than a still one.
//
// `suppressed`--true while any real field anywhere in the component has
// focus (click or keyboard)--freezes the tilt at flat instead of just
// leaving whatever angle the pointer last produced. This is a plain
// boolean handed down from IncrediCard.tsx, not something this hook
// tracks itself: the element this hook's ref attaches to
// (`.faceWrapper`) has no real fields inside it at all in the "stacked"
// layout (IncrediCardFace's entire contract is "purely decorative,
// nothing interactive"--the real fields live elsewhere, as siblings, in
// IncrediCard.tsx's own markup), so a `focusin`/`focusout` listener
// scoped to this element would never fire there. IncrediCard.tsx tracks
// focus once, at the top level where every real field is visible
// regardless of layout, and passes the result down to both
// IncrediCardFace/IncrediCardEmbeddedFace identically.
export function useIncrediCardTilt(active: boolean, suppressed: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const suppressedRef = useRef(suppressed);
  const motionAvailable = useIncrediCardMotionAvailable();

  useEffect(() => {
    suppressedRef.current = suppressed;
    if (!suppressed) return;
    const el = ref.current;
    el?.style.removeProperty("--incredicard-tilt-x");
    el?.style.removeProperty("--incredicard-tilt-y");
  }, [suppressed]);

  useEffect(() => {
    if (!active) return undefined;
    if (prefersReducedMotion()) return undefined;
    const el = ref.current;
    if (!el) return undefined;

    // Maximum tilt in each direction. Noticeably less reads as too
    // subtle; around ±32deg starts to read as too strong.
    const MAX_TILT_DEG = 24;

    // Takes a position already reduced to -0.5..0.5 rather than a raw
    // event, so the pointer path and the orientation path share one
    // mapping. Every sign and magnitude below is tuned against a real
    // cursor; a parallel mapping written for orientation would be free to
    // drift from all of it.
    function writeTilt(offsetX: number, offsetY: number) {
      // X (horizontal): whichever edge is nearer the cursor tips TOWARD
      // the viewer. The sign can't be read off the CSS transform spec
      // alone, since rotateX/rotateY's visual direction also depends on
      // where `perspective` is applied: a bare, unnegated `offsetX * K`
      // puts the FAR edge toward the viewer, so this is negated.
      const tiltY = -offsetX * (MAX_TILT_DEG * 2);
      // Y (vertical): deliberately the OPPOSITE convention from X above.
      // A cursor at the top pushes the card away along the z-axis and a
      // cursor at the bottom pulls it toward the viewer, rather than X's
      // "near edge toward viewer" rule. `-offsetY * K` (matching X's
      // negation, not X's resulting direction) is what produces that: a
      // pointer above center tips the card's top edge AWAY from the
      // viewer (and the bottom edge toward it); a pointer below center
      // does the reverse.
      //
      // When changing these signs, check the rendered result (for
      // example, screenshots at forced `-45deg`/`+45deg` values side by
      // side) rather than `getComputedStyle`: reading `.flipContainer`'s
      // `transform` right after setting the property can return a stale
      // or identity value in automated browser harnesses.
      const tiltX = -offsetY * (MAX_TILT_DEG * 2);
      el!.style.setProperty("--incredicard-tilt-x", `${tiltX}deg`);
      el!.style.setProperty("--incredicard-tilt-y", `${tiltY}deg`);
    }

    function clearTilt() {
      // Removing (not zeroing) lets IncrediCardFace.module.scss's
      // `var(--incredicard-tilt-x, 0deg)` fallback take over--and because
      // `.flipContainer`'s `transform` is already transitioned (the same
      // property the flip itself animates through), the card eases back
      // to its resting state on pointer exit with no separate exit
      // animation to write.
      el!.style.removeProperty("--incredicard-tilt-x");
      el!.style.removeProperty("--incredicard-tilt-y");
    }

    // Two pieces of machinery for the hover path below, both about WHEN
    // the CSS transition may run.
    //
    // `data-tilt-tracking` suppresses `.flipContainer`'s 280ms transition
    // while a pointer is actively driving the card. That transition is
    // for the flip and for easing back to rest; applied to continuous
    // tracking it fights the motion instead of smoothing it, badly enough
    // in desktop Safari that the card barely moves until the pointer
    // stops. See the `[data-tilt-tracking]` rule's comment in the face
    // stylesheets for details.
    //
    // Tracking ends when the easing loop CONVERGES, not on pointer exit,
    // which is what removes the need to coordinate with the flip. The
    // flip control sits on the card, so "flip while the pointer is over
    // it" is the normal case, not an edge case -- but a click happens
    // when the pointer has stopped, by which time the loop has converged
    // and the transition is back. No flip state has to be plumbed in
    // here. An idle timer is the wrong release: it can restore the
    // transition while the ease is still running, and the two then fight
    // over the same property, which is exactly the problem this exists to
    // prevent. Convergence is the honest definition of "no longer
    // tracking" because it is exactly when JS stops writing.
    function beginTracking() {
      el!.setAttribute("data-tilt-tracking", "");
    }

    function endTracking() {
      el!.removeAttribute("data-tilt-tracking");
    }

    // With the transition suppressed, the card would otherwise SNAP to
    // wherever the pointer entered -- and because the hover mapping is
    // absolute, entering at an edge means snapping to full tilt. So the
    // easing moves from CSS into the value, using the same exponential
    // smoothing (`smoothOffset`) the orientation path applies to sensor
    // readings. It behaves identically in every engine, because nothing
    // is relying on how a browser restarts an interrupted transition.
    //
    // A rAF loop rather than smoothing per event, because a pointer stops
    // firing events when it stops moving: per-event smoothing would leave
    // the card permanently short of its target. The loop keeps easing
    // until it converges, then stops.
    const HOVER_SMOOTHING = 0.35;
    let target: IncrediCardOffset | null = null;
    let current: IncrediCardOffset | null = null;
    let frame = 0;

    function tick() {
      frame = 0;
      if (!target) return;
      current = smoothOffset(current, target, HOVER_SMOOTHING);
      writeTilt(current.x, current.y);
      if (
        Math.abs(current.x - target.x) > 0.0005 ||
        Math.abs(current.y - target.y) > 0.0005
      ) {
        frame = requestAnimationFrame(tick);
        return;
      }
      // Converged. Hand the property back to CSS so the flip and the
      // ease-back-to-rest can animate again.
      endTracking();
    }

    function easeToward(x: number, y: number) {
      target = { x, y };
      // Seeded at flat rather than left null on the first move of a
      // gesture. `smoothOffset` returns its target whole when it has no
      // previous value -- right for orientation, where the first sensor
      // reading IS the neutral posture, and wrong here, where the first
      // pointer position is somewhere the card has not reached yet.
      // Without this the card snaps to full tilt on entry, since the CSS
      // transition that would otherwise soften that jump is suppressed.
      if (!current) current = { x: 0, y: 0 };
      beginTracking();
      if (!frame) frame = requestAnimationFrame(tick);
    }

    function stopEasing() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      target = null;
      current = null;
    }

    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      const handlePointerMove = (event: PointerEvent) => {
        // Read via the ref, not the `suppressed` closed-over value--this
        // effect only re-runs when `active` changes, so a plain captured
        // boolean would go stale the moment focus moved after mount.
        if (suppressedRef.current) return;
        const rect = el.getBoundingClientRect();
        // -0.5 (left/top edge) to 0.5 (right/bottom edge), 0 at center--
        // unlike useIncrediCardChipLight's own 0%-100% (a gradient's own
        // coordinate system, naturally origined at the top-left), a tilt
        // needs to know which SIDE of center the pointer is on to rotate
        // the correct way, so center-relative is the natural origin here.
        easeToward(
          (event.clientX - rect.left) / rect.width - 0.5,
          (event.clientY - rect.top) / rect.height - 0.5,
        );
      };

      const handlePointerLeave = () => {
        // Order matters. Tracking has to end BEFORE the properties are
        // cleared, or the removal happens while the transition is still
        // suppressed and the card snaps flat instead of easing back. This
        // hook has no exit animation of its own; it gets one from that
        // transition for free.
        stopEasing();
        endTracking();
        clearTilt();
      };

      el.addEventListener("pointermove", handlePointerMove);
      el.addEventListener("pointerleave", handlePointerLeave);
      return () => {
        el.removeEventListener("pointermove", handlePointerMove);
        el.removeEventListener("pointerleave", handlePointerLeave);
        stopEasing();
        endTracking();
      };
    }

    // Only the HOVER path above uses the easing loop and the tracking
    // attribute. The drag and orientation paths don't need them: the
    // values they write already arrive pre-smoothed or in small
    // per-frame steps, so they don't trigger the transition-fighting
    // artifact the hover path has to work around, and they run smoothly
    // on phones, including in mobile Safari. They can adopt the loop if
    // they ever show the same symptom.

    // Everything below is the NON-HOVER path, reached only when the
    // branch above did not return. That is what keeps this
    // invariant free: hover and drag can never both be writing, because a
    // device either has a fine pointer or it does not.
    //
    // Drag and ORIENTATION can coexist, though -- a phone has a finger and
    // a sensor at once -- so the `dragging` flag below is what keeps a
    // single writer. It is checked inside the orientation callback rather
    // than by unsubscribing, so the sensor's own smoothing keeps tracking
    // through the drag and hands back a current value on release instead
    // of a stale one.
    let dragging = false;
    let dragPointerId: number | null = null;
    let originX = 0;
    let originY = 0;

    // Below this, a press is a tap. Above it, a drag. 8px is the usual
    // slop allowance for a finger that does not mean to move.
    const DRAG_THRESHOLD_PX = 8;

    function clampOffset(value: number) {
      return Math.min(0.5, Math.max(-0.5, value));
    }

    // Presses that land on a real field or the flip control are not drags
    // at all -- they fall straight through to the browser, so focus
    // happens natively on pointerdown with nothing added in front of it.
    // That is what keeps taps instant: there is no "wait and see" period
    // before a field can focus, because the decision is made from WHERE
    // the press landed rather than from how long it lasted.
    //
    // Same discrimination IncrediCardEmbeddedFace's own click handler
    // uses, and for the same reason: in the "overlay" layout the real
    // fields are genuine descendants of `.faceWrapper`.
    function isInteractiveTarget(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) return false;
      if (target instanceof HTMLInputElement) return true;
      return Boolean(target.closest("button"));
    }

    const handleDragStart = (event: PointerEvent) => {
      if (suppressedRef.current) return;
      if (isInteractiveTarget(event.target)) return;
      dragPointerId = event.pointerId;
      originX = event.clientX;
      originY = event.clientY;
      // Deliberately NOT dragging yet. The threshold has not been crossed,
      // so this press is still a candidate tap.
      dragging = false;
    };

    const handleDragMove = (event: PointerEvent) => {
      if (dragPointerId !== event.pointerId) return;
      // Suppressed mid-drag (a field took focus): stop contributing
      // entirely rather than accumulating an angle that would snap into
      // view the moment focus leaves.
      if (suppressedRef.current) return;
      const dx = event.clientX - originX;
      const dy = event.clientY - originY;
      if (!dragging) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
        dragging = true;
        // Capture so the gesture survives the finger leaving the card.
        // Wrapped because the pointer can already be gone by now.
        try {
          el.setPointerCapture(event.pointerId);
        } catch {
          // Nothing to recover: without capture the drag still works
          // while the finger stays over the element.
        }
      }
      // RELATIVE to where the press started, not absolute like the hover
      // path above. Two reasons. It means nothing jumps when the
      // threshold is crossed -- an absolute mapping would snap the card
      // to whatever angle the press point implies, which is a lurch if
      // you happened to press near an edge. And it matches what the
      // orientation path already does: neutral is wherever you started,
      // not some external origin.
      //
      // Half a card's width or height of travel reaches full tilt.
      const rect = el.getBoundingClientRect();
      writeTilt(clampOffset(dx / rect.width), clampOffset(dy / rect.height));
    };

    const handleDragEnd = (event: PointerEvent) => {
      if (dragPointerId !== event.pointerId) return;
      if (dragging) {
        try {
          el.releasePointerCapture(event.pointerId);
        } catch {
          // Already released, or the pointer is gone. Either is fine.
        }
        // Hand the properties back. If orientation is live it writes again
        // within a frame; if not, `.flipContainer`'s existing transform
        // transition eases the card back to flat, the same way the hover
        // path's `pointerleave` does.
        clearTilt();
      }
      dragging = false;
      dragPointerId = null;
    };

    // `touch-action: none` is what makes a vertical drag tilt rather than
    // scroll the page. It has to be set before the gesture begins -- the
    // browser decides at touch-down what a gesture is allowed to do, so
    // setting it from `pointerdown` would already be too late.
    //
    // Set here, in JS, rather than in the stylesheet, so it exists for
    // exactly as long as the drag path is wired: only on a non-hover
    // device, only while `tilt` is on, and never on a pointer device where
    // it would needlessly break scrolling.
    //
    // Known cost: this also stops a touch
    // that starts on a FIELD from scrolling, because `touch-action` is
    // resolved up the ancestor chain and a descendant cannot opt back in.
    // Swiping up from the card will not move the page; swiping anywhere
    // else will.
    const previousTouchAction = el.style.touchAction;
    el.style.touchAction = "none";

    el.addEventListener("pointerdown", handleDragStart);
    el.addEventListener("pointermove", handleDragMove);
    el.addEventListener("pointerup", handleDragEnd);
    el.addEventListener("pointercancel", handleDragEnd);

    function detachDrag() {
      el!.removeEventListener("pointerdown", handleDragStart);
      el!.removeEventListener("pointermove", handleDragMove);
      el!.removeEventListener("pointerup", handleDragEnd);
      el!.removeEventListener("pointercancel", handleDragEnd);
      el!.style.touchAction = previousTouchAction;
    }

    if (!motionAvailable) {
      return () => {
        detachDrag();
        clearTilt();
      };
    }

    const unsubscribe = subscribeToDeviceOrientation(window, (offset) => {
      // The same `suppressed` freeze the pointer path honors: a field has
      // focus, so the card is zoomed and being typed into, and tipping it
      // under the keyboard would fight the user rather than delight them.
      if (suppressedRef.current) return;
      // A finger currently owns these properties. Checked here
      // rather than by unsubscribing during the drag, so the sensor's
      // exponential smoothing keeps tracking underneath and hands back a
      // CURRENT value the moment the drag ends -- unsubscribing would
      // resume from a reading frozen at whenever the finger landed.
      if (dragging) return;
      // Already in the -0.5..0.5 space `writeTilt` wants--which is why
      // IncrediCardOrientation expresses orientation as a virtual pointer
      // position rather than as angles of its own.
      writeTilt(offset.x, offset.y);
    });

    return () => {
      detachDrag();
      unsubscribe();
      clearTilt();
    };
  }, [active, motionAvailable]);

  return ref;
}
