// The demo's example of what a custom theme is for: an issuer's own card, in
// its own material and colors, set once. The issuer is fictional, and the
// artwork (drawn by scripts/engraved-card.mjs) isn't part of the npm package.
import { extendIncrediCardTheme } from "../../src";
import artwork from "./engraved-card.svg";

export const engravedCardTheme = extendIncrediCardTheme("modern", {
  face: {
    background: `url("${artwork}") 0 0 / 100% 100% no-repeat`,
    color: "#10231a",
    invalidColor: "#991b1b",
    placeholder: "rgb(16 35 26 / 80%)",
    shadow: "0 0.5rem 1.5rem rgb(0 0 0 / 25%)",
    // The artwork is the whole face, so no line art prints over it.
    linesOpacity: 0,
  },
});
