"use client";

import { useLayoutEffect, useRef } from "react";

// Fits `scale`'s zoom to the visible viewport. The zoom wants 150%, but a
// 340px card at 1.5x needs 510px, which no phone has, and even on a wide
// screen a card near the top of the page grows past the top edge. So the
// zoom takes the lesser of 1.5x and the largest scale whose result fits
// inside the viewport (less a small clearance), and shifts the card just
// enough to keep that result on screen. Below a 1.1x gain it doesn't zoom
// at all: an enlargement that small reads as a twitch, not a zoom.
//
// In "stacked", the field being typed into sits outside the card, below
// it or beside it, and counts as one more edge: shifting the card off the
// top of the screen mustn't slide it over the very field the zoom is
// for. The card grows less, or shifts the other way, instead.
//
// A deliberate exception to this component's container-query rule (see
// `.incredicard` in IncrediCard.module.scss). Layout decisions there
// follow the component's own width, never the viewport, because the
// form can sit in a narrow column on a wide screen. The zoom is the
// opposite case: a transform that paints past the component's box by
// design, so the only edge that matters is the screen's. No container
// query can see that, and no viewport query can either: CSS can't divide
// one length by another to get a scale factor, and only script can read
// where the card currently sits on screen. Don't replace this with a
// breakpoint.
//
// The fit is worked out when the zoom starts, and again whenever the
// geometry it depends on changes: the window resizing, the visual
// viewport resizing (pinch zoom, or a phone keyboard opening), the card
// itself resizing, or focus moving to another field. NOT on scroll: a zoomed card scrolls with the
// page like any other content, rather than sliding to chase the viewport
// over whatever else is on the page.
//
// The result is written as three custom properties on the scale target,
// read by the `[data-zoomed]` rules in IncrediCard.module.scss and
// IncrediCardEmbeddedFace.module.scss, so the transform and its
// transition stay in CSS, the same wiring every other effect here uses.
// The shift is part of the transform too, not a margin or a scroll, so
// the zoom still never reflows the page.

// ---------------------------------------------------------------------
// The math (pure, and exported for its own test -- the unit runner's
// environment is "node", so nothing below may touch a DOM).
// ---------------------------------------------------------------------

export type IncrediCardZoomRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type IncrediCardZoomFit = {
  /** The scale to apply, about the card's center. 1 means no zoom. */
  scale: number;
  /** Shift applied with the scale, in CSS pixels. */
  x: number;
  y: number;
};

export const INCREDICARD_ZOOM_SCALE = 1.5;
export const INCREDICARD_ZOOM_MIN_SCALE = 1.1;
// The clearance kept between a zoomed card and the viewport's edges: the
// same 1rem the field list uses between fields.
export const INCREDICARD_ZOOM_INSET_REM = 1;

const NO_ZOOM: IncrediCardZoomFit = { scale: 1, x: 0, y: 0 };

/**
 * `footprint` is everything the zoom enlarges, at rest: the card plus
 * anything that overhangs it (the flip badge). `origin` is the point it
 * scales about, the card's own resting center. `keepClear`, if given, is
 * the field being typed into when it sits outside the card ("stacked"):
 * the zoomed card stays the same clearance away from it as from a screen
 * edge, on whichever side of the card it is. All rects share one
 * coordinate space (the layout viewport's, as `getBoundingClientRect`
 * reports it).
 */
export function fitIncrediCardZoom({
  footprint,
  origin,
  viewport,
  inset,
  keepClear,
}: {
  footprint: IncrediCardZoomRect;
  origin: { x: number; y: number };
  viewport: IncrediCardZoomRect;
  inset: number;
  keepClear?: IncrediCardZoomRect;
}): IncrediCardZoomFit {
  const available = {
    left: viewport.left + inset,
    top: viewport.top + inset,
    right: viewport.right - inset,
    bottom: viewport.bottom - inset,
  };
  const width = footprint.right - footprint.left;
  const height = footprint.bottom - footprint.top;
  if (width <= 0 || height <= 0) return NO_ZOOM;

  // A field below the card (the stacked column) or beside it (the wide
  // row) becomes one more edge. One that overlaps the card at rest is
  // left alone: there's no side of it to stay on.
  if (keepClear) {
    if (keepClear.top >= footprint.bottom) {
      available.bottom = Math.min(available.bottom, keepClear.top - inset);
    } else if (keepClear.bottom <= footprint.top) {
      available.top = Math.max(available.top, keepClear.bottom + inset);
    } else if (keepClear.left >= footprint.right) {
      available.right = Math.min(available.right, keepClear.left - inset);
    } else if (keepClear.right <= footprint.left) {
      available.left = Math.max(available.left, keepClear.right + inset);
    }
  }

  const scale = Math.min(
    INCREDICARD_ZOOM_SCALE,
    (available.right - available.left) / width,
    (available.bottom - available.top) / height,
  );
  if (!(scale >= INCREDICARD_ZOOM_MIN_SCALE)) return NO_ZOOM;

  // The smallest shift that brings the scaled footprint inside the
  // available area on one axis. The scale above guarantees it fits, so
  // the two bounds never cross; 0 whenever no shift is needed.
  function shift(start: number, end: number, center: number, min: number, max: number) {
    const scaledStart = center + scale * (start - center);
    const scaledEnd = center + scale * (end - center);
    return Math.min(Math.max(0, min - scaledStart), max - scaledEnd);
  }

  return {
    scale,
    x: shift(footprint.left, footprint.right, origin.x, available.left, available.right),
    y: shift(footprint.top, footprint.bottom, origin.y, available.top, available.bottom),
  };
}

// ---------------------------------------------------------------------
// The hook
// ---------------------------------------------------------------------

function measure(el: HTMLElement, view: Window): IncrediCardZoomFit {
  // The card may already be transformed: mid-transition, or zoomed when
  // the viewport resizes. Undo the element's own current transform to
  // get back to its resting geometry. It is only ever a translate plus a
  // uniform scale about the center, so the scaled center moves by
  // exactly the translation, and every other point scales about it.
  const transform = view.getComputedStyle(el).transform;
  const matrix = new DOMMatrixReadOnly(transform === "none" ? undefined : transform);
  const currentScale = matrix.a || 1;
  const rect = el.getBoundingClientRect();
  const center = { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 };
  const origin = { x: center.x - matrix.e, y: center.y - matrix.f };
  const toRest = (r: DOMRect): IncrediCardZoomRect => ({
    left: origin.x + (r.left - center.x) / currentScale,
    top: origin.y + (r.top - center.y) / currentScale,
    right: origin.x + (r.right - center.x) / currentScale,
    bottom: origin.y + (r.bottom - center.y) / currentScale,
  });

  const footprint = toRest(rect);
  // `data-incredicard-zoom-overhang` marks a descendant that overhangs the
  // card (the flip badge, half off its corner) and has to fit on screen
  // too.
  for (const overhang of el.querySelectorAll("[data-incredicard-zoom-overhang]")) {
    const r = toRest(overhang.getBoundingClientRect());
    footprint.left = Math.min(footprint.left, r.left);
    footprint.top = Math.min(footprint.top, r.top);
    footprint.right = Math.max(footprint.right, r.right);
    footprint.bottom = Math.max(footprint.bottom, r.bottom);
  }

  // The part of the page actually on screen: the visual viewport (after
  // pinch zoom and an on-screen keyboard), but never more than the layout
  // viewport less its scrollbars. The visual viewport can be the LARGER
  // of the two when a mobile browser zooms out to show content wider
  // than the page, and a zoomed card is exactly such content: fitting to
  // that zoomed-out area would keep the card big, which keeps the page
  // wide, which keeps the browser zoomed out. Seen in Chrome's phone
  // emulation after resizing from a wide window while zoomed, and what
  // rotating a real phone to portrait mid-zoom would do.
  const visual = view.visualViewport;
  const root = el.ownerDocument.documentElement;
  const viewport = {
    left: Math.max(0, visual?.offsetLeft ?? 0),
    top: Math.max(0, visual?.offsetTop ?? 0),
    right: Math.min(root.clientWidth, visual ? visual.offsetLeft + visual.width : Infinity),
    bottom: Math.min(root.clientHeight, visual ? visual.offsetTop + visual.height : Infinity),
  };
  const remPx = parseFloat(view.getComputedStyle(root).fontSize) || 16;

  return fitIncrediCardZoom({
    footprint,
    origin,
    viewport,
    inset: INCREDICARD_ZOOM_INSET_REM * remPx,
    keepClear: focusedFieldOutside(el),
  });
}

// The real field being typed into, with its label, when it lives outside
// the scale target: "stacked" puts the fields beside or below the
// decorative card. In "floating" they're on the card, inside the target,
// and there's nothing to keep clear.
function focusedFieldOutside(el: HTMLElement): IncrediCardZoomRect | undefined {
  const active = el.ownerDocument.activeElement;
  if (!(active instanceof HTMLInputElement) || el.contains(active)) return undefined;
  if (!el.closest("fieldset")?.contains(active)) return undefined;
  const rects = [active, ...(active.labels ?? [])].map((node) => node.getBoundingClientRect());
  return {
    left: Math.min(...rects.map((r) => r.left)),
    top: Math.min(...rects.map((r) => r.top)),
    right: Math.max(...rects.map((r) => r.right)),
    bottom: Math.max(...rects.map((r) => r.bottom)),
  };
}

/**
 * Attach the returned ref to the element `[data-zoomed]` scales. While
 * `zoomed` is true, it keeps `--incredicard-zoom-scale`, `-x` and `-y` on
 * that element fitted to the visible viewport.
 */
export function useIncrediCardZoomFit<T extends HTMLElement>(zoomed: boolean) {
  const ref = useRef<T>(null);

  // A layout effect, so the first fit lands before the zoomed frame
  // paints rather than one frame after it.
  useLayoutEffect(() => {
    const el = ref.current;
    const view = el?.ownerDocument.defaultView;
    if (!zoomed || !el || !view) return;

    let frame = 0;
    const apply = () => {
      frame = 0;
      const fit = measure(el, view);
      el.style.setProperty("--incredicard-zoom-scale", String(fit.scale));
      el.style.setProperty("--incredicard-zoom-x", `${fit.x}px`);
      el.style.setProperty("--incredicard-zoom-y", `${fit.y}px`);
    };
    // Resize events can arrive many times a frame; measure once per frame.
    const schedule = () => {
      if (!frame) frame = view.requestAnimationFrame(apply);
    };

    apply();
    view.addEventListener("resize", schedule);
    view.visualViewport?.addEventListener("resize", schedule);
    // Tabbing between fields keeps the card zoomed but moves the field
    // that has to stay clear.
    const root = el.closest("fieldset");
    root?.addEventListener("focusin", schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(el);

    return () => {
      if (frame) view.cancelAnimationFrame(frame);
      view.removeEventListener("resize", schedule);
      view.visualViewport?.removeEventListener("resize", schedule);
      root?.removeEventListener("focusin", schedule);
      observer.disconnect();
      el.style.removeProperty("--incredicard-zoom-scale");
      el.style.removeProperty("--incredicard-zoom-x");
      el.style.removeProperty("--incredicard-zoom-y");
    };
  }, [zoomed]);

  return ref;
}
