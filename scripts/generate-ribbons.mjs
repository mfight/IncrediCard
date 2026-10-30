#!/usr/bin/env node
// CLI wrapper around scripts/ribbons.mjs: redraws the ribbon artwork and
// writes all three files. Change the drawing by editing COMPOSITION
// there, then run this. A unit test fails until the committed files match
// the generator again.
//
// Usage: npm run artwork:ribbons

import { FILES, IMAGES_DIR, writeRibbons } from "./ribbons.mjs";

writeRibbons();
for (const name of Object.values(FILES)) console.log(`wrote ${IMAGES_DIR}/${name}`);
