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
// Glass bends each color by a slightly different amount, so each channel gets
// its own displacement, and the three are added back together. Where the lens
// doesn't bend, they land in the same place and nothing changes, so the fringe
// only shows at the edge.
//
// `REFRACTION_SCALE` is the most a pixel moves, in CSS pixels. Browsers that
// can't render this on a backdrop (Safari) never read it there, and show the
// plain softened backdrop.
const REFRACTION_SCALE = 90;
// How far red and blue part from green, as a share of the bend.
const REFRACTION_FRINGE = 0.16;

const CHANNELS = [
  { name: "red", scale: 1 + REFRACTION_FRINGE, matrix: "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" },
  { name: "green", scale: 1, matrix: "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" },
  { name: "blue", scale: 1 - REFRACTION_FRINGE, matrix: "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" },
];

export function IncrediCardRefraction({ id }: { id: string }) {
  return (
    <svg className={styles.refraction} aria-hidden="true">
      <filter id={id} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feImage href={lensMap} preserveAspectRatio="none" result="lens" />
        {CHANNELS.map(({ name, scale, matrix }) => [
          <feDisplacementMap
            key={`${name}-bent`}
            in="SourceGraphic"
            in2="lens"
            scale={REFRACTION_SCALE * scale}
            xChannelSelector="R"
            yChannelSelector="G"
            result={`${name}-bent`}
          />,
          <feColorMatrix key={name} in={`${name}-bent`} values={matrix} result={name} />,
        ])}
        <feBlend in="red" in2="green" mode="screen" result="red-green" />
        <feBlend in="red-green" in2="blue" mode="screen" />
      </filter>
    </svg>
  );
}
