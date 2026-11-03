import styles from "./IncrediCardGloss.module.scss";

// The light on a glass surface, for a theme with `specular`. All of it is
// plain gradients, so unlike the refraction it looks the same in every
// browser: where a browser can't bend the page, this is most of what makes
// the card read as glass.
//
// Last in each face so it sits above the printed content, as gloss would,
// and transparent to the pointer, since a floating card's real fields are
// under it. From the surface out to the edge:
//
// - a soft highlight on the surface, following the light;
// - a faint glow just inside the edge;
// - a thin rim at the very edge, lit at two opposite corners, where a rounded
//   edge catches the most light, and fading out at the other two.
//
// All of it stays slight, because the refraction is what makes the glass look
// thick (IncrediCardRefraction). Painting the thickness on instead reads as a
// frame around the card. The glow and rim each have a stretch that brightens
// nearest the light, and their resting brightness fades while it does, so
// the sheen appears to move around the edge rather than add to it. Those
// stretches and the surface highlight read the light the chip and hologram
// read (see IncrediCardChip.tsx), including its on/off flag, so with no
// pointer or sensor, or under reduced motion, only the still glow and rim
// remain.
export function IncrediCardGloss() {
  return (
    <span className={styles.gloss} aria-hidden="true">
      <span className={styles.specular} />
      <span className={styles.glow}>
        <span className={styles.rim} />
        <span className={styles.rimLight} />
      </span>
      <span className={styles.edge}>
        <span className={styles.rim} />
        <span className={styles.rimLight} />
      </span>
    </span>
  );
}
