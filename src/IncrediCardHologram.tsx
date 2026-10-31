"use client";

import styles from "./IncrediCardHologram.module.scss";

// A restrained holographic material effect. The foil pattern is the
// theme's line art (lineArt.ts), referenced as a CSS `background-image`
// on `.holo` through `--incredicard-lines`, and the card's printed face
// is the theme's background (`--incredicard-face-background`). The
// face's faint printed lines (`.face::before`) are this same foil file,
// and the glare masks are drawn from the same elements by the same
// generator (scripts/lineArt.mjs), which is why the glare below can land
// exactly inside the printed lines.
//
// The artwork is referenced as a file rather than inlined as JSX. Inline
// svg ids are document-global once rendered, so a second mounted card
// would silently corrupt the first unless every gradient and mask got a
// per-instance `useId()` id (as IncrediCardChip.tsx does for the chip).
// A CSS `url()` resource is its own isolated document, so its ids cannot
// collide with anything: not another card's, not the surrounding page's.
// It also lets the line-art generators write the artwork as plain files.
//
// Rendered only on the front face's background (see IncrediCardFace.tsx
// and IncrediCardEmbeddedFace.tsx). It belongs below the fields, where a
// real card's printed content sits on top of it; the back (magstripe and
// CVC only) has no equivalent.
//
// The foil is drawn TWICE, and the pair is the effect rather than a
// duplicate to clean up: `.holo` covers the whole card desaturated, and
// `.holoColor` is the identical artwork at full saturation, masked to a
// soft circle that follows the pointer. Saturation stays high close to
// the moving highlight and fades out away from its center, so the card
// is brushed silver until light reaches it and the color arrives with
// the light. See the scss for why that is additive rather than a
// crossfade.
//
// The artwork itself never moves. Only the gradients applied to it
// respond to the cursor, the way a holographic trading card does, so
// the pointer-reactive part isn't a `transform` on this pattern at all.
// Instead, four independent CSS-gradient layers (not part of the
// artwork's own paint) sit on top of it, in two pairs. Each pair is
// clipped to ONE of the artwork's two groups of lines (for the ribbons,
// one fan each; for the globe, the land and the sphere), and the two
// members of a pair track the pointer in OPPOSITE directions:
// `.glareRadial` and `.glareRadialReverse` on the first group,
// `.glareLinear` and `.glareLinearReverse` on the second. See the scss for what
// each one does; the short version is that a lone highlight reads as one
// lit surface, and a counter-moving second highlight on the same shape
// reads as light entering and leaving a material with depth. All four
// are invisible at rest (`--incredicard-chip-light-active` unset; see that
// property's comment in IncrediCardChip.tsx for why it is a separate
// flag from the coordinates), so nothing renders here once the pointer
// leaves and no sensor is feeding the page.
//
// Each layer is clipped to its own group's silhouette, not a plain
// rectangle or circle spanning the whole card, by masking with that
// group's own file (`-a.svg`/`-b.svg`, written beside the foil so a mask
// can carry one group without the other). A CSS `mask-image` pointing at
// an svg FILE masks by alpha, which is what makes those files usable
// directly: the lines are opaque where they are and absent everywhere
// else, a clean "shape present or not." A `<mask>` element masks by
// luminance instead, so it would need a hand-built, paint-less copy of
// every line; masking against the visible, gradient-colored copy would
// mask with the gradient's uneven brightness.
export function IncrediCardHologram() {
  return (
    <span className={styles.hologramWrapper} aria-hidden="true">
      <span className={styles.holo} />
      <span className={styles.holoColor} />
      <span className={styles.glareRadial} />
      <span className={styles.glareRadialReverse} />
      <span className={styles.glareLinear} />
      <span className={styles.glareLinearReverse} />
    </span>
  );
}
