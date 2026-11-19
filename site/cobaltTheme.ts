// The landing page's own card look: the "ribbons" card on a cobalt face,
// deep navy at the top left brightening toward the lower right. Made with
// extendIncrediCardTheme, the way an app makes its own.
//
// The brightest corner stays at #2468f0, where the card's white text still
// clears 4.5:1 (4.87).

import { extendIncrediCardTheme } from "../src";

export const cobaltTheme = extendIncrediCardTheme("ribbons", {
  face: {
    background: [
      "radial-gradient(95% 130% at 78% 118%, #2468f0 0%, #1447d6 42%, rgb(20 71 214 / 0%) 78%)",
      "linear-gradient(158deg, #06154d 0%, #0b2a8f 46%, #1447d6 100%)",
    ].join(", "),
    linesOpacity: 0.14,
  },
});
