// The "glass" theme's lens: a displacement map for the card's refraction
// filter (src/IncrediCardRefraction.tsx).
//
// An SVG displacement map moves each pixel by its red and green values:
// mid-gray leaves it alone, and the further from mid-gray, the further it
// looks for what to show. This map is mid-gray across the middle of the
// card and bends only in a band around the edge, pointing inward, the way
// a slab of glass with rounded edges pulls what's behind it in at the rim.
// So the backdrop stays calm behind the printed text and bends where it
// reads as thickness.
//
// The bend comes from the glass's shape rather than a chosen curve: the edge is
// a rounded profile, and each point's bend is how far a ray straight through it
// lands away from where it entered, by Snell's law. So it's strongest where the
// edge is steepest and fades out where the surface goes flat, and the distance
// to the card's rounded rectangle makes that follow the corners. The map is
// small because the filter stretches it to the card and the values change
// smoothly.

import { deflateSync } from "node:zlib";
import { join } from "node:path";
import { IMAGES_DIR } from "./lineArt.mjs";

export const LENS_FILE = join(IMAGES_DIR, "incredicard-glass-lens.png");

// The card's own proportions, in its 325x204 artwork units.
const CARD = { width: 325, height: 204, radius: 12 };

export const LENS = {
  width: 240,
  height: 150,
  // How far in from the edge the bend reaches, in artwork units. Narrow and
  // strong: this strip, where the backdrop is pulled in and squeezed, is what
  // makes the glass look thick. Short of the printed number, about 30 units
  // in.
  band: 20,
  // The rounded edge's shape: 2 is a circle's arc, and higher is a squarer
  // shoulder, with the bend gathered closer to the rim.
  curvature: 2,
  // How thick the slab is and how tall its rounded edge, in artwork units, and
  // how strongly the glass bends light. The thicker the slab, the further a ray
  // travels after bending.
  thickness: 20,
  edgeHeight: 20,
  refractiveIndex: 1.5,
  // The map's peak, as a share of the most the filter's `scale` can move a
  // pixel (IncrediCardRefraction).
  strength: 1,
};

/** The edge's height at a point `x` of the way in from the rim, 0 to 1. */
function edgeProfile(x, curvature) {
  return (1 - (1 - x) ** curvature) ** (1 / curvature);
}

/** How far a ray entering `x` of the way in from the rim lands from where it
 * entered, in artwork units. */
function rayOffset(x, { band, curvature, thickness, edgeHeight, refractiveIndex }) {
  const step = 1e-3;
  const lower = Math.max(x - step, 0);
  const upper = Math.min(x + step, 1);
  const slope = ((edgeProfile(upper, curvature) - edgeProfile(lower, curvature)) / (upper - lower)) * (edgeHeight / band);
  const incidence = Math.atan(slope);
  const refraction = Math.asin(Math.sin(incidence) / refractiveIndex);
  return (thickness + edgeHeight * edgeProfile(x, curvature)) * Math.tan(incidence - refraction);
}

/** Distance inside a rounded rectangle centered on the origin, and the unit
 * direction toward its interior. */
function insideDistance(x, y) {
  const halfW = CARD.width / 2 - CARD.radius;
  const halfH = CARD.height / 2 - CARD.radius;
  const qx = Math.abs(x) - halfW;
  const qy = Math.abs(y) - halfH;
  if (qx > 0 && qy > 0) {
    const corner = Math.hypot(qx, qy);
    return { distance: CARD.radius - corner, nx: (-Math.sign(x) * qx) / corner, ny: (-Math.sign(y) * qy) / corner };
  }
  return qx > qy
    ? { distance: CARD.radius - qx, nx: -Math.sign(x), ny: 0 }
    : { distance: CARD.radius - qy, nx: 0, ny: -Math.sign(y) };
}

/** Eases the bend to nothing across the band. A round edge's bend otherwise
 * stops at a sudden angle where the surface goes flat, and anything straight
 * behind the glass shows that as a kink. */
function settle(x) {
  return 1 - x * x * (3 - 2 * x);
}

/** The map's pixels, as rows of RGB bytes. */
export function lensPixels(options = LENS) {
  const { width, height, band, strength: peak } = options;
  // Scaled to the rim's own offset, the strongest there is.
  const rim = rayOffset(0, options);
  const rows = [];
  for (let row = 0; row < height; row++) {
    const pixels = Buffer.alloc(width * 3);
    for (let column = 0; column < width; column++) {
      const x = ((column + 0.5) / width - 0.5) * CARD.width;
      const y = ((row + 0.5) / height - 0.5) * CARD.height;
      const { distance, nx, ny } = insideDistance(x, y);
      const inward = Math.max(distance, 0) / band;
      const strength = inward >= 1 ? 0 : peak * (rayOffset(inward, options) / rim) * settle(inward);
      pixels[column * 3] = Math.round(127.5 + 127.5 * strength * nx);
      pixels[column * 3 + 1] = Math.round(127.5 + 127.5 * strength * ny);
      pixels[column * 3 + 2] = 128;
    }
    rows.push(pixels);
  }
  return rows;
}

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** The map as a PNG file's bytes. */
export function renderLens(options = LENS) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(options.width, 0);
  header.writeUInt32BE(options.height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // RGB
  const raw = Buffer.concat(lensPixels(options).flatMap((row) => [Buffer.from([0]), row]));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
