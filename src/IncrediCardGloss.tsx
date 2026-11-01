import styles from "./IncrediCardGloss.module.scss";

// The light on a glass surface, for a theme with `specular`. All of it is
// plain gradients, so unlike the refraction it looks the same in every
// browser: where a browser can't bend the page, this is most of what makes
// the card read as glass.
//
// Last in each face so it sits above the printed content, as gloss would,
// and transparent to the pointer, since an overlay card's real fields are
// under it. From the surface out to the edge:
//
// - a soft highlight on the surface, following the light;
// - a facet: a thin, soft line where the flat surface meets the bevel, dark
//   toward the light and pale away from it, as a real ridge would be;
// - a bevel: a wide band around the edge, lit toward the top left and shaded
//   toward the bottom right, so the glass rounds off rather than stops;
// - a faint hairline at the very edge.
//
// Together they make the edge read as thickness: the lower edge of the slab
// itself is the theme's shadow. All of this is there whether or not anything
// is tracking. The bevel and hairline also have a stretch that brightens
// nearest the light. Those stretches and the surface highlight read the light the chip and hologram read (see
// IncrediCardChip.tsx), including its on/off flag, so with no pointer or
// sensor, or under reduced motion, only the still edge remains.
export function IncrediCardGloss() {
  return (
    <span className={styles.gloss} aria-hidden="true">
      <span className={styles.specular} />
      <span className={styles.facet} />
      <span className={styles.bevel}>
        <span className={styles.rim} />
        <span className={styles.rimLight} />
      </span>
      <span className={styles.hairline}>
        <span className={styles.rim} />
        <span className={styles.rimLight} />
      </span>
    </span>
  );
}
