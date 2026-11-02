// Draws the demo's engraved card (demo/themes/engraved-card.svg): a pale green
// face covered in fine engraved lines and a repeating motif, a dark ornamental
// border, and an issuer's wordmark and emblem. The chip is the card's own. It's
// the artwork for an example of a custom theme, for a fictional issuer, and
// isn't part of the npm package.
//
// Run with `npm run artwork:engraved-card`.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUTPUT = join(dirname(fileURLToPath(import.meta.url)), "..", "demo", "themes", "engraved-card.svg");

const WIDTH = 325;
const HEIGHT = 204;
const INK = "#10231a";
const FINE = "#5f9a72";
// Where the border's rope runs, in from the card's edge.
const INSET = 8;
const ROPE = 3.4;

const fmt = (n) => (Math.round(n * 100) / 100).toString();
const path = (points) => `M${points.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join("L")}`;

// One fine line down the card, rippling side to side. The field repeats it
// across the whole width, which reads as an engraved curtain of lines.
function curtainLine() {
  const points = [];
  for (let y = -2; y <= HEIGHT + 2; y += 3) {
    points.push([1.6 * Math.sin((y / 41) * Math.PI * 2), y]);
  }
  return `<path id="curtain" d="${path(points)}" fill="none" stroke="${FINE}" stroke-width="0.2"/>`;
}

const OVAL = { rx: 12.5, ry: 15 };
const RIBBON = "M-32 -6C-15 -18 15 18 32 6";

// The field's repeating motif: a meridian oval with a ribbon across it, the
// ribbon carrying the issuer's name in tiny print.
function motif() {
  const meridians = [];
  for (const scale of [1, 0.72, 0.42, 0.14]) {
    meridians.push(`<ellipse rx="${fmt(OVAL.rx * scale)}" ry="${OVAL.ry}"/>`);
  }
  for (const y of [-9, -3, 3, 9]) {
    const half = OVAL.rx * Math.sqrt(1 - (y / OVAL.ry) ** 2);
    meridians.push(`<path d="M${fmt(-half)} ${y}L${fmt(half)} ${y}"/>`);
  }
  return [
    `<path id="ribbon-path" d="${RIBBON}" fill="none"/>`,
    `<g id="motif">`,
    `<ellipse rx="${OVAL.rx}" ry="${OVAL.ry}" fill="#d3ecd4" fill-opacity="0.75"/>`,
    `<g fill="none" stroke="${FINE}" stroke-width="0.24">${meridians.join("")}</g>`,
    `<path d="${RIBBON}" fill="none" stroke="${FINE}" stroke-width="7.8"/>`,
    `<path d="${RIBBON}" fill="none" stroke="#d6eed7" stroke-width="7.2"/>`,
    `<text font-family="Arial, Helvetica, sans-serif" font-size="3.5" letter-spacing="0.5" fill="#5f9a72" dy="1.2"><textPath href="#ribbon-path" startOffset="50%" text-anchor="middle">EXAMPLE BANK</textPath></text>`,
    `</g>`,
  ].join("");
}

// Fine lines across the whole face, with staggered rows of the motif over them.
function field() {
  const lines = [];
  for (let x = 0; x <= WIDTH; x += 1.5) lines.push(`<use href="#curtain" x="${fmt(x)}"/>`);
  const uses = [];
  for (let row = 0; row < 5; row++) {
    for (let column = 0; column < 6; column++) {
      const x = 8 + column * 64 + (row % 2) * 32;
      const y = 20 + row * 41;
      uses.push(`<use href="#motif" x="${fmt(x)}" y="${fmt(y)}"/>`);
    }
  }
  return lines.join("") + uses.join("");
}

// One side of the border: two sine lines crossing between two rules, so it
// reads as a twisted rope. A side runs corner to corner in a whole number of
// twists, so the ropes meet the corners the same way.
function ropeSide(x1, y1, x2, y2) {
  const length = Math.hypot(x2 - x1, y2 - y1);
  const twists = Math.round(length / 5);
  const [ux, uy] = [(x2 - x1) / length, (y2 - y1) / length];
  const [nx, ny] = [-uy, ux];
  const strand = (phase) => {
    const points = [];
    for (let i = 0; i <= twists * 8; i++) {
      const t = (i / (twists * 8)) * length;
      const offset = (ROPE / 2) * Math.sin((t / length) * twists * Math.PI * 2 + phase);
      points.push([x1 + ux * t + nx * offset, y1 + uy * t + ny * offset]);
    }
    return `<path d="${path(points)}"/>`;
  };
  return strand(0) + strand(Math.PI);
}

function border() {
  const [left, top, right, bottom] = [INSET, INSET, WIDTH - INSET, HEIGHT - INSET];
  const rope = [
    ropeSide(left, top, right, top),
    ropeSide(right, top, right, bottom),
    ropeSide(right, bottom, left, bottom),
    ropeSide(left, bottom, left, top),
  ].join("");
  const rule = (inset, width) =>
    `<rect x="${fmt(left + inset)}" y="${fmt(top + inset)}" width="${fmt(right - left - inset * 2)}" height="${fmt(bottom - top - inset * 2)}" fill="none" stroke="${INK}" stroke-width="${width}"/>`;
  // A dark rosette on each corner, with a pale spiral in it.
  const corner = (x, y) => {
    const points = [];
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 3.5;
      const r = 3.7 * (1 - i / 46);
      points.push([x + r * Math.cos(a), y + r * Math.sin(a)]);
    }
    return `<circle cx="${fmt(x)}" cy="${fmt(y)}" r="4.5" fill="${INK}"/><path d="${path(points)}" fill="none" stroke="#cfe8d2" stroke-width="0.55"/>`;
  };
  const print = "EXAMPLE BANK ".repeat(16);
  return [
    `<g fill="none" stroke="${INK}" stroke-width="0.6">${rope}</g>`,
    rule(-ROPE / 2 - 0.5, 0.7),
    rule(ROPE / 2 + 0.5, 0.7),
    corner(left, top),
    corner(right, top),
    corner(right, bottom),
    corner(left, bottom),
    `<text x="${WIDTH / 2}" y="${HEIGHT - 2.6}" text-anchor="middle" textLength="${WIDTH - 40}" font-family="Arial, Helvetica, sans-serif" font-size="2.4" fill="${INK}">${print.trim()}</text>`,
  ].join("");
}

// The wordmark, as outlines rather than text, so it looks the same whatever
// fonts a device has: wide, heavy capitals, drawn on a 100-unit cap height.
const GLYPHS = {
  A: [120, "M44 0H76L120 100H88L80 79H40L32 100H0ZM60 24L48 57H72Z"],
  B: [102, "M0 0H62C86 0 98 11 98 27C98 38 92 46 82 49C95 52 102 62 102 73C102 90 88 100 64 100H0ZM28 20V40H58C66 40 70 36 70 30C70 24 66 20 58 20ZM28 59V80H60C69 80 74 76 74 69C74 63 69 59 60 59Z"],
  E: [88, "M0 0H86V22H28V39H78V60H28V78H88V100H0Z"],
  K: [110, "M0 0H28V38L70 0H106L60 44L110 100H74L41 62L28 74V100H0Z"],
  L: [82, "M0 0H28V78H82V100H0Z"],
  M: [128, "M0 0H36L64 58L92 0H128V100H100V42L73 100H55L28 42V100H0Z"],
  N: [112, "M0 0H28L84 60V0H112V100H84L28 40V100H0Z"],
  P: [98, "M0 0H58C84 0 98 14 98 34C98 54 84 68 58 68H28V100H0ZM28 22V46H54C64 46 70 41 70 34C70 27 64 22 54 22Z"],
  X: [112, "M2 0H35L56 33L77 0H110L72 49L112 100H78L56 66L34 100H0L40 49Z"],
};

function wordmark(text, top, capHeight, widen) {
  const gap = 9;
  const space = 38;
  let x = 0;
  const glyphs = [];
  for (const letter of text) {
    if (letter === " ") {
      x += space;
      continue;
    }
    const [width, d] = GLYPHS[letter];
    glyphs.push(`<path transform="translate(${x})" d="${d}"/>`);
    x += width + gap;
  }
  const scaleY = capHeight / 100;
  const scaleX = scaleY * widen;
  const left = (WIDTH - (x - gap) * scaleX) / 2;
  return `<g transform="translate(${fmt(left)} ${top}) scale(${scaleX} ${scaleY})" fill="${INK}" fill-rule="evenodd">${glyphs.join("")}</g>`;
}

// The emblem: an inked head and shoulders of Liberty, in an oval at the center
// of the card. Everything is drawn in the oval's own coordinates, as brush
// shapes rather than even lines: the ink swells and tapers, the way an
// engraver's line does. The number prints across the neck and collar, so the
// shadows there are hatched in a mid green, and the solid ink stays above it.
const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 };
const OVAL_SIZE = { rx: 40, ry: 50 };
const ENGRAVE = "#3f7d58";
const PAPER = "#eff8ef";

// A brush stroke along a curve from `a` to `b` through control `c`, thickest in
// the middle and coming to a point at each end.
function brush(a, c, b, width) {
  const left = [];
  const right = [];
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = (1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t ** 2 * b[0];
    const y = (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t ** 2 * b[1];
    const dx = 2 * (1 - t) * (c[0] - a[0]) + 2 * t * (b[0] - c[0]);
    const dy = 2 * (1 - t) * (c[1] - a[1]) + 2 * t * (b[1] - c[1]);
    const length = Math.hypot(dx, dy) || 1;
    const half = (width / 2) * Math.sin(Math.PI * t) ** 0.8;
    left.push([x - (dy / length) * half, y + (dx / length) * half]);
    right.unshift([x + (dy / length) * half, y - (dx / length) * half]);
  }
  return `${path([...left, ...right])}Z`;
}

// Parallel fine lines between two edges, for a shadow.
function hatch(from, to, count) {
  const lines = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    const at = (edge) => [edge[0][0] + (edge[1][0] - edge[0][0]) * t, edge[0][1] + (edge[1][1] - edge[0][1]) * t];
    lines.push(path([at(from), at(to)]));
  }
  return lines.join("");
}

function rays() {
  const [ox, oy] = [0.5, -17];
  const shapes = [];
  for (const [degrees, tip] of [[-170, 32], [-145, 30], [-118, 28], [-90, 27], [-62, 28], [-35, 30], [-10, 32]]) {
    const a = (degrees * Math.PI) / 180;
    const at = (r, delta) => [ox + r * Math.cos(a + delta), oy + r * Math.sin(a + delta)];
    const spread = 0.13;
    shapes.push(`<path d="${path([at(15, spread), at(tip, 0), at(15, -spread)])}Z" fill="${PAPER}" stroke="${INK}" stroke-width="0.4"/>`);
    // The shadowed half of each ray, on the side away from the light.
    shapes.push(`<path d="${path([at(15, 0), at(tip, 0), at(15, -spread)])}Z" fill="${INK}"/>`);
  }
  return shapes.join("");
}

function crown() {
  const windows = [];
  for (let i = 0; i < 13; i++) {
    const t = i / 12;
    const a = Math.PI + t * Math.PI;
    const point = (rx, ry) => [0.5 + rx * Math.cos(a), -18.5 + ry * Math.sin(a)];
    const [p, q] = [point(13.5, 10.2), point(15.3, 12.2)];
    windows.push(`<path d="M${fmt(p[0])} ${fmt(p[1])}L${fmt(q[0])} ${fmt(q[1])}"/>`);
  }
  return [
    // The band sits on the brow, with a row of windows in its upper half.
    `<path d="M-16.5 -17C-16 -35 17 -35 17.5 -17C13 -24 -12 -24 -16.5 -17Z" fill="${INK}"/>`,
    `<path d="M-14.8 -19C-13 -32.4 14.5 -32.4 15.8 -19C11 -25 -10.5 -25 -14.8 -19Z" fill="${PAPER}"/>`,
    `<g stroke="${INK}" stroke-width="1" fill="none">${windows.join("")}</g>`,
    `<path d="M-14.5 -18.6C-10 -24.6 11 -24.6 15.5 -18.6C11 -22.6 -10 -22.6 -14.5 -18.6Z" fill="${INK}"/>`,
  ].join("");
}

function portrait() {
  // Three-quarters to the right, so the far side of the face has its own
  // contour: the brow, the cheek, the lips and the chin.
  const face =
    "M-13 -19C-8 -23 9 -23 13 -19.5C14.3 -17 13.6 -15.8 13 -14.6C13.5 -12 13.2 -10.5 12.6 -8.8C12.9 -7.6 12.4 -6.6 11.6 -5.9C11.7 -4.9 11.2 -4.2 10.6 -3.6C10.6 -1.8 9.2 0.6 6.6 1.6C3 3 -1 2.2 -4 -0.4C-8.4 -3.8 -12.2 -8.5 -13.4 -13C-13.6 -15 -13.4 -17 -13 -19Z";
  const neck = "M-7.5 -1.5L-8.5 13C-3 19 6 19 10 13L8 1C4 3 -2 2 -7.5 -1.5Z";
  const robe = "M-44 54L-42 40C-34 30 -22 26 -13 20C-6 28 8 28 15 20C25 26 34 30 42 39L44 54Z";
  const headInk = [
    // The hair: a wave under the crown, then heavy locks behind the jaw.
    brush([-12.4, -20], [-6, -18], [-13.4, -12], 1.7),
    brush([-14, -19], [-23, -10], [-16, 4], 5),
    brush([-13, -10], [-20, -1], [-15, 11], 3.8),
    brush([-18, -13], [-25, -2], [-20, 13], 2.6),
    brush([14, -18.5], [18.5, -9], [13, 4], 2.8),
    brush([16, -13], [20, -4], [15.5, 9], 1.8),
    // The brows, thin at their ends.
    brush([-9.2, -16.5], [-3.2, -18.8], [2.6, -15.8], 0.65),
    brush([5.8, -15.9], [9.2, -18], [13, -16.2], 0.6),
    // The eyes: a heavy upper lid and a fine lower one, with no pupils, as on
    // a statue.
    brush([-8.2, -13.7], [-4, -15.2], [0.9, -13.3], 0.75),
    brush([-7.2, -13.2], [-3.6, -11.9], [0.7, -13.1], 0.45),
    brush([6.3, -13.3], [9, -14.8], [12, -13.7], 0.7),
    brush([7, -13], [9.4, -12], [11.7, -13.2], 0.4),
    // The nose: its shadowed far plane, the shadow under it and its near wing.
    "M4.6 -15.2L6.6 -11L8.7 -6.7L6.8 -5.9L6 -9.2Z",
    brush([1.4, -5.7], [4.8, -4.1], [8.6, -5.9], 1.2),
    brush([1.5, -7.4], [0.5, -5.8], [2.4, -5], 0.55),
    // The mouth: the line between the lips, and the shadow under the lower.
    brush([0.2, -2.5], [3.8, -1.5], [7.8, -2.8], 0.6),
    brush([1.8, -3.5], [4.6, -4.2], [7, -3.4], 0.4),
    brush([1.8, -0.4], [4.4, 0.5], [7.2, -0.6], 0.7),
    // The jaw's near edge, lost toward the chin.
    brush([-12.6, -9], [-8.5, -2.4], [-2, 1.9], 0.8),
  ];
  const robeInk = [
    // The folds fall from the neck and shoulders, and a sash crosses the chest.
    brush([-13, 21], [-29, 29], [-38, 49], 2.2),
    brush([-19, 29], [-27, 38], [-28, 54], 1.5),
    brush([-10, 28], [-19, 38], [-18, 55], 2.4),
    brush([-3, 29], [-11, 42], [-7, 55], 1.2),
    brush([-22, 40], [1, 33], [29, 53], 2.6),
    brush([-15, 45], [4, 39], [20, 54], 1.2),
    brush([8, 28], [15, 33], [20, 42], 1.8),
    brush([16, 21], [31, 28], [37, 48], 2.4),
    brush([24, 30], [31, 40], [32, 54], 1.4),
    // The collar's fold, under the neck.
    brush([-13.5, 20], [0, 31], [15.5, 20], 1.8),
    brush([-9, 24], [1, 33], [11, 25], 0.9),
  ];
  return [
    `<path d="${robe}" fill="${PAPER}" stroke="${INK}" stroke-width="0.8"/>`,
    `<path d="${hatch([[25, 34], [41, 42]], [[23, 54], [38, 54]], 16)}" fill="none" stroke="${ENGRAVE}" stroke-width="0.3"/>`,
    `<path d="${hatch([[-5, 36], [10, 37]], [[-7, 54], [18, 54]], 18)}" fill="none" stroke="${ENGRAVE}" stroke-width="0.3"/>`,
    `<path d="${robeInk.join("")}" fill="${INK}"/>`,
    `<g transform="translate(0 4) scale(1.14 1.2)">`,
    rays(),
    `<path d="${neck}" fill="${PAPER}" stroke="${INK}" stroke-width="0.45"/>`,
    // The neck's shadow, which the number prints over.
    `<path d="${hatch([[-7.5, 1], [8, 3]], [[-7, 15], [9.5, 14]], 20)}" fill="none" stroke="${ENGRAVE}" stroke-width="0.4"/>`,
    `<path d="${face}" fill="${PAPER}" stroke="${INK}" stroke-width="0.45"/>`,
    // The modeling: the far cheek, the eye sockets and the shadow from the crown.
    `<path d="${hatch([[8.8, -11.4], [8, -2.2]], [[12.4, -10.8], [10, -1.6]], 11)}" fill="none" stroke="${ENGRAVE}" stroke-width="0.22"/>`,
    `<path d="${hatch([[-8.5, -15.8], [1.6, -14.9]], [[-8, -14.3], [1.8, -13.6]], 10)}" fill="none" stroke="${ENGRAVE}" stroke-width="0.2"/>`,
    `<path d="${hatch([[-11, -20], [12, -20.4]], [[-11, -18], [12, -18.4]], 24)}" fill="none" stroke="${ENGRAVE}" stroke-width="0.24"/>`,
    `<path d="${headInk.join("")}" fill="${INK}"/>`,
    crown(),
    `</g>`,
  ].join("");
}

function emblem() {
  const { x, y } = CENTER;
  const { rx, ry } = OVAL_SIZE;
  return [
    `<clipPath id="oval"><ellipse rx="${rx}" ry="${ry}"/></clipPath>`,
    `<ellipse cx="${x}" cy="${y + 1}" rx="${rx + 2.6}" ry="${ry + 2.6}" fill="${INK}" fill-opacity="0.22"/>`,
    `<ellipse cx="${x}" cy="${y}" rx="${rx + 2.4}" ry="${ry + 2.4}" fill="#f6fbf6" stroke="${INK}" stroke-width="0.7"/>`,
    `<g transform="translate(${x} ${y})">`,
    `<ellipse rx="${rx}" ry="${ry}" fill="#dff1df" stroke="${INK}" stroke-width="0.5"/>`,
    `<g clip-path="url(#oval)">`,
    portrait(),
    `</g>`,
    `</g>`,
  ].join("");
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" preserveAspectRatio="none">
<defs>
<radialGradient id="face" cx="50%" cy="50%" r="72%"><stop offset="0" stop-color="#d9efd9"/><stop offset="1" stop-color="#a9d8ad"/></radialGradient>
${curtainLine()}
${motif()}
</defs>
<rect width="${WIDTH}" height="${HEIGHT}" rx="12" fill="url(#face)"/>
${field()}
${border()}
${emblem()}
${wordmark("EXAMPLE BANK", 18, 12.5, 1.16)}
</svg>
`;

writeFileSync(OUTPUT, svg);
console.log(`Wrote ${OUTPUT} (${(svg.length / 1024).toFixed(1)} KB)`);
