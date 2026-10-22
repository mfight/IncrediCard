import { useState } from "react";
import { applyMask } from "./maskEngine";
import {
  IncrediCardChip,
  useIncrediCardChipLight,
} from "./IncrediCardChip";
import { IncrediCardHologram } from "./IncrediCardHologram";
import { IncrediCardSpinner } from "./IncrediCardSpinner";
import { useIncrediCardTilt } from "./IncrediCardTilt";
import styles from "./IncrediCardFace.module.scss";

function classNames(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

// Same helper IncrediCardMaskedField.tsx defines for the identical need
// (two hooks, each returning their own ref, both targeting the same DOM
// element). Not imported from there since nothing else here depends on
// that file.
function mergeRefs<T>(
  ...refs: Array<React.Ref<T> | undefined>
): React.RefCallback<T> {
  return (node) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === "function") ref(node);
      else (ref as React.MutableRefObject<T | null>).current = node;
    }
  };
}

export type IncrediCardFaceProps = {
  /** Whether the back is currently showing. Both faces are always
   * present in the DOM (see the comment above `IncrediCardFace`); this
   * only drives the 3D rotation. */
  flipped: boolean;
  /** Total half-turns the card has made, times 180. Applied as
   * `--incredicard-flip-angle` so the rotation ACCUMULATES rather than toggling
   * between two values -- see `flipTurns` in IncrediCard.tsx for why a
   * toggling angle makes the two directions disagree. */
  flipAngleDeg: number;
  /** "modern" (default) or "vintage". Drives this face's background and
   * text colors and self-hosted fonts via a `[data-theme="vintage"]`
   * selector in IncrediCardFace.module.scss. Duplicated as a plain
   * union here rather than imported as `IncrediCardTheme` from
   * IncrediCard.tsx: that file already imports this one, so importing
   * back would be circular, and two literal strings aren't worth
   * breaking that for. */
  theme?: "modern" | "vintage";
  /** Default true. Forwarded straight to `IncrediCardChip`'s
   * `reflection` prop. */
  chipReflection?: boolean;
  /** Default false. An optional enhancement that renders
   * `IncrediCardHologram` on the front face's background only, behind
   * the real content. See that component's header comment. */
  holographic?: boolean;
  /** Default false. An optional visual-depth interaction: a subtle 3D
   * tilt following the pointer, composed with the flip. See
   * `useIncrediCardTilt`'s header comment (IncrediCardTilt.ts). */
  tilt?: boolean;
  /** Whether the card should currently read as "zoomed": a real field
   * anywhere in IncrediCard has focus, OR the card was manually toggled
   * by clicking its background (see `onCardClick` below). Tracked once
   * at the top level, since this component's `.faceWrapper` has no real
   * fields inside it at all (see the comment above `IncrediCardFace`).
   * Freezes `tilt` at flat while true; see `useIncrediCardTilt`'s
   * `suppressed` parameter. This component has no `scale` rule of its
   * own to apply this to: the "stacked" layout's scale target
   * (`.faceContainer`) lives in IncrediCard.tsx, one level up. */
  cardZoomed?: boolean;
  /** Fires when the card's background is clicked. There are no fields
   * here, and the flip control is a sibling in IncrediCard.tsx's markup
   * rather than a descendant of this component, so no filtering is
   * needed (unlike the identical prop on IncrediCardEmbeddedFace). Wired
   * straight to `.faceWrapper`'s `onClick`. */
  onCardClick?: () => void;
  /** The bundled acceptance-mark badge for the currently detected
   * network (see acceptanceMarks.ts's header comment); `undefined` until
   * one is confidently detected. Anchored to the card's bottom-right
   * corner (see `.acceptanceMark` in IncrediCardFace.module.scss), and
   * the only network branding this card shows. */
  acceptanceMarkSrc?: string;
  /** Already resolved to whatever should actually render: the live
   * value (uppercased) once non-empty, this face's placeholder copy
   * otherwise. IncrediCard owns that resolution; this component only
   * ever renders exactly what it's given. */
  cardholderNameDisplay: string;
  /** Raw digits only (no grouping). Grouped here via the same
   * `applyMask` engine IncrediCardMaskedField uses, so the card face's
   * grouping can never drift from the real number field's. */
  cardNumberDigits: string;
  numberPattern: string;
  numberPlaceholder: string;
  expirationDisplay: string;
  expirationPlaceholder: string;
  /** How many CVC digits have been entered so far, never the digits
   * themselves. The back face renders this many masked dots, nothing
   * more: CVC is the one value this component never mirrors in the
   * clear anywhere, matching the real CVC field's permanent obscuring
   * (see IncrediCard.tsx's header comment). */
  cvcDigitCount: number;
  cvcPlaceholder: string;
  nameInvalid?: boolean;
  numberInvalid?: boolean;
  expirationInvalid?: boolean;
  cvcInvalid?: boolean;
  /** Visual-only busy indication; see IncrediCard.tsx's `processing`
   * prop. This component has no submission logic of its own to pause. */
  processing?: boolean;
  /** Rendered on the card whenever `processing` is set, at any motion
   * preference (see `.processingLabel`). It matters most under reduced
   * motion, where the spinner is hidden and the flip loop skipped, but a
   * card signaling "busy" through movement alone says nothing in a still
   * frame either. */
  processingLabel: string;
  /** Whether enough of a valid number has been entered to know which
   * card-network layout applies. See IncrediCard.tsx's header comment on
   * why the rest of the card stays blank (just the number and chip)
   * until this is true. */
  revealed: boolean;
  /** Amex's security code prints on the FRONT (top-right, above the
   * number), not the back, and this card never flips at all in that
   * case (nothing on the back to reveal). Ignored while `revealed` is
   * false (there's no network-specific layout to pick yet). */
  cvcOnFront?: boolean;
};

// The synchronized visual half of IncrediCard: a presentation layer
// only, entirely `aria-hidden`. Every value mirrored here is already the
// accessible, interactive content of a real field elsewhere in
// IncrediCard.tsx (a IncrediCardField or IncrediCardMaskedField), so a
// screen-reader user loses nothing; this is chrome, not a second source
// of truth.
//
// `flipped` swaps which side is visible via a real 3D transform
// (perspective/rotateY/backface-visibility), and the animation is
// removed under prefers-reduced-motion (see IncrediCardFace.module.scss):
// the state still changes, only the animated transition is dropped.
// Both faces always render, never conditionally. Without animation both
// sides remain fully usable, since operating either side happens
// through the real fields in IncrediCard.tsx, never through this
// component.
export function IncrediCardFace({
  flipped,
  flipAngleDeg,
  theme = "modern",
  chipReflection = true,
  holographic = false,
  tilt = false,
  cardZoomed = false,
  onCardClick,
  acceptanceMarkSrc,
  cardholderNameDisplay,
  cardNumberDigits,
  numberPattern,
  numberPlaceholder,
  expirationDisplay,
  expirationPlaceholder,
  cvcDigitCount,
  cvcPlaceholder,
  nameInvalid,
  numberInvalid,
  expirationInvalid,
  cvcInvalid,
  processing,
  processingLabel,
  revealed,
  cvcOnFront,
}: IncrediCardFaceProps) {
  const groupedNumber = applyMask(cardNumberDigits, numberPattern);
  const numberDisplay = groupedNumber || numberPlaceholder;
  const cvcDots = "•".repeat(Math.max(cvcDigitCount, 0)) || cvcPlaceholder;
  const showCvcOnFront = revealed && cvcOnFront;
  const showCvcOnBack = revealed && !cvcOnFront;
  // `.faceWrapper` itself (the whole card, not just the chip's tiny box)
  // is the pointer-tracking surface for the chip reflection and the
  // hologram's pointer response; see useIncrediCardChipLight's header
  // comment in IncrediCardChip.tsx.
  const chipLightRef = useIncrediCardChipLight(
    chipReflection || holographic,
  );
  // Same `.faceWrapper` root, a separate hook/listener; see
  // useIncrediCardTilt's header comment for why this isn't folded into
  // chipLightRef's hook.

  // The acceptance mark tracks the DETECTED NETWORK, not the monotonic
  // reveal latch, so clearing the card number genuinely takes it away
  // again, and it should fade out like everything else rather than
  // vanish. CSS cannot animate an element that is being removed from the
  // DOM, so the mark has to outlive its own `src`: this keeps the last
  // artwork it was ever given, and the element stays mounted from then
  // on, hidden by a class rather than unmounted (see
  // `.acceptanceMarkHidden` and reveal-motion.scss).
  //
  // Adjusted during render rather than in an effect, which is what
  // `react-hooks/set-state-in-effect` wants. Safe here because this only
  // ever moves forward to a new non-empty value, so there is no reset
  // transition for a render to miss.
  const [latchedMarkSrc, setLatchedMarkSrc] = useState(acceptanceMarkSrc);
  if (acceptanceMarkSrc && acceptanceMarkSrc !== latchedMarkSrc) {
    setLatchedMarkSrc(acceptanceMarkSrc);
  }

  const tiltRef = useIncrediCardTilt(tilt, cardZoomed);

  return (
    <div
      className={classNames(
        styles.faceWrapper,
        processing && styles.processing,
      )}
      aria-hidden="true"
      data-flipped={flipped || undefined}
      data-theme={theme === "vintage" ? "vintage" : undefined}
      ref={mergeRefs(chipLightRef, tiltRef)}
      onClick={onCardClick}
    >
      <div
        className={styles.flipContainer}
        // On this element rather than `.faceWrapper`: the tilt hook
        // writes --incredicard-tilt-x/-y onto the wrapper imperatively, and
        // keeping React's own style object off that element avoids any
        // question of the two clobbering each other.
        style={{ "--incredicard-flip-angle": `${flipAngleDeg}deg` } as React.CSSProperties}
      >
        <div className={classNames(styles.face, styles.front)}>
          {processing ? <IncrediCardSpinner /> : null}
          {/* Front only, unlike the spinner, which is on both. Two
              reasons, and the first is NOT that the back is mirrored --
              it is not; `.back`'s own rotateY(180deg) cancels the flip
              container's, so the back reads normally when facing you.
              Rather: a second label would be redundant with the one the
              viewer just saw, and under reduced motion -- where a still
              card most needs the words -- the flip loop is skipped
              entirely, so the front is the only side ever shown. */}
          {processing ? (
            <span className={styles.processingLabel} aria-hidden="true">
              {processingLabel}
            </span>
          ) : null}
          {holographic ? <IncrediCardHologram /> : null}
          <div className={styles.topRow}>
            <span className={styles.chipOffset}>
              <IncrediCardChip reflection={chipReflection} />
            </span>
            {/* The top-right corner is intentionally empty: the
                acceptance mark in the bottom-right corner already
                identifies the network. The chip is all this row
                carries. */}
          </div>
          {/* Grouped with the number (a shared small gap, not .face's
              space-between rhythm) so the CVC sits snugly right above the
              number, Amex's real front-of-card printed position, rather
              than evenly spaced across the whole card height as a 4th
              space-between row would.

              Rendered UNCONDITIONALLY, with an invisible placeholder
              standing in for the CVC row when there is no front-printed
              one, exactly as the overlay layout does. Only Amex prints
              its code on the front; if every other network skipped this
              row, the number would sit higher up the card and this
              decorative face would disagree with the overlay face about
              where the number, expiration and name belong. Reserving the
              row always is what makes one set of positions serve both
              layouts. */}
          <div className={styles.numberGroup}>
            <div className={styles.frontCvcRow}>
              {showCvcOnFront ? (
                <span
                  className={classNames(
                    styles.cvc,
                    cvcInvalid && styles.invalidRegion,
                  )}
                >
                  {cvcDots}
                </span>
              ) : (
                // The SAME element and the SAME content as the real one
                // above, merely invisible. A derived equivalent height
                // would come out 2px short, because this box's height
                // comes from its own glyphs' line box;
                // `visibility: hidden` makes the match exact by
                // construction rather than by arithmetic.
                <span
                  className={classNames(styles.cvc, styles.cvcPlaceholder)}
                  aria-hidden="true"
                >
                  {cvcDots}
                </span>
              )}
            </div>
            <div
              className={classNames(
                styles.number,
                numberInvalid && styles.invalidRegion,
              )}
            >
              {numberDisplay}
            </div>
          </div>
          {revealed ? (
            // Its own row, between the number and the name below,
            // matching a real physical card's "Valid Thru" placement.
            <span
              className={classNames(
                styles.expiration,
                expirationInvalid && styles.invalidRegion,
              )}
            >
              {expirationDisplay || expirationPlaceholder}
            </span>
          ) : (
            // An invisible stand-in before reveal, for the same reason
            // as the overlay layout's placeholder rows. Without it this
            // row would be absent, leaving the decorative face with two
            // flex items instead of four and dropping the number to the
            // bottom of the card.
            <span className={classNames(styles.expiration, styles.rowPlaceholder)} aria-hidden="true">
              {expirationPlaceholder}
            </span>
          )}
          {revealed ? (
            <span
              className={classNames(
                styles.name,
                nameInvalid && styles.invalidRegion,
              )}
            >
              {cardholderNameDisplay}
            </span>
          ) : (
            <span className={classNames(styles.name, styles.rowPlaceholder)} aria-hidden="true">
              &nbsp;
            </span>
          )}
          {latchedMarkSrc ? (
            // Plain `<img src>`, not a `background-image`. Vite inlines
            // assets under its 4KB threshold (several of these
            // acceptance marks) as raw, non-base64
            // `data:image/svg+xml,...` URIs that keep the source SVG's
            // literal single quotes (`width='70'`, etc.) unescaped.
            // Assigning that string to `element.style.backgroundImage`
            // (the mechanism React uses for a `style` object) then
            // silently fails: the browser's CSS `url()` tokenizer chokes
            // on the embedded quotes and the property setter no-ops
            // rather than throwing, so the image never renders and
            // nothing is logged. `src` has no such parsing step.
            // next/image would pull a Next.js dependency into this
            // otherwise framework-portable component.
            <img
              className={classNames(
                styles.acceptanceMark,
                // Kept mounted with its last artwork so it can fade
                // out; see the latch above.
                !acceptanceMarkSrc && styles.acceptanceMarkHidden,
              )}
              src={latchedMarkSrc}
              alt=""
            />
          ) : null}
        </div>
        <div className={classNames(styles.face, styles.back)}>
          {processing ? <IncrediCardSpinner /> : null}
          <div className={styles.magstripe} />
          {showCvcOnBack ? (
            <div className={styles.signatureRow}>
              <span
                className={classNames(
                  styles.cvc,
                  cvcInvalid && styles.invalidRegion,
                )}
              >
                {cvcDots}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
