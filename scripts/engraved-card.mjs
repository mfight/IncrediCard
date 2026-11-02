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

// The emblem: an engraved head of Liberty in profile, in an oval at the center
// of the card. The number prints across it, so the engraving stays a mid green
// that dark text reads over, with its heaviest ink above and below the number.
const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 };
const OVAL_SIZE = { rx: 40, ry: 50 };
const ENGRAVE = "#3f7d58";
const ENGRAVE_DARK = "#1d4a33";

function hatch(from, to, count, bend) {
  const lines = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    const [x1, y1] = [from[0][0] + (from[1][0] - from[0][0]) * t, from[0][1] + (from[1][1] - from[0][1]) * t];
    const [x2, y2] = [to[0][0] + (to[1][0] - to[0][0]) * t, to[0][1] + (to[1][1] - to[0][1]) * t];
    lines.push(`M${fmt(x1)} ${fmt(y1)}Q${fmt((x1 + x2) / 2 + bend[0])} ${fmt((y1 + y2) / 2 + bend[1])} ${fmt(x2)} ${fmt(y2)}`);
  }
  return `<path d="${lines.join("")}"/>`;
}

function emblem() {
  const { x, y } = CENTER;
  const { rx, ry } = OVAL_SIZE;
  // All in the oval's own coordinates: the head looks right.
  const head =
    "M15 -21C19 -16 20 -12 19 -8C20 -5 25 0 26 3C26 5 23 6 21 6C22 8 22 9 21 10C22 11 22 13 20 14C21 17 20 21 16 23C11 25 7 26 3 25C3 30 5 36 11 42L14 54H-26L-20 36C-20 30 -20 26 -22 20C-29 10 -30 -6 -24 -15C-14 -26 4 -28 15 -21Z";
  const rays = [];
  for (const degrees of [-165, -140, -116, -92, -68, -44, -20]) {
    const a = (degrees * Math.PI) / 180;
    const base = 21;
    const tip = 44;
    const [ox, oy] = [-3, -9];
    const across = 0.13;
    const at = (r, delta) => `${fmt(ox + r * Math.cos(a + delta))} ${fmt(oy + r * Math.sin(a + delta))}`;
    rays.push(
      `<path d="M${at(base, across)}L${at(tip, 0)}L${at(base, -across)}Z" fill="#eef8ee" stroke="${ENGRAVE_DARK}" stroke-width="0.6"/>`,
      `<path d="M${at(base, 0)}L${at(tip - 2, 0)}L${at(base, -across)}Z" fill="${ENGRAVE_DARK}"/>`,
    );
  }
  const hair = [];
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const startX = 13 - t * 28;
    const startY = -9 + t * 2;
    hair.push(
      `M${fmt(startX)} ${fmt(startY)}C${fmt(startX - 9)} ${fmt(startY + 4)} ${fmt(startX + 1)} ${fmt(startY + 10)} ${fmt(startX - 8)} ${fmt(startY + 16)}S${fmt(-22 + t * 3)} ${fmt(startY + 24)} ${fmt(-20 - t * 6)} ${fmt(26 - t * 6)}`,
    );
  }
  const drape = [];
  for (let i = 0; i < 7; i++) {
    const offset = i * 7;
    drape.push(`M${fmt(-36 + offset)} 50C${fmt(-28 + offset)} 40 ${fmt(-24 + offset)} ${fmt(38 + i * 0.7)} ${fmt(-14 + offset)} ${fmt(36 + i)}`);
  }
  return [
    `<clipPath id="oval"><ellipse rx="${rx}" ry="${ry}"/></clipPath>`,
    `<ellipse cx="${x}" cy="${y + 1}" rx="${rx + 2.6}" ry="${ry + 2.6}" fill="${INK}" fill-opacity="0.22"/>`,
    `<ellipse cx="${x}" cy="${y}" rx="${rx + 2.4}" ry="${ry + 2.4}" fill="#f6fbf6" stroke="${INK}" stroke-width="0.7"/>`,
    `<g transform="translate(${x} ${y})">`,
    `<ellipse rx="${rx}" ry="${ry}" fill="#dff1df" stroke="${INK}" stroke-width="0.5"/>`,
    `<g clip-path="url(#oval)">`,
    // The sky behind the head: fine engraved lines, heavier toward the top.
    `<g fill="none" stroke="${ENGRAVE}" stroke-width="0.22">`,
    hatch([[-42, -50], [-42, 52]], [[42, -50], [42, 52]], 52, [0, 1.5]),
    `</g>`,
    rays.join(""),
    `<path d="${head}" fill="#eaf6ea" stroke="${ENGRAVE_DARK}" stroke-width="0.8"/>`,
    // Shading: the neck and the jaw, then the hair.
    `<g fill="none" stroke="${ENGRAVE}" stroke-width="0.3">`,
    hatch([[-18, 22], [4, 28]], [[-22, 54], [12, 54]], 18, [2, 0]),
    hatch([[-4, 2], [3, 24]], [[6, -4], [14, 22]], 10, [1, 1]),
    `</g>`,
    `<path d="${hair.join("")}" fill="none" stroke="${ENGRAVE_DARK}" stroke-width="0.8" stroke-linecap="round"/>`,
    // The crown's band, across the brow to the back of the head.
    `<path d="M16 -14C4 -19 -14 -19 -28 -9L-26 -16C-13 -26 5 -26 16 -21Z" fill="${ENGRAVE_DARK}"/>`,
    `<path d="M13 -18C2 -22 -12 -21 -25 -12.5" fill="none" stroke="#eaf6ea" stroke-width="0.6" stroke-dasharray="1.6 1.6"/>`,
    // The eye and brow, the lips' line and the nostril.
    `<path d="M9 -9C12 -11 15 -11 18 -9M10 -5C12 -7 15 -7 17 -5C15 -4 12 -4 10 -5ZM14 8.6C16 8.4 18 8.4 21 9.6M17 2.4C19 1.6 21 2 22 3" fill="none" stroke="${ENGRAVE_DARK}" stroke-width="0.7" stroke-linecap="round"/>`,
    // The robe, over the shoulder.
    `<path d="M-40 54L-30 38C-20 32 -2 32 12 42L24 54Z" fill="#d8ecd8" stroke="${ENGRAVE_DARK}" stroke-width="0.7"/>`,
    `<path d="${drape.join("")}" fill="none" stroke="${ENGRAVE_DARK}" stroke-width="0.55"/>`,
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
