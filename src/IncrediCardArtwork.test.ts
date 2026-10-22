import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// These four files are not independent artwork: they are views of ONE
// set of ribbon vectors, and the hologram only works because of that.
//
//   incredicard-front-black.svg   the card's material: a gradient and
//                                 two inner shadows, NO ribbons
//   incredicard-front-holo.svg    the ribbons. Drawn twice: faint and
//                                 desaturated by `.face::before`, full
//                                 strength by `.holo`
//   incredicard-front-holo-a.svg  ribbon 1 alone, used as a mask
//   incredicard-front-holo-b.svg  ribbon 2 alone, used as a mask
//
// The glare layers are clipped to the -a/-b masks and must light up lines
// the face has already printed. If any one of these files is re-exported
// from a design tool on its own, that can stop being true, and INVISIBLY
// at first: a sub-pixel smear that only looks wrong once someone zooms
// the card. Two separate exports of one vector can disagree in the last
// decimal place, which is exactly the kind of thing a person can't
// reliably re-check by eye on every export.
//
// The face carries no copy of the ribbons (how faint they print is a CSS
// property instead), so the printed lines and the lit lines come from one
// file and cannot disagree. What remains testable is the split into
// masks, and that the face hasn't reacquired a second copy of the
// ribbons on a later export.
//
// So this asserts the relationship rather than the pixels: same
// coordinate system, same stretch, byte-identical path data. It is a
// guard on the ASSETS, not on any rendering, which is why it can run in
// plain Node with no DOM.
//
// If this fails after a re-export, the fix is to re-export the files
// together from the same source frames (or split the masks out of the
// merged foil file programmatically), not to relax the assertion.
const read = (name: string) =>
  readFileSync(
    fileURLToPath(new URL(`./assets/images/${name}`, import.meta.url)),
    "utf8",
  );

const FACE = "incredicard-front-black.svg";
const FOIL = "incredicard-front-holo.svg";
const MASK_A = "incredicard-front-holo-a.svg";
const MASK_B = "incredicard-front-holo-b.svg";
const ALL = [FACE, FOIL, MASK_A, MASK_B];

/** Every `d="..."` in document order. Deliberately a plain regex rather
 * than an XML parse: the assertion is about the literal strings these
 * files carry, and normalizing them through a parser is the one thing
 * that could hide a difference this test exists to catch. */
const pathData = (svg: string) =>
  [...svg.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1]);

describe("IncrediCard card-face artwork", () => {
  it.each(ALL)("%s shares one coordinate system", (name) => {
    expect(read(name)).toContain('viewBox="0 0 325 204"');
  });

  // The other half of the mapping, and the half that is easy to drop on
  // a re-export because design tools typically don't write it: without
  // this, an svg used as a CSS image scales uniformly and centers itself
  // (`xMidYMid meet`) instead of stretching to the box it is given. The
  // card renders at 1.586:1 against the artwork's 1.593:1, so a file
  // missing this would sit about half a pixel short at top and bottom
  // while every other layer filled the box, exactly the misalignment
  // these files exist to prevent. See `.holo` in
  // IncrediCardHologram.module.scss.
  it.each(ALL)("%s stretches to its box rather than fitting", (name) => {
    expect(read(name)).toContain('preserveAspectRatio="none"');
  });

  it("splits the foil into exactly the two masks, losing nothing", () => {
    const foil = pathData(read(FOIL));

    expect(foil).toHaveLength(2);
    expect(pathData(read(MASK_A))).toEqual([foil[0]]);
    expect(pathData(read(MASK_B))).toEqual([foil[1]]);
  });

  // The face is the card's MATERIAL and nothing else. A copy of the
  // ribbons in the face could drift from the foil's, so the face has none,
  // and this asserts it stays that way: a re-export of the source frame
  // with the ribbon layer still visible would silently double them up,
  // printing one set that tracks the foil and one that does not.
  it("keeps the face free of its own copy of the ribbons", () => {
    expect(pathData(read(FACE))).toEqual([]);
  });

  // ...and that the ribbons themselves carry no baked-in opacity, since
  // how faint they print is a CSS decision
  // (`--incredicard-face-lines-opacity`) made twice from one file. An
  // export with an opacity attribute would silently multiply against it.
  it("leaves the ribbons' own strength to CSS", () => {
    expect(read(FOIL)).not.toContain("opacity=");
  });
});
