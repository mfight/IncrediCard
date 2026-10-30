// The card face's ribbon-line artwork, drawn from numbers.
//
// Three files come out of one drawing: the full artwork
// (`incredicard-front-holo.svg`, both ribbons in color) and one mask per
// ribbon (`-a`, `-b`). The hologram depends on the masks lining up
// exactly with the lines the full artwork prints, so all three are
// written from the same path strings rather than exported separately
// (see IncrediCardArtwork.test.ts, which also checks the committed files
// against this generator's output).
//
// A ribbon is a fan of fine lines blended between two boundary curves,
// each a cubic Bezier in the artwork's 325x204 viewBox. Line i of n is the
// curve whose control points sit a fraction s of the way from the first
// boundary to the second, with s = (i / (n - 1)) ^ spacing, so a spacing
// above 1 packs the lines toward the first boundary. Boundaries that share
// an end point make the fan converge there; boundaries that cross make it
// pinch and twist.
//
// Each line is a filled outline rather than a stroke, so its width can
// vary: across the fan (`width`, from the first line to the last) and
// along each line (`taper`, the fraction of full width at its ends).

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const IMAGES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "assets", "images");

export const FILES = {
  foil: "incredicard-front-holo.svg",
  maskA: "incredicard-front-holo-a.svg",
  maskB: "incredicard-front-holo-b.svg",
};

const WIDTH = 325;
const HEIGHT = 204;

// Each line is split into this many Bezier pieces before its edges are
// offset. Offsetting a cubic by moving its control points is an
// approximation that holds while each piece bends gently, and at these
// widths (about a third of a unit to just over one) six pieces keep the
// edges within a few thousandths of a unit of the true offset.
const PIECES = 6;

// Coordinates are written to two decimals: a hundredth of a viewBox unit
// is under a tenth of a pixel on a full-width card.
const fmt = (n) => {
  const s = (Math.round(n * 100) / 100).toFixed(2).replace(/\.?0+$/, "");
  return s === "-0" ? "0" : s;
};

const lerp = (a, b, t) => a + (b - a) * t;
const lerpPoint = (p, q, t) => [lerp(p[0], q[0], t), lerp(p[1], q[1], t)];

/** Splits a cubic at t, returning its two halves. */
function split(curve, t) {
  const [p0, p1, p2, p3] = curve;
  const a = lerpPoint(p0, p1, t);
  const b = lerpPoint(p1, p2, t);
  const c = lerpPoint(p2, p3, t);
  const d = lerpPoint(a, b, t);
  const e = lerpPoint(b, c, t);
  const f = lerpPoint(d, e, t);
  return [
    [p0, a, d, f],
    [f, e, c, p3],
  ];
}

/** The unit normal of the direction from p to q. Falls back to `r` when
 * p and q coincide, which happens where a control point sits on its end
 * point. */
function normal(p, q, r) {
  let dx = q[0] - p[0];
  let dy = q[1] - p[1];
  if (Math.hypot(dx, dy) < 1e-9) {
    dx = r[0] - p[0];
    dy = r[1] - p[1];
  }
  const length = Math.hypot(dx, dy);
  return [-dy / length, dx / length];
}

const offset = (p, n, d) => [p[0] + n[0] * d, p[1] + n[1] * d];

/** One line's filled outline: along one edge, back along the other. */
function outline(curve, halfWidth, taper) {
  const pieces = [];
  let rest = curve;
  for (let i = PIECES; i > 1; i--) {
    const [head, tail] = split(rest, 1 / i);
    pieces.push(head);
    rest = tail;
  }
  pieces.push(rest);

  // Full width through the middle, easing to `taper` of it at the ends:
  // one fraction for both, or [start, end].
  const [startTaper, endTaper] = Array.isArray(taper) ? taper : [taper, taper];
  const widthAt = (t) => halfWidth * lerp(lerp(startTaper, endTaper, t), 1, Math.sin(Math.PI * t));

  const left = [];
  const right = [];
  pieces.forEach(([p0, p1, p2, p3], i) => {
    const w0 = widthAt(i / PIECES);
    const w1 = widthAt((i + 1) / PIECES);
    const n0 = normal(p0, p1, p2);
    const n1 = normal(p2, p3, p1);
    left.push([offset(p0, n0, w0), offset(p1, n0, w0), offset(p2, n1, w1), offset(p3, n1, w1)]);
    right.push([offset(p0, n0, -w0), offset(p1, n0, -w0), offset(p2, n1, -w1), offset(p3, n1, -w1)]);
  });

  const point = (p) => `${fmt(p[0])} ${fmt(p[1])}`;
  let d = `M${point(left[0][0])}`;
  for (const [, c1, c2, end] of left) d += `C${point(c1)} ${point(c2)} ${point(end)}`;
  d += `L${point(right[right.length - 1][3])}`;
  for (const [start, c1, c2] of [...right].reverse()) d += `C${point(c2)} ${point(c1)} ${point(start)}`;
  return `${d}Z`;
}

/** The point a fraction s of the way along a polyline, by length. */
function along(points, s) {
  const lengths = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));
  let remaining = s * lengths.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i] || i === lengths.length - 1) return lerpPoint(points[i], points[i + 1], remaining / lengths[i]);
    remaining -= lengths[i];
  }
}

/** Every line of one ribbon, as a single path's data. */
export function ribbonPath({ from, to, startVia, lines, spacing = 1, width, taper = 1 }) {
  let d = "";
  for (let i = 0; i < lines; i++) {
    const s = (i / (lines - 1)) ** spacing;
    const curve = from.map((p, k) => lerpPoint(p, to[k], s));
    // Lines whose start points would fall on the straight run between the
    // two boundaries' starts can instead be walked around a corner
    // (`startVia`), so that every line runs off the card rather than
    // stopping short inside it. The start moves and its control point
    // moves with it, keeping the line's direction as it leaves.
    if (startVia) {
      const start = along([from[0], ...startVia, to[0]], s);
      const shift = [start[0] - curve[0][0], start[1] - curve[0][1]];
      curve[0] = start;
      curve[1] = [curve[1][0] + shift[0], curve[1][1] + shift[1]];
    }
    d += outline(curve, lerp(width[0], width[1], i / (lines - 1)) / 2, taper);
  }
  return d;
}

// The foil's colors run across each ribbon's own span, so both read as
// the same iridescent film. Lightness stays high throughout: the face
// prints these desaturated and very faint, and the hologram blends them
// with color-dodge, which only brightens.
const STOPS = [
  [0, "#F98BE4"],
  [0.18, "#FFC9AE"],
  [0.36, "#F1F7B8"],
  [0.54, "#9FF5C8"],
  [0.72, "#72E6FA"],
  [0.87, "#7A8CF7"],
  [1, "#D9A2FB"],
];

function gradient(id, [x1, x2]) {
  const stops = STOPS.map(([offset, color]) => `<stop offset="${offset}" stop-color="${color}"/>`).join("\n");
  return `<linearGradient id="${id}" x1="${x1}" y1="0" x2="${x2}" y2="0" gradientUnits="userSpaceOnUse">\n${stops}\n</linearGradient>`;
}

const svg = (body) =>
  `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">\n${body}\n</svg>\n`;

/** The three files' contents, keyed as in FILES. */
export function renderRibbons(composition) {
  const a = ribbonPath(composition.a);
  const b = ribbonPath(composition.b);
  return {
    foil: svg(
      `<path d="${a}" fill="url(#ribbon-a)"/>\n<path d="${b}" fill="url(#ribbon-b)"/>\n<defs>\n${gradient("ribbon-a", composition.a.gradient)}\n${gradient("ribbon-b", composition.b.gradient)}\n</defs>`,
    ),
    maskA: svg(`<path d="${a}" fill="#fff"/>`),
    maskB: svg(`<path d="${b}" fill="#fff"/>`),
  };
}

// The artwork itself.
export const COMPOSITION = {
  // A band across the lower half of the card that twists once, between
  // the number and the name, then opens up to meet the right edge from
  // about 40% of the way down to level with the middle of the acceptance
  // mark (y 182). `.glareRadial` and its reverse light it.
  a: {
    from: [[-12, 90], [70, 90], [150, 175], [337, 182]],
    to: [[-12, 200], [130, 214], [230, 95], [337, 85]],
    lines: 22,
    spacing: 1,
    width: [0.45, 1.05],
    taper: 0.6,
    gradient: [0, 325],
  },
  // A fan sweeping up from the bottom-right corner to the left edge,
  // twisting once at a narrow waist above the acceptance mark.
  // `.glareLinear` and its reverse light it. Below the twist the lines
  // spread again and end around the mark rather than over it: the outer
  // arc curls down to the bottom edge just before the mark's left side
  // (x 241), and the inner arc curves up to the right edge just above its
  // top (y 171). The lines between them end around the card's corner,
  // off the card, rather than behind the mark.
  b: {
    from: [[337, 166], [300, 182], [120, 144], [-12, 164]],
    to: [[236, 216], [282, 168], [140, 24], [-12, 4]],
    startVia: [[337, 216]],
    lines: 18,
    spacing: 1.15,
    width: [0.4, 0.9],
    taper: [0.3, 0.55],
    gradient: [0, 300],
  },
};

/** The committed files' contents, keyed as in FILES. */
export function readCommitted() {
  return Object.fromEntries(Object.entries(FILES).map(([key, name]) => [key, readFileSync(join(IMAGES_DIR, name), "utf8")]));
}

export function writeRibbons(composition = COMPOSITION, dir = IMAGES_DIR) {
  const files = renderRibbons(composition);
  for (const [key, name] of Object.entries(FILES)) writeFileSync(join(dir, name), files[key]);
}
