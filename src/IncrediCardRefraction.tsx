import lensMap from "./assets/images/incredicard-glass-lens.png?inline";
import styles from "./IncrediCard.module.scss";

// The SVG filter a refracting theme's backdrop refers to (see
// `--incredicard-face-backdrop-refracted` in incredicardThemeStyle and the
// faces' stylesheets). A backdrop filter can only refer to a filter by id
// in the same document, so this one is real markup, not a file, and each
// card renders its own under its own id.
//
// The filter moves the backdrop's pixels by the lens map (see
// scripts/glassLens.mjs): not at all across the middle of the card, and
// inward around the edge, like the rim of a slab of glass. The map is
// inlined because a filter loading an image is subject to that image's
// origin, and a package's files can end up on a CDN. `feImage` takes its
// size from the filter's region here, which is the card. Giving it
// `width="100%"` would resolve against the viewport instead.
//
// `scale` is the most a pixel moves, in CSS pixels. Browsers that can't
// render this (Safari) never read it, and show the plain frosted backdrop.
export function IncrediCardRefraction({ id }: { id: string }) {
  return (
    <svg className={styles.refraction} aria-hidden="true">
      <filter id={id} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feImage href={lensMap} preserveAspectRatio="none" result="lens" />
        <feDisplacementMap in="SourceGraphic" in2="lens" scale={50} xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}
