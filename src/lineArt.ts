import globeFoil from "./assets/images/incredicard-lines-globe.svg";
import globeMaskA from "./assets/images/incredicard-lines-globe-a.svg";
import globeMaskB from "./assets/images/incredicard-lines-globe-b.svg";
import ribbonsFoil from "./assets/images/incredicard-lines-ribbons.svg";
import ribbonsMaskA from "./assets/images/incredicard-lines-ribbons-a.svg";
import ribbonsMaskB from "./assets/images/incredicard-lines-ribbons-b.svg";

// The card face's line art. Each piece is three files drawn by a
// generator in scripts/ (see scripts/lineArt.mjs): the foil, which the
// face prints faintly and the hologram lights, and one mask per pair of
// glare layers, each holding exactly some of the foil's lines.
//
// A theme names its piece (`lineArt` in themes.ts), and the component
// writes the three URLs onto its root as custom properties
// (`--incredicard-lines`, `--incredicard-lines-mask-a`,
// `--incredicard-lines-mask-b`), which the stylesheets read wherever they
// draw the lines. Each file is still its own image document, so its
// gradient ids can't collide with another card's or the page's.
export const INCREDICARD_LINE_ART = {
  // Two fans of fine lines, each twisting once.
  ribbons: { foil: ribbonsFoil, maskA: ribbonsMaskA, maskB: ribbonsMaskB },
  // An engraved globe with North America on the card's right side. Mask A
  // is the land, mask B the sphere's rings and graticule.
  globe: { foil: globeFoil, maskA: globeMaskA, maskB: globeMaskB },
} as const;

export type IncrediCardLineArt = keyof typeof INCREDICARD_LINE_ART;
