#!/usr/bin/env node
// CLI: redraws every piece of the card face's line art and writes its
// three files (see lineArt.mjs). Change a drawing by editing its
// generator's settings (COMPOSITION in ribbons.mjs, PLACEMENT and WEIGHTS
// in globe.mjs), then run this. It also draws the glass theme's lens
// (glassLens.mjs). A unit test fails until the committed
// files match the generators again.
//
// Usage: npm run artwork:line-art

import { writeFileSync } from "node:fs";
import { FILES as GLOBE_FILES, renderGlobe } from "./globe.mjs";
import { LENS_FILE, renderLens } from "./glassLens.mjs";
import { IMAGES_DIR, writeLineArt } from "./lineArt.mjs";
import { COMPOSITION, FILES as RIBBON_FILES, renderRibbons } from "./ribbons.mjs";

for (const [files, rendered] of [
  [RIBBON_FILES, renderRibbons(COMPOSITION)],
  [GLOBE_FILES, renderGlobe()],
]) {
  writeLineArt(files, rendered);
  for (const name of Object.values(files)) console.log(`wrote ${IMAGES_DIR}/${name}`);
}

writeFileSync(LENS_FILE, renderLens());
console.log(`wrote ${LENS_FILE}`);
