// What every piece of the card face's line art shares, whichever
// generator draws it (ribbons.mjs, globe.mjs).
//
// A piece of line art is three files: the foil (`<name>.svg`, all of its
// lines in color) and one mask per glare pair (`<name>-a.svg`,
// `<name>-b.svg`). The face prints the foil faintly, the hologram lights
// it, and each pair of glare layers is clipped to one mask, so every
// line in a mask must be exactly a line in the foil. Writing all three
// from the same element strings is what guarantees that, and
// IncrediCardArtwork.test.ts checks it.
//
// The rules every piece follows, so the stylesheets can treat them alike:
// - the 325x204 viewBox, stretched to the card (`preserveAspectRatio="none"`);
// - one gradient for the foil's color, the same stops for every piece, so
//   the iridescence matches whichever art a theme uses;
// - no `opacity` anywhere: how faint the lines print is a CSS decision,
//   and a line's strength comes only from its width;
// - every element carries its own geometry, with no transform, clip path
//   or mask, so a mask's elements can be compared with the foil's as text.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const IMAGES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "assets", "images");

export const WIDTH = 325;
export const HEIGHT = 204;

/** The three files for a piece of line art named `name`. */
export const lineArtFiles = (name) => ({
  foil: `incredicard-lines-${name}.svg`,
  maskA: `incredicard-lines-${name}-a.svg`,
  maskB: `incredicard-lines-${name}-b.svg`,
});

// Coordinates are written to two decimals: a hundredth of a viewBox unit
// is under a tenth of a pixel on a full-width card.
export const fmt = (n) => {
  const s = (Math.round(n * 100) / 100).toFixed(2).replace(/\.?0+$/, "");
  return s === "-0" ? "0" : s;
};

// The foil's colors run across each group's own span. Lightness stays high
// throughout: the face prints these desaturated and very faint, and the
// hologram blends them with color-dodge, which only brightens.
const STOPS = [
  [0, "#F98BE4"],
  [0.18, "#FFC9AE"],
  [0.36, "#F1F7B8"],
  [0.54, "#9FF5C8"],
  [0.72, "#72E6FA"],
  [0.87, "#7A8CF7"],
  [1, "#D9A2FB"],
];

export function gradient(id, [x1, x2]) {
  const stops = STOPS.map(([offset, color]) => `<stop offset="${offset}" stop-color="${color}"/>`).join("\n");
  return `<linearGradient id="${id}" x1="${x1}" y1="0" x2="${x2}" y2="0" gradientUnits="userSpaceOnUse">\n${stops}\n</linearGradient>`;
}

/** A complete file. `rootAttributes` are geometry every element shares
 * (a stroked piece's line caps, say), so they're identical in all three
 * files. */
export const svg = (body, rootAttributes = "") =>
  `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" preserveAspectRatio="none" fill="none"${rootAttributes} xmlns="http://www.w3.org/2000/svg">\n${body}\n</svg>\n`;

/** The committed files' contents, keyed as in `files`. */
export function readCommitted(files) {
  return Object.fromEntries(Object.entries(files).map(([key, name]) => [key, readFileSync(join(IMAGES_DIR, name), "utf8")]));
}

export function writeLineArt(files, rendered, dir = IMAGES_DIR) {
  for (const [key, name] of Object.entries(files)) writeFileSync(join(dir, name), rendered[key]);
}
