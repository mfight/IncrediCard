import styles from "./IncrediCardSpinner.module.scss";

function classNames(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

// The busy indicator shown on the card while `processing` is set.
//
// Rendered on BOTH faces, not just whichever one currently happens to be
// up: `processing` also starts a slow flip loop (see IncrediCard.tsx), so
// the card spends its time showing each side in turn and an indicator on
// only one of them would blink out of existence every couple of seconds.
export type IncrediCardSpinnerProps = {
  /** Runs the ring counterclockwise instead of clockwise.
   *
   * Nothing passes this today, and that is deliberate rather than an
   * oversight -- please do not delete it as dead code. In particular it
   * is NOT for the back-face instance: `.back`'s `rotateY(180deg)` looks
   * like it should mirror its contents, but that rotation exists to
   * cancel the flip container's own, so the back reads un-mirrored
   * whenever it actually faces the viewer. Setting this there makes the
   * spinner genuinely run backwards on the back.
   *
   * It exists for a card treatment that would legitimately need it. For
   * example, a "liquid glass" theme, where the back of the card is
   * translucent enough that you appear to be looking THROUGH it at the
   * front face's spinner. Seen through the card, that spinner really
   * would be mirrored, and the back instance would need to run reversed
   * to match it. That is a real optical case, not a hypothetical flag. */
  reversed?: boolean;
};

export function IncrediCardSpinner({
  reversed = false,
}: IncrediCardSpinnerProps) {
  return (
    // `aria-hidden`, like the rest of the card's own chrome. `processing`
    // is a visual-only state by contract (see IncrediCard.tsx's own prop
    // comment)--this component has no submission of its own to report on,
    // so announcing busy-ness belongs to whichever application actually
    // owns the request.
    <span
      className={classNames(styles.spinner, reversed && styles.reversed)}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" className={styles.svg}>
        <circle cx="16" cy="16" r="13" className={styles.track} />
        <circle cx="16" cy="16" r="13" className={styles.dash} />
      </svg>
    </span>
  );
}
