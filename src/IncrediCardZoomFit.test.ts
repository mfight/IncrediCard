import { describe, expect, it } from "vitest";
import {
  INCREDICARD_ZOOM_MIN_SCALE,
  INCREDICARD_ZOOM_SCALE,
  fitIncrediCardZoom,
  type IncrediCardZoomRect,
} from "./IncrediCardZoomFit";

// Covers the fit itself. Whether the hook measures the right rects, and
// whether the zoomed card really lands inside the viewport, is checked in
// a real browser by the Zoom Near the Edge story's `play` function.

// A 340x214 card (the component's max size) with its top-left corner at
// (left, top). The origin is its center, as for a card at rest.
function card(left: number, top: number, width = 340, height = 214) {
  const footprint = { left, top, right: left + width, bottom: top + height };
  return {
    footprint,
    origin: { x: left + width / 2, y: top + height / 2 },
  };
}

function viewport(width: number, height: number): IncrediCardZoomRect {
  return { left: 0, top: 0, right: width, bottom: height };
}

// Where the footprint lands once the fit is applied.
function zoomed(
  { footprint, origin }: ReturnType<typeof card>,
  fit: ReturnType<typeof fitIncrediCardZoom>,
): IncrediCardZoomRect {
  return {
    left: origin.x + fit.scale * (footprint.left - origin.x) + fit.x,
    top: origin.y + fit.scale * (footprint.top - origin.y) + fit.y,
    right: origin.x + fit.scale * (footprint.right - origin.x) + fit.x,
    bottom: origin.y + fit.scale * (footprint.bottom - origin.y) + fit.y,
  };
}

const INSET = 16;

describe("fitIncrediCardZoom", () => {
  it("zooms to the full 1.5x, unshifted, where that fits", () => {
    const c = card(400, 300);
    expect(fitIncrediCardZoom({ ...c, viewport: viewport(1280, 900), inset: INSET })).toEqual({
      scale: INCREDICARD_ZOOM_SCALE,
      x: 0,
      y: 0,
    });
  });

  it("shifts down, not shrinks, a card whose zoom would cross the top", () => {
    const c = card(400, 24);
    const fit = fitIncrediCardZoom({ ...c, viewport: viewport(1280, 900), inset: INSET });
    expect(fit.scale).toBe(INCREDICARD_ZOOM_SCALE);
    expect(fit.x).toBe(0);
    expect(zoomed(c, fit).top).toBeCloseTo(INSET);
  });

  it("shifts up and in from the bottom-right corner", () => {
    const c = card(1280 - 340 - 4, 900 - 214 - 4);
    const fit = fitIncrediCardZoom({ ...c, viewport: viewport(1280, 900), inset: INSET });
    const result = zoomed(c, fit);
    expect(result.right).toBeCloseTo(1280 - INSET);
    expect(result.bottom).toBeCloseTo(900 - INSET);
  });

  it("caps the scale at what the width allows, and stays inside", () => {
    // 460 - 2 * 16 = 428 available, so 428 / 340.
    const c = card(60, 300);
    const fit = fitIncrediCardZoom({ ...c, viewport: viewport(460, 900), inset: INSET });
    expect(fit.scale).toBeCloseTo(428 / 340);
    const result = zoomed(c, fit);
    expect(result.left).toBeCloseTo(INSET);
    expect(result.right).toBeCloseTo(460 - INSET);
  });

  it("caps the scale at what the height allows", () => {
    // A short landscape window: 300 - 32 = 268 available, so 268 / 214.
    const c = card(400, 40);
    const fit = fitIncrediCardZoom({ ...c, viewport: viewport(1280, 300), inset: INSET });
    expect(fit.scale).toBeCloseTo(268 / 214);
    const result = zoomed(c, fit);
    expect(result.top).toBeGreaterThanOrEqual(INSET - 1e-9);
    expect(result.bottom).toBeLessThanOrEqual(300 - INSET + 1e-9);
  });

  it("doesn't zoom when less than the minimum gain fits", () => {
    // A phone: 390 - 32 = 358 available for a 340 card, about 1.05x.
    const c = card(25, 200);
    expect(fitIncrediCardZoom({ ...c, viewport: viewport(390, 844), inset: INSET })).toEqual({
      scale: 1,
      x: 0,
      y: 0,
    });
    // Just above the minimum, it does.
    const roomy = (340 * INCREDICARD_ZOOM_MIN_SCALE) + 2 * INSET + 1;
    expect(
      fitIncrediCardZoom({ ...c, viewport: viewport(roomy, 844), inset: INSET }).scale,
    ).toBeGreaterThanOrEqual(INCREDICARD_ZOOM_MIN_SCALE);
  });

  it("never shrinks a card that doesn't fit even at rest", () => {
    const c = card(0, 0);
    expect(fitIncrediCardZoom({ ...c, viewport: viewport(300, 600), inset: INSET }).scale).toBe(1);
  });

  it("fits an overhang too, scaling it about the card's center", () => {
    // The flip badge: 36px, centered on the top-right corner.
    const c = card(400, 300);
    const withBadge = {
      footprint: { ...c.footprint, top: c.footprint.top - 18, right: c.footprint.right + 18 },
      origin: c.origin,
    };
    // Width: 460 - 32 = 428 for a 340 + 18 = 358 footprint.
    const fit = fitIncrediCardZoom({ ...withBadge, viewport: viewport(460, 900), inset: INSET });
    expect(fit.scale).toBeCloseTo(428 / 358);
    const result = zoomed(withBadge, fit);
    expect(result.left).toBeGreaterThanOrEqual(INSET - 1e-9);
    expect(result.right).toBeLessThanOrEqual(460 - INSET + 1e-9);
  });

  it("works in a visual viewport offset from the layout viewport", () => {
    // Pinch-zoomed in: the visible area is a 400x300 window at (500, 400).
    const c = card(520, 420);
    const view = { left: 500, top: 400, right: 900, bottom: 700 };
    const fit = fitIncrediCardZoom({ ...c, viewport: view, inset: INSET });
    const result = zoomed(c, fit);
    expect(result.left).toBeGreaterThanOrEqual(view.left + INSET - 1e-9);
    expect(result.top).toBeGreaterThanOrEqual(view.top + INSET - 1e-9);
    expect(result.right).toBeLessThanOrEqual(view.right - INSET + 1e-9);
    expect(result.bottom).toBeLessThanOrEqual(view.bottom - INSET + 1e-9);
  });

  it("keeps a field below the card clear, shifting up instead of down", () => {
    // Stacked: the label and field start 24px under the card.
    const c = card(400, 200);
    const field = { left: 400, top: 438, right: 740, bottom: 500 };
    const fit = fitIncrediCardZoom({ ...c, viewport: viewport(1280, 900), inset: INSET, keepClear: field });
    expect(fit.scale).toBe(INCREDICARD_ZOOM_SCALE);
    expect(zoomed(c, fit).bottom).toBeCloseTo(field.top - INSET);
  });

  it("grows less when the card is pinned between the top edge and its field", () => {
    // 24px from the top, field 62px below: 300 - 16 - 16 = 268 of height.
    const c = card(400, 24);
    const field = { left: 400, top: 300, right: 740, bottom: 362 };
    const fit = fitIncrediCardZoom({ ...c, viewport: viewport(1280, 900), inset: INSET, keepClear: field });
    expect(fit.scale).toBeCloseTo((300 - 2 * INSET) / 214);
    const result = zoomed(c, fit);
    expect(result.top).toBeCloseTo(INSET);
    expect(result.bottom).toBeCloseTo(field.top - INSET);
  });

  it("doesn't zoom when the field leaves no room", () => {
    const c = card(400, 16);
    const field = { left: 400, top: 240, right: 740, bottom: 300 };
    expect(
      fitIncrediCardZoom({ ...c, viewport: viewport(1280, 900), inset: INSET, keepClear: field }).scale,
    ).toBe(1);
  });

  it("keeps a field beside the card clear, in the wide row layout", () => {
    const c = card(100, 300);
    const field = { left: 464, top: 300, right: 800, bottom: 360 };
    const fit = fitIncrediCardZoom({ ...c, viewport: viewport(1280, 900), inset: INSET, keepClear: field });
    const result = zoomed(c, fit);
    expect(result.right).toBeLessThanOrEqual(field.left - INSET + 1e-9);
    expect(result.left).toBeGreaterThanOrEqual(INSET - 1e-9);
  });

  it("ignores a field that overlaps the card at rest", () => {
    // Floating: the fields are on the card.
    const c = card(400, 300);
    const field = { left: 420, top: 380, right: 720, bottom: 420 };
    expect(fitIncrediCardZoom({ ...c, viewport: viewport(1280, 900), inset: INSET, keepClear: field })).toEqual({
      scale: INCREDICARD_ZOOM_SCALE,
      x: 0,
      y: 0,
    });
  });

  it("doesn't zoom an empty footprint", () => {
    expect(fitIncrediCardZoom({ ...card(0, 0, 0, 0), viewport: viewport(1280, 900), inset: INSET }).scale).toBe(1);
  });
});
