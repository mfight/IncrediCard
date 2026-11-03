// The demo's example of a custom foil: a field of stacked cubes (the quilt
// pattern called tumbling blocks) on deep indigo. Each cube's top face is one
// glare mask and its sides the other, so the light crosses the tops and the
// sides separately, the way it would cross a relief. The artwork isn't part of
// the npm package.
import { extendIncrediCardTheme } from "../../src";
import foil from "./tumbling-blocks.svg";
import maskA from "./tumbling-blocks-a.svg";
import maskB from "./tumbling-blocks-b.svg";

export const tumblingBlocksTheme = extendIncrediCardTheme("ribbons", {
  lineArt: { foil, maskA, maskB },
  face: {
    background: "linear-gradient(150deg, #312e81 0%, #1e1b4b 55%, #0f0d2e 100%)",
    linesOpacity: 0.1,
  },
  // The built-in foils are fine lines, and their glare is tuned bright to
  // make up for it. Whole faces cover far more of the card, so this one's is
  // a good deal softer.
  hologram: { opacity: 0.14, glareStrength: 0.45 },
});
