// The "atlas" theme's line art: an engraved globe, drawn from
// globe-source.svg.
//
// The source is a globe on a 1600x1000 card. Only its geometry is used: the
// three rings around the sphere, the graticule, the coastlines, and the
// wavy engraving lines that hatch the land. Its own colors, background
// and opacities are dropped; the lines take the same foil gradient as
// every other piece of line art, and their strength comes only from their
// width (see lineArt.mjs).
//
// PLACEMENT moves and scales the whole drawing within the card, in the
// source's units. The card's top edge crosses the globe where the
// source's does; the globe is scaled about that edge until the bottom
// edge cuts through the middle of Cuba, then moved right so North America
// sits on the card's right side.
//
// The source hatches the land by clipping its engraving lines to the
// coastline. A clip path would make a mask's geometry depend on more than
// its own elements, so here the engraving lines are cut at the coastline
// instead, and only the pieces over land are drawn. Everything is then
// trimmed to the card and simplified: the source carries far more points
// than a card-sized drawing can show.
//
// Two groups, one per glare pair: the land (engraving and coastlines) is
// lit by `.glareRadial` and its reverse, the sphere (rings and graticule)
// by `.glareLinear` and its reverse.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { HEIGHT, WIDTH, fmt, gradient, lineArtFiles, svg } from "./lineArt.mjs";

export const FILES = lineArtFiles("globe");

export const SOURCE = join(dirname(fileURLToPath(import.meta.url)), "globe-source.svg");

const SOURCE_WIDTH = 1600;
const SOURCE_HEIGHT = 1000;

// Cuba's outline spans y 631 to 703 in the source, so its middle is at
// 667: scaling by 1000 / 667 about the top edge brings that to the bottom
// edge. The shift is a quarter of the card's width.
export const PLACEMENT = {
  scale: 1.5,
  anchor: [800, 0],
  shift: [400, 0],
};

// Stroke widths in card units (the ribbons' lines run 0.4 to 1.05). The
// source's relative strengths were opacities; these carry the same
// ordering as widths: the outer ring and the coastline strongest, the
// engraving and graticule finest.
export const WEIGHTS = {
  rings: [1, 0.5, 0.35],
  coastline: 0.8,
  engraving: 0.45,
  graticule: 0.4,
};

// Points closer than this to the line between their neighbors are
// dropped, in card units: a twentieth of a unit is about a twentieth of a
// pixel on a full-width card.
const TOLERANCE = 0.05;

// How far past the card's edges a line is kept, so that every line runs
// off the card rather than stopping at its edge.
const MARGIN = 2;

// Points per engraving curve when it is flattened for cutting at the
// coastline. The curves span the whole source card, so this keeps each
// piece under a unit long on the card.
const ENGRAVING_SAMPLES = 480;

/** The source-to-card mapping: PLACEMENT within the source, then the
 * source's 1600x1000 onto the card's 325x204. */
function transformer({ scale, anchor, shift }) {
  const kx = WIDTH / SOURCE_WIDTH;
  const ky = HEIGHT / SOURCE_HEIGHT;
  return {
    point: ([x, y]) => [(anchor[0] + scale * (x - anchor[0]) + shift[0]) * kx, (anchor[1] + scale * (y - anchor[1]) + shift[1]) * ky],
    rx: (r) => r * scale * kx,
    ry: (r) => r * scale * ky,
  };
}

const numbers = (text) => text.match(/-?\d*\.?\d+(?:e-?\d+)?/g).map(Number);

const pairs = (values) => {
  const points = [];
  for (let i = 0; i < values.length; i += 2) points.push([values[i], values[i + 1]]);
  return points;
};

/** A path of M/L/Z commands as polylines, each closed one repeating its
 * first point at the end. */
function polylines(d) {
  return d
    .split("M")
    .slice(1)
    .map((part) => {
      const points = pairs(numbers(part));
      return /Z\s*$/i.test(part) ? [...points, points[0]] : points;
    });
}

const inside = ([x, y], margin) => x >= -margin && x <= WIDTH + margin && y >= -margin && y <= HEIGHT + margin;

/** The runs of a polyline that cross the card, each extended by one point
 * past the edge so that it leaves the card. */
function trim(points) {
  const keep = points.map((p, i) => inside(p, MARGIN) || inside(points[i - 1] ?? p, MARGIN) || inside(points[i + 1] ?? p, MARGIN));
  const runs = [];
  let run = [];
  points.forEach((p, i) => {
    if (keep[i]) run.push(p);
    else if (run.length) {
      runs.push(run);
      run = [];
    }
  });
  if (run.length) runs.push(run);
  return runs.filter((r) => r.length > 1);
}

/** Ramer-Douglas-Peucker: the fewest points within TOLERANCE of the
 * original line. */
function simplify(points) {
  if (points.length < 3) return points;
  const [ax, ay] = points[0];
  const [bx, by] = points[points.length - 1];
  const length = Math.hypot(bx - ax, by - ay);
  let farthest = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i];
    const distance =
      length === 0 ? Math.hypot(px - ax, py - ay) : Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / length;
    if (distance > farthest) {
      farthest = distance;
      index = i;
    }
  }
  if (farthest <= TOLERANCE) return [points[0], points[points.length - 1]];
  return [...simplify(points.slice(0, index + 1)).slice(0, -1), ...simplify(points.slice(index))];
}

const pathData = (lines) =>
  lines
    .map((line) => `M${fmt(line[0][0])} ${fmt(line[0][1])}L${line.slice(1).map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join(" ")}`)
    .join("");

/** The points of a cubic at `samples` even steps of t. */
function flatten([p0, p1, p2, p3], samples) {
  const points = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    points.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]);
  }
  return points;
}

/** Each coastline ring's edges with their bounding box, so a point or
 * segment nowhere near an island skips its edges entirely. */
function landRings(rings) {
  return rings.map((ring) => {
    const xs = ring.map((p) => p[0]);
    const ys = ring.map((p) => p[1]);
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
      edges: ring.slice(1).map((q, i) => [ring[i], q]),
    };
  });
}

/** Whether a point is on land: inside an odd number of coastline rings. */
function onLand([x, y], land) {
  let crossings = 0;
  for (const ring of land) {
    if (y < ring.minY || y > ring.maxY || x > ring.maxX) continue;
    for (const [[x1, y1], [x2, y2]] of ring.edges) {
      if (y1 > y !== y2 > y && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) crossings++;
    }
  }
  return crossings % 2 === 1;
}

/** Where segment p-q crosses segment a-b, as a fraction along p-q. */
function crossing(p, q, a, b) {
  const rx = q[0] - p[0];
  const ry = q[1] - p[1];
  const sx = b[0] - a[0];
  const sy = b[1] - a[1];
  const denominator = rx * sy - ry * sx;
  if (denominator === 0) return null;
  const t = ((a[0] - p[0]) * sy - (a[1] - p[1]) * sx) / denominator;
  const u = ((a[0] - p[0]) * ry - (a[1] - p[1]) * rx) / denominator;
  return t > 0 && t < 1 && u >= 0 && u <= 1 ? t : null;
}

/** The parts of a polyline over land, cut exactly at the coastline. */
function overLand(points, land) {
  const runs = [];
  let run = [];
  const close = () => {
    if (run.length > 1) runs.push(run);
    run = [];
  };
  let wasOnLand = null;
  for (let i = 0; i < points.length - 1; i++) {
    const p = points[i];
    const q = points[i + 1];
    const minX = Math.min(p[0], q[0]);
    const maxX = Math.max(p[0], q[0]);
    const minY = Math.min(p[1], q[1]);
    const maxY = Math.max(p[1], q[1]);
    const cuts = [0, 1];
    for (const ring of land) {
      if (ring.maxX < minX || ring.minX > maxX || ring.maxY < minY || ring.minY > maxY) continue;
      for (const [a, b] of ring.edges) {
        if (Math.max(a[0], b[0]) < minX || Math.min(a[0], b[0]) > maxX || Math.max(a[1], b[1]) < minY || Math.min(a[1], b[1]) > maxY) continue;
        const t = crossing(p, q, a, b);
        if (t !== null) cuts.push(t);
      }
    }
    cuts.sort((x, y) => x - y);
    for (let k = 0; k < cuts.length - 1; k++) {
      const start = [p[0] + (q[0] - p[0]) * cuts[k], p[1] + (q[1] - p[1]) * cuts[k]];
      const end = [p[0] + (q[0] - p[0]) * cuts[k + 1], p[1] + (q[1] - p[1]) * cuts[k + 1]];
      // A piece can only change between land and sea where the line
      // crosses the coastline, so an uncut segment carries on whatever the
      // piece before it was, and the full test (every coastline edge) runs
      // only where a crossing could have changed the answer.
      if (cuts.length > 2 || wasOnLand === null) {
        wasOnLand = onLand([(start[0] + end[0]) / 2, (start[1] + end[1]) / 2], land);
      }
      if (wasOnLand) {
        if (!run.length) run.push(start);
        run.push(end);
      } else close();
    }
  }
  close();
  return runs;
}

/** The source's pieces, by what they draw. */
export function parseSource(source) {
  const body = source.replace(/<defs>[\s\S]*?<\/defs>/, "");
  const rings = [...body.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/g)].map((m) => ({
    center: [Number(m[1]), Number(m[2])],
    r: Number(m[3]),
  }));
  const graticule = [...body.matchAll(/<path d="([^"]+)" stroke-width="\.7"/g)].map((m) => m[1]);
  const engraving = [...body.match(/<g id="continental-engraving"[^>]*>([\s\S]*?)<\/g>/)[1].matchAll(/\sd="([^"]+)"/g)].map(
    (m) => pairs(numbers(m[1])),
  );
  const coastline = body.match(/<path[^>]*id="coastlines"[^>]*>/)[0].match(/\sd="([^"]+)"/)[1];
  return { rings, graticule, engraving, coastline };
}

/** The three files' contents, keyed as in FILES. */
export function renderGlobe(source = readFileSync(SOURCE, "utf8"), placement = PLACEMENT, weights = WEIGHTS) {
  const { rings, graticule, engraving, coastline } = parseSource(source);
  const t = transformer(placement);

  const coastRings = polylines(coastline).map((ring) => ring.map(t.point));
  const land = landRings(coastRings);

  const coast = coastRings.flatMap(trim).map(simplify);
  const engraved = engraving
    .map((curve) => flatten(curve.map(t.point), ENGRAVING_SAMPLES))
    .flatMap(trim)
    .flatMap((points) => overLand(points, land))
    .map(simplify);
  const grid = graticule.flatMap((d) => polylines(d).map((line) => line.map(t.point))).flatMap(trim).map(simplify);

  const landLines = [
    `<path d="${pathData(engraved)}" stroke-width="${weights.engraving}" PAINT_A/>`,
    `<path d="${pathData(coast)}" stroke-width="${weights.coastline}" PAINT_A/>`,
  ];
  const sphereLines = [
    ...rings.map((ring, i) => {
      const [cx, cy] = t.point(ring.center);
      return `<ellipse cx="${fmt(cx)}" cy="${fmt(cy)}" rx="${fmt(t.rx(ring.r))}" ry="${fmt(t.ry(ring.r))}" stroke-width="${weights.rings[i]}" PAINT_B/>`;
    }),
    `<path d="${pathData(grid)}" stroke-width="${weights.graticule}" PAINT_B/>`,
  ];

  const paint = (elements, a, b) => elements.join("\n").replaceAll("PAINT_A", a).replaceAll("PAINT_B", b);
  const root = ' stroke-linecap="round" stroke-linejoin="round"';
  return {
    foil: svg(
      `${paint([...landLines, ...sphereLines], 'stroke="url(#globe-a)"', 'stroke="url(#globe-b)"')}\n<defs>\n${gradient("globe-a", [0, WIDTH])}\n${gradient("globe-b", [0, WIDTH])}\n</defs>`,
      root,
    ),
    maskA: svg(paint(landLines, 'stroke="#fff"', ""), root),
    maskB: svg(paint(sphereLines, "", 'stroke="#fff"'), root),
  };
}
