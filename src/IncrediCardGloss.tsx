import styles from "./IncrediCardGloss.module.scss";

// The light on a glass surface, for a theme with `specular`. All of it is
// plain gradients, so unlike the refraction it looks the same in every
// browser: where a browser can't bend the page, this is most of what makes
// the card read as glass.
//
// Three layers, last in each face so they sit above the printed content,
// as gloss would, and transparent to the pointer, since an overlay card's
// real fields are under them:
//
// - a rim, brightest toward the top left: the edge catching ambient light,
//   there whether or not anything is tracking;
// - a stretch of that rim that brightens nearest the light;
// - a soft highlight on the surface itself, following the light.
//
// The last two read the light the chip and hologram read (see
// IncrediCardChip.tsx), including its on/off flag, so with no pointer or
// sensor, or under reduced motion, only the still rim remains.
export function IncrediCardGloss() {
  return (
    <span className={styles.gloss} aria-hidden="true">
      <span className={styles.specular} />
      <span className={styles.rim} />
      <span className={styles.rimLight} />
    </span>
  );
}
