"use client";

import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import {
  IncrediCardField,
  type IncrediCardFieldSize,
} from "./IncrediCardField";
import { IncrediCardMaskedField } from "./IncrediCardMaskedField";
import { IncrediCardFace } from "./IncrediCardFace";
import { IncrediCardEmbeddedFace } from "./IncrediCardEmbeddedFace";
import { applyMask } from "./maskEngine";
import {
  detectCardNetwork,
  getCardNetworkInfo,
  luhnCheck,
} from "./cardNetworks";
import { getAcceptanceMarkSrc } from "./acceptanceMarks";
import { prefersReducedMotion } from "./reducedMotion";
import styles from "./IncrediCard.module.scss";

// A plain, dependency-free "circular arrows" glyph, the same one
// IncrediCardEmbeddedFace.tsx draws for its flip badge. Duplicated rather
// than shared: two call sites and ten lines don't justify a new file.
// Decorative only; the flip button's aria-label carries the accessible
// name.
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

export type IncrediCardValue = {
  cardholderName: string;
  /** Canonical digits only, no grouping: the same "canonical value never
   * changes shape" contract as IncrediCardMaskedField's value. */
  cardNumber: string;
  /** "" | a partial 1-2 digit string while typing | "01".."12" once
   * complete. Split from `expirationYear` (not a single "MMYY"/"MM/YY"
   * string) so a consumer that only cares about one half never has to
   * re-parse a combined string back apart. */
  expirationMonth: string;
  /** "" | a partial 1-digit string while typing | a 2-digit string
   * once complete (e.g. "26"). Two-digit, matching the field's displayed
   * "MM/YY"; never expanded to a 4-digit year here. If you need one,
   * compute it (2000 + Number(year)). */
  expirationYear: string;
  /** Canonical digits only. Never shown in the clear anywhere in this
   * component, including the visual card face; see IncrediCardFace.tsx's
   * header comment. */
  cvc: string;
};

// See the processing flip loop in IncrediCardBase below.
const PROCESSING_FLIP_INTERVAL_MS = 2000;

const EMPTY_VALUE: IncrediCardValue = {
  cardholderName: "",
  cardNumber: "",
  expirationMonth: "",
  expirationYear: "",
  cvc: "",
};

type IncrediCardTouched = {
  cardholderName: boolean;
  cardNumber: boolean;
  expiration: boolean;
  cvc: boolean;
};

const UNTOUCHED: IncrediCardTouched = {
  cardholderName: false,
  cardNumber: false,
  expiration: false,
  cvc: false,
};

export type IncrediCardLayout = "stacked" | "overlay";

// "modern" (default): the Figtree-set, dark-gradient card. "vintage": an
// homage to an actual embossed plastic card. OCR-A sets the name and
// OCR-B the number, expiration, and CVC (the three a real card's embosser
// treats as "printed" characters, distinct from the engraved name), on an
// aged-ivory card face, with a layered text-shadow standing in for
// genuine raised embossing. A real bevel would need 3D geometry per
// glyph, which CSS can't produce for arbitrary live-typed text; two
// shadows (a light highlight, a dark counter-shadow) are the standard
// flat approximation, applied identically to the real fields' typed text
// and to the "stacked" layout's decorative card-face mirror of it. Both
// fonts are self-hosted under assets/fonts/, like Figtree. See
// assets/fonts/OCR-A-ReadMe.txt (the font author's informal free-font
// notice; OCR-A has no separate license file) and
// assets/fonts/OCR-B-OFL.txt (SIL Open Font License 1.1) for their terms.
export type IncrediCardTheme = "modern" | "vintage";

// Every user-facing string this component renders, all overridable. No
// i18n hook is built in: a portable component can't assume a project has
// one, let alone which one. A project with its own i18n solution wires it
// up from the outside, by passing a `labels` object built from its own
// translated strings; this component renders whatever it's given,
// defaulting to plain English.
export type IncrediCardLabels = {
  legend: string;
  cardholderNameLabel: string;
  cardNumberLabel: string;
  expirationLabel: string;
  cvcLabel: string;
  showBackLabel: string;
  showFrontLabel: string;
  cardholderNameError: string;
  cardNumberError: string;
  expirationInvalidError: string;
  expirationExpiredError: string;
  cvcError: string;
  /** The overlay layout's card-number field placeholder. Deliberately
   * plain words rather than a formatting hint: numbers group differently
   * by network (4-4-4-4, Amex's 4-6-5), so any single dotted template
   * would be wrong for some networks before one is detected. The
   * decorative "stacked" card face is unaffected; it mirrors a dotted
   * mask, which is a picture of a card rather than an instruction. */
  cardNumberPlaceholder: string;
  /** Shown on the card whenever `processing` is set, in both layouts and
   * regardless of motion preference; see either face's
   * `.processingLabel`. Carries the busy state in words rather than
   * leaving it to motion alone, which matters most under reduced motion,
   * where the spinner is hidden and the flip loop is skipped.
   *
   * The default ends in a single ellipsis character (U+2026), not three
   * periods: one glyph rather than three, which spaces and wraps
   * correctly. Override it wholesale if a locale wants different
   * punctuation. */
  processingLabel: string;
  cardholderNamePlaceholder: string;
  expirationPlaceholder: string;
  cvcPlaceholder: string;
};

export const DEFAULT_INCREDICARD_LABELS: IncrediCardLabels = {
  legend: "Card details",
  cardholderNameLabel: "Name on card",
  cardNumberLabel: "Card number",
  expirationLabel: "Expiration date",
  cvcLabel: "Security code",
  showBackLabel: "Show back of card",
  showFrontLabel: "Show front of card",
  cardholderNameError: "Enter the name on the card",
  cardNumberError: "Enter a valid card number",
  expirationInvalidError: "Enter a valid expiration date",
  expirationExpiredError: "This card has expired",
  cvcError: "Enter a valid security code",
  cardNumberPlaceholder: "Enter your credit card number",
  processingLabel: "Processing\u2026",
  cardholderNamePlaceholder: "YOUR NAME",
  expirationPlaceholder: "MM/YY",
  cvcPlaceholder: "•••",
};

type IncrediCardOwnProps = {
  /** Base id. Each real field derives its own from this (`${id}-name`,
   * etc.). */
  id: string;
  /** Default "overlay": the real fields are embedded directly into the
   * card itself (`IncrediCardEmbeddedFace`), positioned where a physical
   * card's embossed text sits. Each field's visible label is hidden
   * (still real, still in the accessibility tree via `hideLabel`), since
   * the card's layout already conveys what each position means, the same
   * way a real card needs no separate "this is the number" caption next
   * to its embossed digits.
   *
   * "stacked": a purely decorative card (`IncrediCardFace`) above a
   * normal, fully labeled list of real fields. */
  layout?: IncrediCardLayout;
  /** Default "modern"; see `IncrediCardTheme`'s header comment. */
  theme?: IncrediCardTheme;
  /** Default true. Forwarded to whichever card face is active; see the
   * `reflection` prop of `IncrediCardChip` (IncrediCardChip.tsx). */
  chipReflection?: boolean;
  /** Default false. An optional, restrained holographic foil effect on
   * the card's front background, behind the real content. See
   * `IncrediCardHologram`'s header comment. */
  holographic?: boolean;
  /** Default false. An optional 3D tilt that follows the pointer,
   * composed with the flip so neither ever snaps or resets the other. See
   * the header comment of `useIncrediCardTilt` (IncrediCardTilt.ts). */
  tilt?: boolean;
  /** Default false. An optional emphasis effect: the card face scales to
   * 150% while it is zoomed (any real field focused, or the card's
   * background clicked), and eases back when that ends. Tracked in React
   * (`cardZoomed` below) and applied through a `data-zoomed` attribute.
   * A `transform: scale()`, not a `width`/`height` change, so it never
   * affects the surrounding layout: the card's layout box keeps its
   * original size, and only its painted appearance grows, which can
   * visually overlap nearby content rather than push it aside (the same
   * tradeoff any non-reflowing zoom effect makes). */
  scale?: boolean;
  fieldSize?: IncrediCardFieldSize;
  disabled?: boolean;
  readOnly?: boolean;
  /** Default true. A card form with an optional field is unusual enough
   * that it doesn't warrant a separate per-field `required` setting. */
  required?: boolean;
  /** Visual-only busy indication for a submission your application owns;
   * this component has no submission flow of its own (see this file's
   * header comment). Locks every field read-only and dims the card face
   * while true. */
  processing?: boolean;
  /** Overrides any subset of the default (English) strings; see
   * `IncrediCardLabels`'s header comment. */
  labels?: Partial<IncrediCardLabels>;
  value?: IncrediCardValue;
  defaultValue?: IncrediCardValue;
  onChange?: (value: IncrediCardValue) => void;
  /** Fires whenever "every field is filled in and passes this
   * component's own format-level checks" (Luhn + correct length for the
   * detected/default network, a non-empty name, a well-formed and
   * not-yet-expired expiration date, a correctly-sized CVC) starts or
   * stops being true--including once, on mount, with whatever it already
   * is (a prefilled `defaultValue`/`value` can already be complete).
   * This is deliberately NOT "this is a valid, chargeable card"; see the
   * "Nothing Here Enforces a Complete, Charge-Ready Card" section of
   * Overview.mdx. Only real payment validation (does the card exist, have
   * funds, isn't reported lost) can answer that, and only a payment
   * processor can tell you. This component has no way to, and this
   * callback makes no claim otherwise. */
  onCompletionChange?: (complete: boolean) => void;
  className?: string;
};

export type IncrediCardProps = IncrediCardOwnProps &
  Omit<
    React.FieldsetHTMLAttributes<HTMLFieldSetElement>,
    keyof IncrediCardOwnProps
  >;

function classNames(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

// The same helper each face component defines for the same need (an
// internal ref alongside a caller-supplied one, both targeting the same
// DOM node). Used here so the outside-click listener below can always
// reach the real `<fieldset>` node regardless of whether (or how) a
// caller's `ref` prop is supplied.
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

// A synchronized visual card alongside the real, accessible semantic
// fields that are the only actual input surface (this component's own
// IncrediCardField/IncrediCardMaskedField elements). Self-contained: the
// field rendering, masking engine, card-face chrome, default English
// strings and fonts all ship with this library, which depends on nothing
// but React.
//
// Two layouts share every field's wiring (validation, network detection,
// the flip state) and differ only in where the card and the fields
// visually live. "overlay" (default) renders IncrediCardEmbeddedFace,
// embedding the real fields directly into the card, positioned where a
// physical card's embossed text sits; there is no separate decorative
// mirror in this mode, since the fields are the card's visible content.
// "stacked" renders IncrediCardFace, a purely decorative, entirely
// aria-hidden card above a normal, fully labeled field list. They are
// two components rather than one with an internal mode branch because
// IncrediCardFace's whole contract is "always aria-hidden, never
// interactive," a different accessibility shape from
// IncrediCardEmbeddedFace's real, focusable fields. Either way, the card
// component only receives already-resolved display strings or
// already-built field elements, never the field controls' internal
// wiring, so a processor-hosted field integration (a payment processor's
// iframe standing in for the number and security-code inputs) could
// replace just the field layer without touching either card component.
//
// Security boundary: no raw cardNumber/cvc value is ever logged,
// persisted outside this component's state, or sent anywhere; there is
// no submission flow here at all. `processing` is purely a visual
// affordance for your application's own in-flight submission.
//
// Network detection (cardNetworks.ts) is deliberately minimal and safe
// (a handful of settled IIN prefixes, neutral otherwise). Full
// BIN-accurate detection is out of scope. The only network branding is
// the bundled acceptance mark (acceptanceMarks.ts); the card shows no
// plain-text network name.
//
// Progressive reveal: only the card number field shows initially. Name,
// expiration, and security code stay hidden (in both layouts, and in the
// decorative "stacked" card face too) until a valid number identifies
// which network's layout applies (see `isRevealed` below). Non-Amex
// networks use the standard layout (name and expiration on the front, a
// 3-digit CVC on the back, a flip control to reach it). Amex's security
// code is 4 digits and prints on the FRONT (top-right, above the
// number); there's nothing on the back in that case, so no flip control
// is offered.
const IncrediCardBase = forwardRef<HTMLFieldSetElement, IncrediCardProps>(
  function IncrediCard(
    {
      id,
      layout = "overlay",
      theme = "modern",
      chipReflection = true,
      holographic = false,
      tilt = false,
      scale = false,
      fieldSize = "md",
      disabled = false,
      readOnly = false,
      required = true,
      processing = false,
      labels: labelsProp,
      value,
      defaultValue = EMPTY_VALUE,
      onChange,
      onCompletionChange,
      className,
      ...rest
    },
    ref,
  ) {
    const labels = { ...DEFAULT_INCREDICARD_LABELS, ...labelsProp };
    const isControlled = value !== undefined;
    const [uncontrolledValue, setUncontrolledValue] =
      useState<IncrediCardValue>(defaultValue);
    const committedValue = isControlled ? value : uncontrolledValue;

    const [touched, setTouched] = useState<IncrediCardTouched>(UNTOUCHED);
    // The flip accumulates turns rather than toggling a boolean angle, so
    // the card always rotates the SAME way. A CSS transition interpolates
    // between two values, so an angle toggling 0deg <-> 180deg necessarily
    // unwinds back the way it came, and front-to-back and back-to-front
    // would visibly spin in opposite directions. Counting turns means the
    // angle only ever increases (0, 180, 360, 540...) and every flip
    // continues the last. This applies everywhere, not only to the
    // processing loop.
    //
    // `flipped` is the boolean the rest of this component reasons about,
    // derived from the count's parity, and `setFlipped` has the familiar
    // state-setter signature, functional form included. It bumps the count
    // only when the side actually changes, so calling it with the side
    // already showing is a no-op.
    const [flipTurns, setFlipTurns] = useState(0);
    const flipped = flipTurns % 2 === 1;
    const setFlipped = useCallback(
      (next: boolean | ((current: boolean) => boolean)) => {
        setFlipTurns((turns) => {
          const current = turns % 2 === 1;
          const target = typeof next === "function" ? next(current) : next;
          return target === current ? turns : turns + 1;
        });
      },
      [],
    );
    // Whether any real field (an `<input>`, never the flip button; see
    // below) currently has focus, by click or keyboard. Tracked once, here,
    // rather than inside either face component: the "stacked" layout's
    // IncrediCardFace has no real fields inside it (everything interactive
    // is a sibling, in this file's markup), so only this top level sees
    // every real field regardless of which layout is active. React's
    // `onFocus`/`onBlur`, attached to the `<fieldset>` below, behave like
    // native `focusin`/`focusout` (they bubble to an ancestor, unlike the
    // raw DOM `focus`/`blur` events of the same name), so no extra native
    // listener is needed.
    //
    // Recomputed from scratch on every focus/blur, rather than a simple
    // "did focus enter or leave the fieldset" toggle, because the flip
    // control (a real `<button>`, also a descendant of this fieldset) must
    // be EXCLUDED. `onFocus` uses `event.target` (the element that just
    // gained focus); `onBlur` uses `event.relatedTarget` (the element about
    // to gain it, or `null` if focus is leaving the document or component
    // entirely). Together these keep `fieldsFocused` accurate through a
    // move from one input to another inside the fieldset, with no false
    // "unfocused" blip: blur and then focus both resolve to `true` in
    // sequence, never dropping to `false` first.
    const [fieldsFocused, setFieldsFocused] = useState(false);
    // A second, independent way to reach the same visual state as
    // `fieldsFocused`: toggled by clicking the card itself (its
    // background, not a field or the flip control; see `handleCardClick`
    // below) rather than by focusing something. `cardZoomed` is the two
    // ORed together, and it drives both `tilt`'s suppression and `scale`'s
    // scale-up, so a focused field and a manually toggled card read as the
    // same state everywhere else in this file.
    const [manuallyZoomed, setManuallyZoomed] = useState(false);
    const cardZoomed = fieldsFocused || manuallyZoomed;
    // Snapshot of `cardZoomed` taken on `pointerdown`, BEFORE the
    // browser's default focus shift for that same click runs; see
    // `handlePointerDown` below for why a click handler can't just read
    // the live `cardZoomed` value instead.
    const wasZoomedRef = useRef(false);
    function handleFieldsetFocus(event: React.FocusEvent<HTMLFieldSetElement>) {
      setFieldsFocused(event.target instanceof HTMLInputElement);
    }
    function handleFieldsetBlur(event: React.FocusEvent<HTMLFieldSetElement>) {
      const next = event.relatedTarget;
      const staysWithin = Boolean(
        next && event.currentTarget.contains(next),
      );
      // Latch `manuallyZoomed` BEFORE `fieldsFocused` drops, whenever
      // focus is only moving to something ELSE inside the component (most
      // often the flip control) and the card was already zoomed. Without
      // this, clicking the flip control while zoomed causes a visible
      // zoom-out: focusing the button natively blurs the previously
      // focused field first (before `flipAndFocusFirstField` runs),
      // dropping `fieldsFocused` and `cardZoomed` to `false` for one full
      // render *before* the click handler runs. That shrinks the card and
      // moves the button between `mousedown` and `mouseup`, so the click
      // can silently fail to register (the same failure mode the flip
      // control's exclusion from `fieldsFocused` prevents in the zoom-IN
      // direction). Latching here, in the same event and render as the
      // `fieldsFocused` drop, means `cardZoomed` never goes false in
      // between: no shrink, no moved button, no missed click.
      if (staysWithin) {
        if (cardZoomed) setManuallyZoomed(true);
      } else {
        // Only reset the MANUAL toggle once focus has left the whole
        // component. `manuallyZoomed` persists through in-component focus
        // changes (including a flip; see `flipAndFocusFirstField` below),
        // and only falls back to its default once nothing inside is left
        // focused to justify staying zoomed.
        setManuallyZoomed(false);
      }
      setFieldsFocused(next instanceof HTMLInputElement);
    }

    // Captured on every `pointerdown` anywhere in the card (fields, the
    // flip control, and the card's background alike): whether the card
    // was zoomed as this interaction began, before any of the browser's
    // default focus shifting for it has run. `handleCardClick` below needs
    // this instead of reading `cardZoomed` directly. A background click
    // that lands while a real field holds focus first triggers that
    // field's native blur (nothing else on the card's background is
    // focusable, so `relatedTarget` is `null`, which `handleFieldsetBlur`
    // above correctly reads as "focus left entirely" and un-zooms). By the
    // time the click handler runs, `cardZoomed` is already `false`;
    // reading it there would make a background click while zoomed look
    // identical to one while unzoomed, toggling zoom back ON a beat after
    // it correctly turned off (a visible zoom-out-then-back-in flicker).
    // Reading this snapshot means "was it zoomed when the click started"
    // survives that same-click native blur.
    function handlePointerDown() {
      wasZoomedRef.current = cardZoomed;
    }

    // A click on the card's background (never a field, never the flip
    // control; see each face component's wiring of this callback) toggles
    // `manuallyZoomed` directly. Blurring whatever is focused when
    // toggling OFF is what makes every click visibly toggle: otherwise a
    // real field's focus would keep `cardZoomed` true regardless of
    // `manuallyZoomed`, since the two are ORed together.
    function handleCardClick() {
      if (wasZoomedRef.current) {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        setManuallyZoomed(false);
      } else {
        setManuallyZoomed(true);
      }
    }

    // Reaches the real `<fieldset>` DOM node for the outside-click
    // listener below, whatever the caller's `ref` prop is (an object ref,
    // a callback, or nothing); see `mergeRefs` above.
    const fieldsetRef = useRef<HTMLFieldSetElement>(null);

    // Closes a manually toggled zoom the moment a click lands outside the
    // card. `handleFieldsetBlur` above closes it when a FOCUSED field's
    // focus leaves, but a zoom toggled by clicking the card's background
    // can exist with nothing focused at all, so there's no blur event for
    // an outside click to trigger; without this listener, the zoom would
    // persist until the background is clicked again. The listener exists
    // only while `manuallyZoomed` is true (an effect keyed on it). It is
    // deliberately not a backdrop or scrim element: a full-page dimming
    // treatment would apply to every zoom, including a plain field-focus
    // one, a much heavier visual change than this effect calls for.
    useEffect(() => {
      if (!manuallyZoomed) return;
      function handleDocumentPointerDown(event: PointerEvent) {
        const node = fieldsetRef.current;
        if (
          node &&
          event.target instanceof Node &&
          !node.contains(event.target)
        ) {
          setManuallyZoomed(false);
        }
      }
      document.addEventListener("pointerdown", handleDocumentPointerDown);
      return () => {
        document.removeEventListener(
          "pointerdown",
          handleDocumentPointerDown,
        );
      };
    }, [manuallyZoomed]);

    function commit(partial: Partial<IncrediCardValue>) {
      const next = { ...committedValue, ...partial };
      if (!isControlled) setUncontrolledValue(next);
      onChange?.(next);
    }

    function markTouched(field: keyof IncrediCardTouched) {
      setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
    }

    const network = detectCardNetwork(committedValue.cardNumber);
    const networkInfo = getCardNetworkInfo(network);
    // Amex's security code prints on the FRONT (top-right, above the
    // number) and is 4 digits, not 3. The card never flips in that case,
    // since there's nothing on the back to reveal.
    const isAmex = network === "amex";
    // The bundled acceptance-mark badge for the card face's bottom-right
    // corner (see acceptanceMarks.ts's header comment). `undefined` until
    // a network is confidently detected. Deliberately not gated on
    // `isRevealed`: the mark appears as soon as the prefix identifies the
    // network, before the number is complete.
    const acceptanceMarkSrc = getAcceptanceMarkSrc(network);

    // "Partial" (still typing, not yet complete) is deliberately never
    // flagged invalid; only a field the user has left (`touched`) with a
    // wrong value is. That gives this component its empty/focused/partial/
    // invalid/valid state model without a separate "state" prop: each
    // state is a combination of `touched` and the field's current value.
    const nameValid = committedValue.cardholderName.trim().length > 0;
    const nameError =
      touched.cardholderName && !nameValid
        ? labels.cardholderNameError
        : undefined;

    // Length is checked against the *detected* network's expected length,
    // falling back to a generic 16 when nothing was safely detected. That's
    // an imperfect assumption for a real but undetected network, but a
    // reasonable one for basic format feedback, which is all this
    // component claims to provide.
    const numberValid =
      committedValue.cardNumber.length === networkInfo.numberLength &&
      luhnCheck(committedValue.cardNumber);
    const numberError =
      touched.cardNumber && !numberValid ? labels.cardNumberError : undefined;

    // Sticky, not a plain `numberValid` read. The initial state shows only
    // the card number field; once it's valid (a complete, correct number
    // for the detected network, or the generic 16-digit assumption when
    // none was detected), the rest of the card reveals and *stays*
    // revealed even if the number is edited back to something invalid
    // afterward (fixing a typo, say). Collapsing the whole form the
    // instant a digit is deleted would be far more jarring than leaving an
    // already-typed name, expiration and CVC in place while the number is
    // corrected.
    //
    // State adjusted during render, not a ref mutated during render. Under
    // concurrent rendering, a render React discards or replays would still
    // leave a mutated ref set, so a speculative render that never commits
    // could reveal the card permanently. Adjusting state during render is
    // the supported form: React re-runs the component immediately without
    // committing the first pass, so this costs no extra browser paint,
    // only a re-run.
    const [revealed, setRevealed] = useState(false);
    if (numberValid && !revealed) setRevealed(true);
    const isRevealed = revealed;

    const expirationComplete =
      committedValue.expirationMonth.length === 2 &&
      committedValue.expirationYear.length === 2;
    const monthNum = Number(committedValue.expirationMonth);
    const expirationFormatValid =
      expirationComplete && monthNum >= 1 && monthNum <= 12;
    const today = new Date();
    const currentYear2Digit = today.getFullYear() % 100;
    const currentMonth = today.getMonth() + 1;
    const expirationYearNum = Number(committedValue.expirationYear);
    const expirationExpired =
      expirationFormatValid &&
      (expirationYearNum < currentYear2Digit ||
        (expirationYearNum === currentYear2Digit && monthNum < currentMonth));
    const expirationError = touched.expiration
      ? !expirationFormatValid
        ? labels.expirationInvalidError
        : expirationExpired
          ? labels.expirationExpiredError
          : undefined
      : undefined;

    const cvcValid = committedValue.cvc.length === networkInfo.cvcLength;
    const cvcError = touched.cvc && !cvcValid ? labels.cvcError : undefined;

    // "Complete" (see `onCompletionChange`'s doc comment) is every field's
    // already-computed validity combined, not a new check. It is
    // deliberately never gated on `touched` the way each field's *error*
    // text is: a form filled programmatically or via autofill, without the
    // user touching a field, still becomes complete the moment its values
    // are valid. Format-level only; never a claim about whether the card
    // is real, funded, or chargeable.
    const isComplete =
      nameValid &&
      numberValid &&
      expirationFormatValid &&
      !expirationExpired &&
      cvcValid;
    // Fires on every change, including the first render (a prefilled
    // `defaultValue`/`value` can already be complete on mount, and a caller
    // setting up an "enable submit" state needs to know). An effect, not a
    // call inside `commit()`, because `committedValue` can also change
    // through a controlled caller's `value` prop, not only through this
    // component's handlers; `commit()` alone would miss that case.
    useEffect(() => {
      onCompletionChange?.(isComplete);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isComplete]);

    const nameFieldId = `${id}-name`;
    const numberFieldId = `${id}-number`;
    const expirationFieldId = `${id}-expiration`;
    const cvcFieldId = `${id}-cvc`;

    const expirationDigits = `${committedValue.expirationMonth}${committedValue.expirationYear}`;
    const numberPlaceholder = applyMask(
      "•".repeat(networkInfo.numberLength),
      networkInfo.numberPattern,
    );
    const isOverlay = layout === "overlay";
    const isVintage = theme === "vintage";

    // Arrow-key navigation between fields, alongside native Tab. Refs to
    // each field's real `<input>` (IncrediCardField and
    // IncrediCardMaskedField both forward their ref to it), keyed the same
    // way as `nameFieldId` etc. above, so a handler below can look one up
    // and call `.focus()` on it directly.
    const nameInputRef = useRef<HTMLInputElement>(null);
    const numberInputRef = useRef<HTMLInputElement>(null);
    const expirationInputRef = useRef<HTMLInputElement>(null);
    const cvcInputRef = useRef<HTMLInputElement>(null);
    const fieldRefs = {
      name: nameInputRef,
      number: numberInputRef,
      expiration: expirationInputRef,
      cvc: cvcInputRef,
    } as const;
    type FieldKey = keyof typeof fieldRefs;
    // Only the fields rendered right now: before the number is revealed,
    // name/expiration/cvc don't exist in the DOM, and their refs would be
    // `null`. Number first, matching the order a person fills the card in
    // (the number is the only field visible before reveal), and, for each
    // layout, matching that layout's visual and DOM order. Tab/Shift+Tab
    // must agree with this array on which field comes first, since an
    // inbound Tab from outside the component lands wherever the DOM puts
    // first, before this array's Tab interception can run. The layouts
    // differ: the "overlay" card puts Expiration between Number and Name
    // (see the front-face JSX in IncrediCardEmbeddedFace.tsx; it matches a
    // physical card's "Valid Thru" placement), while the "stacked" field
    // list below the decorative card puts Name before an Expiration+CVC
    // row. A single shared order would put one layout's Tab order out of
    // step with what it shows on screen.
    const activeFieldOrder: FieldKey[] = isRevealed
      ? isOverlay
        ? ["number", "expiration", "name", "cvc"]
        : ["number", "name", "expiration", "cvc"]
      : ["number"];

    // Set instead of focusing directly whenever the move crosses sides
    // (front to back or back to front); see the comment in
    // `focusAdjacentField` for why, and the effect below that flushes it.
    const pendingFocusRef = useRef<FieldKey | null>(null);

    function focusAdjacentField(current: FieldKey, direction: 1 | -1) {
      const index = activeFieldOrder.indexOf(current);
      const target = activeFieldOrder[index + direction];
      if (!target) return;
      // CVC is the only field ever on the back, and only for non-Amex
      // (Amex's CVC prints on the front; see the `cvcOnFront` prop below).
      const targetNeedsBack = target === "cvc" && !isAmex;
      if (targetNeedsBack !== flipped) {
        // Crossing sides. In the "overlay" layout, the field on whichever
        // side ISN'T showing is `inert` (the `useInert` hook in
        // IncrediCardEmbeddedFace.tsx), and a browser refuses to focus
        // anything inert, or anything inside an inert container. Calling
        // `.focus()` here, before the flip's re-render has cleared that
        // attribute from the DOM, silently does nothing. `setFlipped`
        // doesn't update the DOM synchronously either (React batches it),
        // so the only reliable order is: flip now, record which field
        // still needs focus, and let the effect below apply it once the
        // flip's re-render (and IncrediCardEmbeddedFace's `useInert`
        // effect within it, which runs first, since child effects fire
        // before their parent's in the same commit) has taken the target
        // out of `inert`.
        pendingFocusRef.current = target;
        setFlipped(targetNeedsBack);
        return;
      }
      fieldRefs[target].current?.focus();
    }

    // Flushes `pendingFocusRef` once `flipped` has changed and committed;
    // seeing it change confirms the DOM update `focusAdjacentField` above
    // is waiting on has happened. Keyed on `[flipped]` rather than running
    // on every render: calling `setFlipped` with the value it already
    // holds (any same-side move, which never touches `pendingFocusRef`)
    // doesn't re-render, so this never fires needlessly for those.
    useEffect(() => {
      const target = pendingFocusRef.current;
      if (!target) return;
      pendingFocusRef.current = null;
      fieldRefs[target].current?.focus();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [flipped]);

    // While `processing`, the card turns itself over on a slow loop, so a
    // skeuomorphic card visibly *does something* rather than just dimming.
    // Both faces carry a spinner (see IncrediCardSpinner) because the
    // visible side keeps changing.
    //
    // 2000ms between flips, against the flip's 280ms transition: the card
    // turns, then rests roughly 1.7s before turning back. Fast enough to
    // read as activity, slow enough not to look like a glitch or make the
    // spinner's rotation hard to follow.
    //
    // The user cannot fight this: the flip control is disabled while
    // processing, and the fields are read-only, so nothing else is
    // driving `flipped` at the same time.
    //
    // Skipped entirely under reduced motion rather than merely
    // un-animated. The flip's transition is already removed there, so
    // looping would snap the card between faces every two seconds with no
    // motion connecting them -- the most jarring possible reading of a
    // setting that asks for less movement. `processing` is still carried
    // by the dimmed card, the read-only fields, the processing label and
    // an opacity pulse.
    useEffect(() => {
      if (!processing) return undefined;
      if (prefersReducedMotion()) return undefined;
      const id = setInterval(
        () => setFlipped((current) => !current),
        PROCESSING_FLIP_INTERVAL_MS,
      );
      return () => {
        clearInterval(id);
        // Land face-up again when processing ends, rather than leaving
        // the card stranded on whichever side the last tick happened to
        // reach. In the cleanup, not a second effect, so it runs on the
        // processing -> false transition and on unmount alike.
        setFlipped(false);
      };
      // `setFlipped` is a stable useCallback([]) wrapper, so listing it
      // here cannot retrigger the loop; it satisfies the exhaustive-deps
      // rule without suppressing it.
    }, [processing, setFlipped]);

    // The flip control's click handler (both layouts). Rather than just
    // turning the card over, it moves focus to the first field on the side
    // being revealed, reusing the flip-then-deferred-focus mechanism
    // `focusAdjacentField` needs for the same reason (the target field may
    // be `inert` in "overlay" until the flip's re-render clears it).
    function flipAndFocusFirstField() {
      const next = !flipped;
      // CVC is the only field ever on the back. The flip control is never
      // rendered for Amex (nothing on the back to flip to), so this never
      // needs to account for Amex's front-printed CVC.
      const target: FieldKey = next ? "cvc" : "number";
      // If the card is already effectively zoomed (a field has focus, or
      // it was manually toggled), keep it that way through the flip.
      // Clicking the flip control focuses IT (a real `<button>`), blurring
      // whatever field held focus, so `fieldsFocused` drops to `false` for
      // the brief window before the deferred focus below lands on the new
      // target. Latching `manuallyZoomed` keeps the card visibly zoomed
      // through the whole transition instead of a zoom-out-then-back-in
      // flicker (or staying zoomed out if the deferred focus ever failed).
      // `handleFieldsetBlur` latches the same flag earlier, at blur time;
      // this is the click-time half. Starting from a NOT-zoomed card, this
      // is skipped: the deferred focus landing on the target field is what
      // zooms it in.
      if (cardZoomed) {
        setManuallyZoomed(true);
      }
      pendingFocusRef.current = target;
      setFlipped(next);
    }

    // Shared by all four fields below. Up/Down always move between fields
    // (a single-line text input gives native Up/Down nothing to do, so
    // there's no existing behavior to preserve). Left/Right only move
    // between fields once the caret is at the respective edge of the
    // CURRENT field's text with nothing selected; everywhere else,
    // Left/Right move the text caret as usual. Without that boundary
    // check, arrow-key navigation would make it impossible to move the
    // caret left from the middle of a name toward its start without
    // jumping to a different field entirely.
    //
    // Tab/Shift+Tab are intercepted here too, for the "overlay" layout:
    // un-intercepted Tab never reaches CVC there, because the browser's
    // native Tab order skips anything `inert` (the `useInert` hook in
    // IncrediCardEmbeddedFace.tsx), and CVC stays `inert` until something
    // flips the card, which native Tab never does. Routing Tab through the
    // same `focusAdjacentField` path the arrow keys use gives it the same
    // flip-then-deferred-focus handling. Tab isn't intercepted at either
    // end of the sequence (`target` is `undefined` there), so the browser's
    // default still moves focus out of the fieldset from the last field,
    // or into it from whatever precedes this component on the page.
    //
    // `react-hooks/refs` reports four violations against the
    // `focusAdjacentField` calls below ("Passing a ref to a function may
    // read its value during render"). They are false positives: this is a
    // handler *factory*, so `handleFieldKeyDown("name")` is called during
    // render, and the rule follows that call and analyzes the returned
    // closure's body as render-phase code, once per call site, hence
    // exactly four. Nothing in that closure runs until a real keydown.
    // Rewriting the call sites as
    // `onKeyDown={(event) => handleFieldKeyDown("name")(event)}` silences
    // all four with no behavioral change, which confirms the diagnosis.
    // The plain form is kept: the rule is off in ESLint (its known false
    // positives are tracked by `npm run lint:refs`), and a wrapper layer
    // added only to appease it would obscure the code.
    function handleFieldKeyDown(
      current: FieldKey,
    ): React.KeyboardEventHandler<HTMLInputElement> {
      return (event) => {
        if (event.key === "Tab") {
          const direction = event.shiftKey ? -1 : 1;
          const index = activeFieldOrder.indexOf(current);
          if (!activeFieldOrder[index + direction]) return;
          event.preventDefault();
          focusAdjacentField(current, direction);
          return;
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          focusAdjacentField(current, 1);
          return;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          focusAdjacentField(current, -1);
          return;
        }
        const input = event.currentTarget;
        const atStart = input.selectionStart === 0 && input.selectionEnd === 0;
        const atEnd =
          input.selectionStart === input.value.length &&
          input.selectionEnd === input.value.length;
        if (event.key === "ArrowLeft" && atStart) {
          event.preventDefault();
          focusAdjacentField(current, -1);
          return;
        }
        if (event.key === "ArrowRight" && atEnd) {
          event.preventDefault();
          focusAdjacentField(current, 1);
        }
      };
    }

    // Built once and rendered into whichever layout is active below.
    // Every prop except `hideLabel`/`placeholder` (both "overlay"-only:
    // a hidden real label and physical-card-style placeholder text) is
    // identical either way, so there's exactly one place that owns each
    // field's wiring rather than two copies that could drift apart.
    const nameField = (
      <IncrediCardField
        id={nameFieldId}
        label={labels.cardholderNameLabel}
        hideLabel={isOverlay}
        placeholder={isOverlay ? labels.cardholderNamePlaceholder : undefined}
        size={fieldSize}
        // OCR-A, standing in for a real card's engraved name, distinct
        // from OCR-B's printed-digit look below; see `IncrediCardTheme`'s
        // header comment.
        containerClassName={isVintage ? styles.vintageNameField : undefined}
        disabled={disabled}
        readOnly={readOnly || processing}
        required={required}
        invalid={Boolean(nameError)}
        errorText={nameError}
        hideErrorText
        autoComplete="cc-name"
        value={committedValue.cardholderName}
        onChange={(event) => commit({ cardholderName: event.target.value })}
        onFocus={() => setFlipped(false)}
        onBlur={() => markTouched("cardholderName")}
        ref={nameInputRef}
        onKeyDown={handleFieldKeyDown("name")}
      />
    );

    const numberField = (
      <IncrediCardMaskedField
        id={numberFieldId}
        label={labels.cardNumberLabel}
        hideLabel={isOverlay}
        placeholder={isOverlay ? labels.cardNumberPlaceholder : undefined}
        size={fieldSize}
        // OCR-B; see `IncrediCardTheme`'s header comment.
        containerClassName={isVintage ? styles.vintageMonoField : undefined}
        disabled={disabled}
        readOnly={readOnly || processing}
        required={required}
        invalid={Boolean(numberError)}
        errorText={numberError}
        hideErrorText
        autoComplete="cc-number"
        pattern={networkInfo.numberPattern}
        characterClass="numeric"
        value={committedValue.cardNumber}
        onChange={(digits) => commit({ cardNumber: digits ?? "" })}
        onFocus={() => setFlipped(false)}
        onBlur={() => markTouched("cardNumber")}
        ref={numberInputRef}
        onKeyDown={handleFieldKeyDown("number")}
      />
    );

    const expirationField = (
      <IncrediCardMaskedField
        id={expirationFieldId}
        label={labels.expirationLabel}
        hideLabel={isOverlay}
        placeholder={isOverlay ? labels.expirationPlaceholder : undefined}
        size={fieldSize}
        // OCR-B; see `IncrediCardTheme`'s header comment.
        containerClassName={isVintage ? styles.vintageMonoField : undefined}
        disabled={disabled}
        readOnly={readOnly || processing}
        required={required}
        invalid={Boolean(expirationError)}
        errorText={expirationError}
        hideErrorText
        autoComplete="cc-exp"
        pattern="XX/XX"
        characterClass="numeric"
        value={expirationDigits || null}
        onChange={(digits) => {
          const raw = digits ?? "";
          commit({
            expirationMonth: raw.slice(0, 2),
            expirationYear: raw.slice(2, 4),
          });
        }}
        onFocus={() => setFlipped(false)}
        onBlur={() => markTouched("expiration")}
        ref={expirationInputRef}
        onKeyDown={handleFieldKeyDown("expiration")}
      />
    );

    const cvcField = (
      <IncrediCardMaskedField
        id={cvcFieldId}
        label={labels.cvcLabel}
        hideLabel={isOverlay}
        placeholder={isOverlay ? labels.cvcPlaceholder : undefined}
        size={fieldSize}
        // OCR-B; see `IncrediCardTheme`'s header comment.
        containerClassName={isVintage ? styles.vintageMonoField : undefined}
        disabled={disabled}
        readOnly={readOnly || processing}
        required={required}
        invalid={Boolean(cvcError)}
        errorText={cvcError}
        hideErrorText
        autoComplete="cc-csc"
        // A digit-only 'X' template with no literal punctuation.
        // IncrediCardMaskedField's charLimitOf derives its max length from
        // this, so it grows from 3 to 4 once an Amex number is detected,
        // with no separate maxLength prop needed.
        pattern={"X".repeat(networkInfo.cvcLength)}
        characterClass="numeric"
        // type="password": the one field this component obscures
        // everywhere, on the real input as well as its card-face mirror
        // (IncrediCardFace.tsx/IncrediCardEmbeddedFace.tsx). A CVC has no
        // legitimate reason to be shown in the clear once entered.
        type="password"
        value={committedValue.cvc}
        onChange={(digits) => commit({ cvc: digits ?? "" })}
        // Flips to whichever side the CVC prints on: the back for every
        // network except Amex, whose CVC sits on the front (flipping
        // anyway would just show an empty back). The other three fields'
        // `onFocus={() => setFlipped(false)}` is the mirror image of this
        // rule: together, focusing any field (by click, Tab, or the
        // arrow-key navigation above) always shows the side that field is
        // printed on, not just when moving INTO the back.
        onFocus={() => setFlipped(!isAmex)}
        onBlur={() => markTouched("cvc")}
        ref={cvcInputRef}
        onKeyDown={handleFieldKeyDown("cvc")}
      />
    );

    // One consolidated block below the whole card, in place of each
    // field's inline errorText (which is still real and still associated
    // via aria-describedby, just visually hidden; see hideErrorText
    // above). Not an aria-live region: each field's aria-invalid/
    // aria-describedby already announces its error the moment a
    // screen-reader user reaches it, so a live region here would announce
    // the same thing a second time on every change. This is a plain,
    // static block that a sighted user reads visually and a screen-reader
    // user can reach in normal document order, not a proactive
    // announcement.
    const activeErrors = (
      [
        { id: nameFieldId, message: nameError },
        { id: numberFieldId, message: numberError },
        { id: expirationFieldId, message: expirationError },
        { id: cvcFieldId, message: cvcError },
      ] as const
    ).filter((entry): entry is { id: string; message: string } =>
      Boolean(entry.message),
    );

    return (
      <fieldset
        {...rest}
        ref={mergeRefs(fieldsetRef, ref)}
        id={id}
        disabled={disabled}
        data-theme={isVintage ? "vintage" : undefined}
        // "stacked" layout only. The `.incredicard[data-zoomed]
        // .faceContainer` rule in IncrediCard.module.scss reads this
        // directly, already fully resolved (`scale` enabled AND currently
        // zoomed, via real focus or the manual toggle), so CSS needs no
        // separate check of either condition. The "overlay" layout doesn't
        // use it here: its real fields sit inside IncrediCardEmbeddedFace's
        // `.faceWrapper`, which is also the scale target, so that
        // component carries the same attribute itself (see its
        // `cardZoomed`/`scale` props).
        data-zoomed={!isOverlay && scale && cardZoomed ? "" : undefined}
        className={classNames(styles.incredicard, className)}
        onFocus={handleFieldsetFocus}
        onBlur={handleFieldsetBlur}
        onPointerDown={handlePointerDown}
      >
        <legend className={styles.visuallyHidden}>{labels.legend}</legend>
        {isOverlay ? (
          <IncrediCardEmbeddedFace
            flipped={flipped}
            flipAngleDeg={flipTurns * 180}
            theme={theme}
            chipReflection={chipReflection}
            holographic={holographic}
            tilt={tilt}
            cardZoomed={cardZoomed}
            scale={scale}
            onCardClick={scale ? handleCardClick : undefined}
            processing={processing}
            processingLabel={labels.processingLabel}
            acceptanceMarkSrc={acceptanceMarkSrc}
            nameField={isRevealed ? nameField : null}
            numberField={numberField}
            expirationField={isRevealed ? expirationField : null}
            cvcField={isRevealed ? cvcField : null}
            cvcOnFront={isAmex}
            onFlip={
              isRevealed && !isAmex && !processing
                ? flipAndFocusFirstField
                : undefined
            }
            flipToBackLabel={labels.showBackLabel}
            flipToFrontLabel={labels.showFrontLabel}
          />
        ) : (
          <div className={styles.layout}>
            <div className={styles.faceContainer}>
              <IncrediCardFace
                flipped={flipped}
                flipAngleDeg={flipTurns * 180}
                theme={theme}
                chipReflection={chipReflection}
                holographic={holographic}
                tilt={tilt}
                cardZoomed={cardZoomed}
                onCardClick={scale ? handleCardClick : undefined}
                revealed={isRevealed}
                cvcOnFront={isAmex}
                acceptanceMarkSrc={acceptanceMarkSrc}
                cardholderNameDisplay={
                  committedValue.cardholderName
                    ? committedValue.cardholderName.toUpperCase()
                    : labels.cardholderNamePlaceholder
                }
                cardNumberDigits={committedValue.cardNumber}
                numberPattern={networkInfo.numberPattern}
                numberPlaceholder={numberPlaceholder}
                expirationDisplay={applyMask(expirationDigits, "XX/XX")}
                expirationPlaceholder={labels.expirationPlaceholder}
                cvcDigitCount={committedValue.cvc.length}
                cvcPlaceholder={labels.cvcPlaceholder}
                nameInvalid={Boolean(nameError)}
                numberInvalid={Boolean(numberError)}
                expirationInvalid={Boolean(expirationError)}
                cvcInvalid={Boolean(cvcError)}
                processing={processing}
                processingLabel={labels.processingLabel}
              />
              {/* Half on, half off the card's top-right corner (a nod to
               the original Skeuocard's bubble-shaped flip control); see
               the identical badge in IncrediCardEmbeddedFace.module.scss.
               Positioned relative to .faceContainer here rather than
               living inside IncrediCardFace, whose contract is "purely
               decorative, nothing inside it interactive." Omitted
               entirely (not just disabled) until there's something to
               flip to: before a valid number is known, and always for
               Amex (its CVC already sits on the front). Omitted while
               `processing` too: the card is turning itself over on a
               loop there, so a control offering to turn it over is both
               inert and confusing; a disabled button next to a card
               already flipping reads as broken. */}
              {isRevealed && !isAmex && !processing ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={flipAndFocusFirstField}
                  aria-label={
                    flipped ? labels.showFrontLabel : labels.showBackLabel
                  }
                  className={styles.flipBadge}
                >
                  <FlipIcon />
                </button>
              ) : null}
            </div>
            <div className={styles.fields}>
              {numberField}
              {isRevealed ? nameField : null}
              {isRevealed ? (
                <div className={styles.row}>
                  {expirationField}
                  {cvcField}
                </div>
              ) : null}
            </div>
          </div>
        )}
        {activeErrors.length > 0 ? (
          <div className={styles.errorSummary}>
            {activeErrors.map((error) => (
              <p key={error.id} className={styles.errorSummaryItem}>
                {error.message}
              </p>
            ))}
          </div>
        ) : null}
      </fieldset>
    );
  },
);

// IncrediCard.Field/IncrediCard.MaskedField are the same building blocks
// this component composes internally for its name/number/expiration/CVC
// fields, exposed as a compound namespace rather than two more flat
// top-level exports. They let you build an entirely custom arrangement
// (your own layout, a subset of fields, a field this component doesn't
// have) with the same look, the on-card "overlay" styling included, via
// the same --theme-incredicard-field-* properties this component's
// fields read. Neither carries any of IncrediCard's state (validation,
// network detection, the flip); when you compose them directly, you own
// all of that, the same contract IncrediCard keeps with the fields it
// builds.
//
// The `IncrediCard` namespace is composed in index.ts, NOT here, and
// that is load-bearing rather than indirection. This module is
// `"use client"`. A React Server Component importing from a client
// module receives client *references*, not these objects, and
// properties attached with `Object.assign` do not survive that boundary,
// so composing here would make `IncrediCard.Field` and
// `IncrediCard.MaskedField` `undefined` for every server-component
// caller.
export { IncrediCardBase };
