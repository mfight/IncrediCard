// Draws the demo's engraved card (demo/themes/engraved-card.svg): a pale green
// face covered in fine engraved lines and a repeating motif, a dark ornamental
// border, and an issuer's wordmark and emblem. It's the artwork for an example of a custom
// theme, for a fictional issuer, and isn't part of the npm package.
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

// The issuer's emblem: an engraved compass in an oval medallion, up and to the
// right, clear of the number, the name and the chip.
function emblem() {
  const [cx, cy, rx, ry] = [254, 69, 21, 27];
  const hatch = [];
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const inner = i % 2 ? 0.62 : 0.5;
    hatch.push(
      `<path d="${path([
        [cx + rx * inner * Math.cos(a), cy + ry * inner * Math.sin(a)],
        [cx + rx * 0.97 * Math.cos(a), cy + ry * 0.97 * Math.sin(a)],
      ])}"/>`,
    );
  }
  const point = (angle, length, width, fill) => {
    const tip = [cx + length * rx * Math.cos(angle), cy + length * ry * Math.sin(angle)];
    const side = (delta) => [cx + width * Math.cos(angle + delta), cy + width * Math.sin(angle + delta)];
    return `<path d="${path([tip, side(Math.PI / 2), side(-Math.PI / 2)])}Z" fill="${fill}"/>`;
  };
  const points = [];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2;
    points.push(i % 2 ? point(a, 0.5, 2.6, "#7fb18c") : point(a, 0.86, 3.6, "#e6f4e6"));
  }
  return [
    `<ellipse cx="${cx}" cy="${cy + 0.8}" rx="${rx + 2.4}" ry="${ry + 2.4}" fill="${INK}" fill-opacity="0.25"/>`,
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx + 2.2}" ry="${ry + 2.2}" fill="#f3faf3" stroke="${INK}" stroke-width="0.8"/>`,
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${INK}"/>`,
    `<g fill="none" stroke="#9cc7a6" stroke-width="0.35">${hatch.join("")}</g>`,
    points.join(""),
    `<circle cx="${cx}" cy="${cy}" r="1.7" fill="${INK}" stroke="#e6f4e6" stroke-width="0.5"/>`,
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
<text x="70" y="38" font-family="'Arial Black', 'Helvetica Neue', Arial, sans-serif" font-weight="900" font-size="15.5" letter-spacing="0.4" fill="${INK}">EXAMPLE BANK</text>
</svg>
`;

writeFileSync(OUTPUT, svg);
console.log(`Wrote ${OUTPUT} (${(svg.length / 1024).toFixed(1)} KB)`);
