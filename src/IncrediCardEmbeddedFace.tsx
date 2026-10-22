"use client";

import { useEffect, useRef, useState } from "react";
import {
  IncrediCardChip,
  useIncrediCardChipLight,
} from "./IncrediCardChip";
import { IncrediCardHologram } from "./IncrediCardHologram";
import { IncrediCardSpinner } from "./IncrediCardSpinner";
import { useIncrediCardTilt } from "./IncrediCardTilt";
import styles from "./IncrediCardEmbeddedFace.module.scss";

function classNames(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

// Same helper IncrediCardMaskedField.tsx and IncrediCardFace.tsx define
// for the identical need (two hooks, each returning their own ref, both
// targeting the same DOM element).
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

// Sets the DOM `inert` property imperatively. Not every version of
// @types/react types `inert` as a JSX attribute, while the DOM lib
// always types `HTMLElement.prototype.inert`. A plain ref + effect is
// the correctly typed way to set it without an `any` escape hatch, and
// it works regardless of which React/TypeScript versions a consuming
// project has installed.
function useInert(inert: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.inert = inert;
  }, [inert]);
  return ref;
}

// A plain, dependency-free "circular arrows" glyph, generic enough that
// no icon library is needed for it. Decorative only: the real accessible
// name lives on the flip button's aria-label.
function FlipIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-6.36-2.64L3 16" />
      <path d="M3 12a9 9 0 0 1 9-9 9 9 0 0 1 6.36 2.64L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

export type IncrediCardEmbeddedFaceProps = {
  flipped: boolean;
  /** Total half-turns the card has made, times 180. Applied as
   * `--incredicard-flip-angle` so the rotation ACCUMULATES rather than toggling
   * between two values -- see `flipTurns` in IncrediCard.tsx for why a
   * toggling angle makes the two directions disagree. */
  flipAngleDeg: number;
  /** "modern" (default) or "vintage". See the identical prop on
   * IncrediCardFace.tsx for why this is a plain duplicated union rather
   * than importing `IncrediCardTheme` from IncrediCard.tsx (that file
   * already imports this one). Only changes this face's background and
   * text colors and self-hosted fonts (see the `[data-theme="vintage"]`
   * block in IncrediCardEmbeddedFace.module.scss). The real fields it
   * positions get their vintage styling from
   * `.vintageNameField`/`.vintageMonoField` in IncrediCard.module.scss,
   * applied by IncrediCard.tsx, not from this component. */
  theme?: "modern" | "vintage";
  /** Default true. Forwarded straight to `IncrediCardChip`'s
   * `reflection` prop. */
  chipReflection?: boolean;
  /** Default false. See the identical prop on IncrediCardFace.tsx;
   * renders on the front face's background only. */
  holographic?: boolean;
  /** Default false. See the identical prop on IncrediCardFace.tsx. */
  tilt?: boolean;
  /** See the identical prop on IncrediCardFace.tsx. Tracked at
   * IncrediCard.tsx's top level either way, even though this
   * component's `.faceWrapper` DOES contain the real fields (unlike that
   * one), so both faces read a single source of truth rather than each
   * deriving their own. Also drives this component's `data-zoomed`
   * below, combined with `scale`. In "stacked", IncrediCard.tsx owns
   * the scale target (`.faceContainer`) and computes that attribute
   * itself; here this component's OWN `.faceWrapper` is the scale
   * target, so it computes it instead. */
  cardZoomed?: boolean;
  /** Default false. See the identical prop on IncrediCard.tsx. */
  scale?: boolean;
  /** Fires when the card's background is clicked. Filtered here (not by
   * the caller) to exclude clicks on a real field or the flip control,
   * both genuine descendants of this component's `.faceWrapper` (unlike
   * the identical prop on IncrediCardFace.tsx, which needs no filtering
   * because nothing interactive lives inside that component at all). */
  onCardClick?: () => void;
  processing?: boolean;
  /** Rendered on the card whenever `processing` is set, at any motion
   * preference (see `.processingLabel`). It matters most under reduced
   * motion, where the spinner is hidden and the flip loop skipped, but a
   * card signaling "busy" through movement alone says nothing in a still
   * frame either. */
  processingLabel: string;
  /** The bundled acceptance-mark badge; see the identical prop on
   * IncrediCardFace.tsx (same asset, same bottom-right corner placement;
   * see `.acceptanceMark` in IncrediCardEmbeddedFace.module.scss). */
  acceptanceMarkSrc?: string;
  /** Already the real, controlled field (a `IncrediCardField` or
   * `IncrediCardMaskedField`, styled to sit on the card by
   * IncrediCard.tsx's themed wrapper). This component only positions
   * it; it never renders a mirrored copy of anything.
   * `null`/`undefined` before IncrediCard.tsx has revealed it (see that
   * file's header comment), rendered as an empty slot rather than a
   * field with nothing in it. */
  nameField?: React.ReactNode;
  numberField: React.ReactNode;
  expirationField?: React.ReactNode;
  cvcField?: React.ReactNode;
  /** Amex's security code prints on the FRONT (top-right, above the
   * number), not the back. */
  cvcOnFront?: boolean;
  /** Omitted entirely (not just disabled) when there's nothing to flip
   * to: Amex's front-printed CVC needs no back at all, and neither
   * layout offers a flip control before enough of a valid number is
   * entered to know which one applies. */
  onFlip?: () => void;
  flipToBackLabel: string;
  flipToFrontLabel: string;
};

// The "overlay" layout's visual card. Here the real semantic fields ARE
// the card's content, positioned where a physical card's embossed text
// would sit, rather than an aria-hidden mirror shown above a stacked
// field list (IncrediCardFace.tsx, the "stacked" layout's entirely
// decorative card). Deliberately a separate component rather than a
// mode inside IncrediCardFace: that one's entire contract is "always
// aria-hidden, never interactive", while this one's fields are the
// actual interactive surface. That is a different enough accessibility
// shape to earn its own file, rather than a mode flag that would leave
// one component honoring two incompatible contracts depending on a prop.
//
// `inert` on whichever face isn't currently front-facing. The CSS
// rotateY/backface-visibility (the same mechanism as IncrediCardFace)
// hides it visually, but a CSS transform never removes anything from
// the tab order or the accessibility tree. Without `inert`, a keyboard
// user tabbing through the form could land on a field currently rotated
// out of view, with no visible focus indicator anywhere on screen.
// IncrediCardFace never has this problem, since nothing inside it is
// focusable. `inert` closes that gap in one native, declarative
// attribute: out of the tab order, out of the accessibility tree, and
// unclickable, all at once.
export function IncrediCardEmbeddedFace({
  flipped,
  flipAngleDeg,
  theme = "modern",
  chipReflection = true,
  holographic = false,
  tilt = false,
  cardZoomed = false,
  scale = false,
  onCardClick,
  processing,
  processingLabel,
  acceptanceMarkSrc,
  nameField,
  numberField,
  expirationField,
  cvcField,
  cvcOnFront,
  onFlip,
  flipToBackLabel,
  flipToFrontLabel,
}: IncrediCardEmbeddedFaceProps) {
  const frontRef = useInert(flipped);
  const backRef = useInert(!flipped);
  const revealed = Boolean(nameField);

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
  const tiltRef = useIncrediCardTilt(tilt, cardZoomed);

  // Excludes a real field or the flip control from counting as "clicked
  // the card": both are genuine descendants of `.faceWrapper` in this
  // layout (unlike "stacked", where nothing interactive lives inside the
  // decorative face at all). `event.target` is the actual, deepest
  // element the click landed on, regardless of where this listener is
  // attached, which is exactly what's needed to tell "clicked the card's
  // background" apart from "clicked something on top of it."
  function handleFaceClick(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target instanceof HTMLInputElement) return;
    if (target.closest("button")) return;
    onCardClick?.();
  }

  return (
    <div
      className={classNames(
        styles.faceWrapper,
        processing && styles.processing,
      )}
      data-flipped={flipped || undefined}
      data-theme={theme === "vintage" ? "vintage" : undefined}
      data-zoomed={scale && cardZoomed ? "" : undefined}
      onClick={onCardClick ? handleFaceClick : undefined}
      ref={mergeRefs(chipLightRef, tiltRef)}
    >
      <div
        className={styles.flipContainer}
        // On this element rather than `.faceWrapper`: the tilt hook
        // writes --incredicard-tilt-x/-y onto the wrapper imperatively, and
        // keeping React's own style object off that element avoids any
        // question of the two clobbering each other.
        style={{ "--incredicard-flip-angle": `${flipAngleDeg}deg` } as React.CSSProperties}
      >
        <div ref={frontRef} className={classNames(styles.face, styles.front)}>
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
          {/* Grouped with the number; see .numberGroup in
              IncrediCardFace.module.scss for why (Amex's real
              front-printed CVC sits snugly right above the number, not
              spaced apart by .face's space-between rhythm).

              This group is rendered UNCONDITIONALLY, with an empty
              placeholder standing in for the CVC row whenever there
              isn't a front-printed one. Only Amex prints its security
              code on the front; without the placeholder, every other
              network -- and the unrevealed card, which does not yet
              know its network -- would skip this row and sit higher up
              the card. Reserving the row always makes one set of field
              positions serve every network, and means the number does
              not shift when detection resolves (or changes) underneath
              it. The reserved layout matches Amex, since it is the one
              with the most on the card. */}
          <div className={styles.numberGroup}>
            <div className={styles.frontCvcRow}>
              {revealed && cvcOnFront ? (
                <div className={classNames(styles.cvcSlot, styles.slotRevealed)}>
                  {cvcField}
                </div>
              ) : (
                <div
                  className={classNames(styles.cvcSlot, styles.slotPlaceholder)}
                  aria-hidden="true"
                />
              )}
            </div>
            <div className={styles.numberSlot}>{numberField}</div>
          </div>
          {revealed ? (
            // Its own row, between the number and the name below,
            // matching a real physical card's "Valid Thru" placement.
            // Expiration comes before Name in DOM order here, so
            // IncrediCard.tsx's `activeFieldOrder` is layout-aware (see
            // that file's comment): visual order and Tab order have to
            // agree in this layout, unlike "stacked"'s decorative
            // mirror, where nothing is focusable.
            <div className={classNames(styles.expirationSlot, styles.slotRevealed)}>
              {expirationField}
            </div>
          ) : (
            // An empty placeholder rather than `null`.
            // `.face` distributes its rows with `justify-content:
            // space-between`, so the number's position depends on how
            // many siblings exist. With Expiration and Name simply
            // absent before reveal, only two children would be left and
            // the number would drop to the bottom of the card, then jump
            // up the instant a valid number revealed the rest. Keeping
            // the rows present (empty, `aria-hidden`, no field mounted)
            // makes the flex distribution identical before and after
            // reveal by construction, rather than by matching a number
            // against the revealed layout that would silently drift the
            // next time a row's height changed.
            <div
              className={classNames(styles.expirationSlot, styles.slotPlaceholder)}
              aria-hidden="true"
            />
          )}
          {revealed ? (
            <div className={classNames(styles.nameSlot, styles.slotRevealed)}>{nameField}</div>
          ) : (
            <div
              className={classNames(styles.nameSlot, styles.slotPlaceholder)}
              aria-hidden="true"
            />
          )}
          {latchedMarkSrc ? (
            // Plain `<img src>`, not `background-image`; see the
            // identical comment in IncrediCardFace.tsx for why (the
            // browser's CSS `url()` tokenizer chokes on the literal,
            // unescaped single quotes Vite's under-4KB SVG inlining
            // leaves in a raw `data:` URI, which silently breaks the
            // `style` property-setter path React uses; `src` has no such
            // parsing step). `alt=""` rather than `aria-hidden`: unlike
            // IncrediCardFace, which is aria-hidden at its root, this
            // component's real fields ARE accessible content, and an
            // empty `alt` is the standard way to mark an `<img>` as
            // decorative. next/image would also pull a Next.js
            // dependency into this otherwise framework-portable
            // component.
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
        <div ref={backRef} className={classNames(styles.face, styles.back)}>
          {processing ? <IncrediCardSpinner /> : null}
          <div className={styles.magstripe} aria-hidden="true" />
          {revealed && !cvcOnFront ? (
            <div className={styles.signatureRow}>
              <div className={styles.cvcSlot}>{cvcField}</div>
            </div>
          ) : null}
        </div>
      </div>
      {onFlip ? (
        <button
          type="button"
          disabled={processing}
          onClick={onFlip}
          aria-label={flipped ? flipToFrontLabel : flipToBackLabel}
          className={styles.flipButton}
        >
          <FlipIcon />
        </button>
      ) : null}
    </div>
  );
}
