import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LENS, LENS_FILE, lensPixels, renderLens } from "../scripts/glassLens.mjs";
import { FILES as GLOBE_FILES, renderGlobe } from "../scripts/globe.mjs";
import { readCommitted } from "../scripts/lineArt.mjs";
import { COMPOSITION, FILES as RIBBON_FILES, renderRibbons } from "../scripts/ribbons.mjs";
import { INCREDICARD_LINE_ART } from "./lineArt";

// The card face's artwork is the card's material plus one piece of line
// art per theme, and each piece is three files that are not independent
// artwork: they are views of ONE set of lines, and the hologram only
// works because of that.
//
//   incredicard-front-black.svg      the card's material: a gradient and
//                                    two inner shadows, NO lines
//   incredicard-lines-<name>.svg     the foil. Drawn twice: faint and
//                                    desaturated by `.face::before`, full
//                                    strength by `.holo`
//   incredicard-lines-<name>-a.svg   the first group of lines alone, used
//                                    as a mask
//   incredicard-lines-<name>-b.svg   the second group alone, used as a mask
//
// The glare layers are clipped to the -a/-b masks and must light up lines
// the face has already printed. If any one of these files is written on
// its own, that can stop being true, and INVISIBLY at first: a sub-pixel
// smear that only looks wrong once someone zooms the card. Two separate
// exports of one vector can disagree in the last decimal place, which is
// exactly the kind of thing a person can't reliably re-check by eye.
//
// Each piece is drawn by a generator in scripts/ that writes its three
// files together from the same element strings (`npm run
// artwork:line-art`). The first test holds the committed files to that
// output, so a hand edit to one file, or an edited drawing that was never
// regenerated, fails here rather than shipping. The rest check the
// relationship directly, which is what the hologram depends on.
//
// This asserts the relationship rather than the pixels: same coordinate
// system, same stretch, and the masks' elements identical to the foil's
// apart from their paint. It is a guard on the ASSETS, not on any
// rendering, which is why it can run in plain Node with no DOM.
//
// If this fails, the fix is to regenerate the line art (or, for the face,
// re-export it without any lines), not to relax the assertion.
const read = (name: string) =>
  readFileSync(
    fileURLToPath(new URL(`./assets/images/${name}`, import.meta.url)),
    "utf8",
  );

const FACE = "incredicard-front-black.svg";

const PIECES = {
  ribbons: { files: RIBBON_FILES, render: () => renderRibbons(COMPOSITION) },
  globe: { files: GLOBE_FILES, render: () => renderGlobe() },
};

/** Every drawn element, as written. Deliberately a plain regex rather
 * than an XML parse: the assertion is about the literal strings these
 * files carry, and normalizing them through a parser is the one thing
 * that could hide a difference this test exists to catch. */
const elements = (svg: string) =>
  [...svg.matchAll(/<(?:path|ellipse|circle|line|polyline|polygon|rect)\b[^>]*\/>/g)].map((m) => m[0]);

/** The same, without paint: what a mask and the foil must agree on. */
const geometry = (svg: string) => elements(svg).map((e) => e.replace(/\s(?:fill|stroke)="[^"]*"/g, ""));

const rootTag = (svg: string) => svg.match(/<svg\b[^>]*>/)![0];

describe("IncrediCard card-face artwork", () => {
  it("has a generator for every piece of line art the themes can name", () => {
    expect(Object.keys(INCREDICARD_LINE_ART)).toEqual(Object.keys(PIECES));
    for (const [name, { files }] of Object.entries(PIECES)) {
      const urls = INCREDICARD_LINE_ART[name as keyof typeof INCREDICARD_LINE_ART];
      expect(urls.foil).toContain(files.foil);
      expect(urls.maskA).toContain(files.maskA);
      expect(urls.maskB).toContain(files.maskB);
    }
  });

  // The other half of the mapping, and the half that is easy to drop on
  // a re-export because design tools typically don't write it: without
  // `preserveAspectRatio="none"`, an svg used as a CSS image scales
  // uniformly and centers itself (`xMidYMid meet`) instead of stretching
  // to the box it is given. The card renders at 1.586:1 against the
  // artwork's 1.593:1, so a file missing this would sit about half a
  // pixel short at top and bottom while every other layer filled the
  // box, exactly the misalignment these files exist to prevent. See
  // `.holo` in IncrediCardHologram.module.scss.
  it(`${FACE} shares the line art's coordinate system and stretch`, () => {
    expect(read(FACE)).toContain('viewBox="0 0 325 204"');
    expect(read(FACE)).toContain('preserveAspectRatio="none"');
  });

  // The face is the card's MATERIAL and nothing else. A copy of any lines
  // in the face could drift from the foil's, so the face has none, and
  // this asserts it stays that way: a re-export of the source frame with
  // a line layer still visible would silently double them up, printing
  // one set that tracks the foil and one that does not.
  it("keeps the face free of its own copy of the lines", () => {
    expect(elements(read(FACE)).filter((e) => e.startsWith("<path"))).toEqual([]);
  });

  describe("the glass lens", () => {
    /** A PNG's raw scanlines. Compared rather than its bytes, which depend
     * on the zlib that compressed it. */
    const scanlines = (png: Buffer) => {
      const parts: Buffer[] = [];
      for (let at = 8; at < png.length; at += png.readUInt32BE(at) + 12) {
        if (png.toString("latin1", at + 4, at + 8) === "IDAT") parts.push(png.subarray(at + 8, at + 8 + png.readUInt32BE(at)));
      }
      return inflateSync(Buffer.concat(parts));
    };

    it("commits exactly what its generator draws", () => {
      expect(scanlines(readFileSync(LENS_FILE)).equals(scanlines(renderLens()))).toBe(true);
    });

    // The whole point of a lens rather than noise: the backdrop behind the
    // printed text doesn't move.
    it("bends most at the rim, and fades to nothing by the end of its band", () => {
      const row = lensPixels()[Math.floor(LENS.height / 2)];
      const bandEnd = Math.ceil((LENS.band / 325) * LENS.width);
      const bends = Array.from({ length: bandEnd + 2 }, (_, column) => row[column * 3] - 128);
      expect(bends[0]).toBeGreaterThan(100);
      for (let column = 1; column < bends.length; column++) {
        expect(bends[column]).toBeLessThanOrEqual(bends[column - 1]);
      }
      expect(bends[bandEnd + 1]).toBe(0);
    });

    it("leaves the middle of the card alone and bends inward at the edge", () => {
      const rows = lensPixels();
      const pixel = (column: number, row: number) => [...rows[row].subarray(column * 3, column * 3 + 2)];
      const middleRow = Math.floor(LENS.height / 2);
      expect(pixel(Math.floor(LENS.width / 2), middleRow)).toEqual([128, 128]);
      expect(pixel(0, middleRow)[0]).toBeGreaterThan(200);
      expect(pixel(LENS.width - 1, middleRow)[0]).toBeLessThan(55);
      expect(pixel(Math.floor(LENS.width / 2), 0)[1]).toBeGreaterThan(200);
      expect(pixel(Math.floor(LENS.width / 2), LENS.height - 1)[1]).toBeLessThan(55);
    });
  });

  describe.each(Object.entries(PIECES))("the %s line art", (_name, { files, render }) => {
    const committed = readCommitted(files);

    it("commits exactly what its generator draws", () => {
      expect(committed).toEqual(render());
    });

    it("stretches all three files to the same box in the same coordinates", () => {
      for (const svg of Object.values(committed)) {
        expect(svg).toContain('viewBox="0 0 325 204"');
        expect(svg).toContain('preserveAspectRatio="none"');
      }
      // Root attributes are geometry too (a stroked piece's line caps).
      expect(rootTag(committed.maskA)).toBe(rootTag(committed.foil));
      expect(rootTag(committed.maskB)).toBe(rootTag(committed.foil));
    });

    it("splits the foil into exactly the two masks, losing nothing", () => {
      const foil = geometry(committed.foil);
      const a = geometry(committed.maskA);
      const b = geometry(committed.maskB);

      expect(a.length).toBeGreaterThan(0);
      expect(b.length).toBeGreaterThan(0);
      expect(foil).toEqual([...a, ...b]);
    });

    // A mask's elements are compared with the foil's as text, so all of
    // an element's geometry has to be in the element itself. A transform,
    // clip path or mask would change the shape from outside it, and could
    // differ between the files without the elements differing.
    it("keeps every element's geometry in the element", () => {
      for (const svg of Object.values(committed)) {
        expect(svg).not.toMatch(/\stransform=|\sclip-path=|\smask=|<use\b|<clipPath|<mask\b/);
      }
    });

    // How faint the lines print is a CSS decision
    // (`--incredicard-face-lines-opacity`) made twice from one file, so
    // the lines carry no baked-in opacity of their own; an opacity
    // attribute would silently multiply against it. A line's strength
    // comes only from its width.
    it("leaves the lines' strength to CSS", () => {
      for (const svg of Object.values(committed)) expect(svg).not.toContain("opacity=");
    });
  });
});
