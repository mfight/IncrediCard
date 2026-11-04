"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { IncrediCardFieldSize } from "./IncrediCardField";
import type { IncrediCardNetwork } from "./acceptanceMarks";
import styles from "./IncrediCardField.module.scss";

function classNames(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

/** What a hosted field reports about itself. A payment processor's field
 * never reveals what's typed into it, only this. */
export type IncrediCardHostedFieldState = {
  /** Nothing typed yet. */
  empty: boolean;
  /** Filled in and valid, as far as the processor's own checks go. */
  complete: boolean;
  /** The processor's message for what's wrong, or none. Shown, like
   * IncrediCard's own field errors, only once the field has lost focus. */
  error?: string;
  /** Whether focus is inside the field. Focus inside another origin's
   * frame never reaches this page, so this is the only way IncrediCard
   * learns of it. */
  focused: boolean;
};

/** The field's text styling, read from the slot the field sits in, for
 * passing into the processor's own style configuration: this page's CSS
 * can't reach inside the processor's frame. Every value is a resolved CSS
 * value (lengths in px, colors as `rgb()`). */
export type IncrediCardHostedFieldStyle = {
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  letterSpacing: string;
  /** The height of one line of the field's text: what to size the
   * processor's frame to. */
  lineHeight: string;
  color: string;
  placeholderColor: string;
  /** For the processor's invalid state. */
  errorColor: string;
  /** `none` unless the theme raises its characters. */
  textShadow: string;
  textAlign: string;
  fontVariantNumeric: string;
};

/** Passed to a hosted field's `render`. */
export type IncrediCardHostedFieldContext = {
  /** The field's accessible name, from `labels`. IncrediCard can't label
   * an input inside another origin's frame, so pass this to the
   * processor's label or aria-label option. */
  label: string;
  /** The placeholder IncrediCard's own field would show here, from
   * `labels`; `undefined` where it would show none. */
  placeholder: string | undefined;
  /** `null` only on the very first render, before the slot has been
   * measured; it arrives before anything is painted. Updated whenever the
   * theme, text tone, field size or card width changes it. */
  style: IncrediCardHostedFieldStyle | null;
  /** Disabled, read-only or processing: the field should take no input. */
  disabled: boolean;
};

export type IncrediCardHostedField = IncrediCardHostedFieldState & {
  /** Renders the element the processor mounts its field into. Called on
   * every render, so return the same component each time, or React will
   * remount it and the processor's field with it. */
  render: (context: IncrediCardHostedFieldContext) => React.ReactNode;
  /** Moves focus into the field. IncrediCard calls it to move between
   * fields with Tab and to land in a field after a flip. Processors
   * provide one (Stripe Elements' `element.focus()`, for example). */
  focus: () => void;
};

/** The `hostedFields` prop: a payment processor's own fields standing in
 * for IncrediCard's card number, expiration and security code. All three
 * together, or none: IncrediCard then holds no card data at all, only the
 * cardholder name. */
export type IncrediCardHostedFields = {
  cardNumber: IncrediCardHostedField;
  expiration: IncrediCardHostedField;
  cvc: IncrediCardHostedField;
  /** The network the processor detected from the number, which picks the
   * acceptance mark, the security code's length and whether it prints on
   * the front (Amex). `null` or left out until one is detected. */
  network?: IncrediCardNetwork | null;
  /** The number's last four digits, if the processor reveals them (most
   * do only after tokenizing). The "stacked" card face shows them after
   * the masked digits. */
  last4?: string;
};

const EMPTY_STYLE_KEY = "";

function styleKey(style: IncrediCardHostedFieldStyle | null) {
  return style ? Object.values(style).join("|") : EMPTY_STYLE_KEY;
}

// Reads the text styling a real IncrediCard field would have in this slot,
// from `probe`: a real `<input>` styled exactly like one (same classes,
// same slot, same `input` selectors), disabled, hidden and out of the
// accessibility tree. Measuring a real input rather than recomputing the
// theme's values means every rule that styles IncrediCard's own fields,
// the theme's, the on-card slot's and your own `--theme-incredicard-field-*`
// overrides alike, reaches the hosted field too.
function readStyle(probe: HTMLInputElement, errorProbe: HTMLElement): IncrediCardHostedFieldStyle {
  const computed = getComputedStyle(probe);
  // Chromium, Firefox and Safari all resolve `::placeholder` here.
  const placeholder = getComputedStyle(probe, "::placeholder");
  return {
    fontFamily: computed.fontFamily,
    fontSize: computed.fontSize,
    fontWeight: computed.fontWeight,
    letterSpacing: computed.letterSpacing,
    // Layout height, which a zoom's `transform: scale()` doesn't change.
    lineHeight: `${probe.offsetHeight}px`,
    color: computed.color,
    placeholderColor: placeholder.color || computed.color,
    errorColor: getComputedStyle(errorProbe).color,
    textShadow: computed.textShadow,
    textAlign: computed.textAlign,
    fontVariantNumeric: computed.fontVariantNumeric,
  };
}

type IncrediCardHostedFieldSlotProps = {
  id: string;
  label: string;
  hideLabel: boolean;
  placeholder?: string;
  size: IncrediCardFieldSize;
  containerClassName?: string;
  disabled: boolean;
  /** Read-only or processing: styled as read-only, and `render` is told
   * the field should take no input. */
  readOnly: boolean;
  invalid: boolean;
  errorText?: string;
  field: IncrediCardHostedField;
  /** The security code: measured as a password field, the way IncrediCard's
   * own is rendered, so its masking dots get the same system font. */
  masked?: boolean;
  /** Which invisible guards to render around the field. See below. */
  guardBefore: boolean;
  guardAfter: boolean;
  /** Called when focus leaves the field through a guard: -1 backward,
   * 1 forward. */
  onLeave: (direction: 1 | -1) => void;
};

// One hosted field in IncrediCard's place: the same label, bordered box and
// error text as IncrediCardField, with the processor's element where the
// `<input>` would be. It uses IncrediCardField's own stylesheet, so both
// layouts' slot styling reaches it unchanged.
//
// Keys pressed inside another origin's frame never reach this page, so
// IncrediCard can't intercept Tab there the way it does in its own fields
// (see `handleFieldKeyDown` in IncrediCard.tsx). Instead, an invisible,
// focusable guard sits on either side of the frame. Tab out of the frame
// lands on the next one in the page, which hands focus to wherever
// IncrediCard's own order goes next, flipping the card if that field is on
// the other side. A guard reached from the other direction, by Tab from
// before the field or Shift+Tab from after it, hands focus into the field.
// A guard is left out where the field is first or last in the order, so
// Tab still enters and leaves the component the way the page puts it.
export function IncrediCardHostedFieldSlot({
  id,
  label,
  hideLabel,
  placeholder,
  size,
  containerClassName,
  disabled,
  readOnly,
  invalid,
  errorText,
  field,
  masked = false,
  guardBefore,
  guardAfter,
  onLeave,
}: IncrediCardHostedFieldSlotProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLInputElement>(null);
  const errorProbeRef = useRef<HTMLSpanElement>(null);
  const [style, setStyle] = useState<IncrediCardHostedFieldStyle | null>(null);

  // On every render, since the theme, text tone and field size all change
  // the styling without changing this component's props, and on every
  // resize, since the on-card sizes follow the card's width (`cqw`). Only a
  // real change re-renders, so the processor is told only then.
  useLayoutEffect(() => {
    const probe = probeRef.current;
    const errorProbe = errorProbeRef.current;
    const container = containerRef.current;
    if (!probe || !errorProbe || !container) return undefined;
    function measure() {
      const next = readStyle(probe!, errorProbe!);
      setStyle((current) => (styleKey(current) === styleKey(next) ? current : next));
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  });

  const labelId = `${id}-label`;
  const errorTextId = `${id}-error`;

  // Whether focus is arriving at a guard from inside the field: Tab or
  // Shift+Tab out of the frame. The frame's own report that it has lost
  // focus arrives after this, so `field.focused` is still true here; a
  // `relatedTarget` inside the slot covers a frame that has reported
  // nothing.
  function cameFromField(event: React.FocusEvent<HTMLSpanElement>) {
    const from = event.relatedTarget;
    return field.focused || Boolean(from && containerRef.current?.contains(from));
  }

  function handleGuardFocus(event: React.FocusEvent<HTMLSpanElement>, direction: 1 | -1) {
    if (cameFromField(event)) onLeave(direction);
    else field.focus();
  }

  return (
    <div
      className={classNames(styles.field, styles[`size-${size}`])}
      data-invalid={invalid || undefined}
      data-disabled={disabled || undefined}
      data-readonly={readOnly || undefined}
    >
      {/* Not a `<label>`: one can't point into another origin's frame. The
          processor labels its own input, from the `label` IncrediCard
          passes to `render`. This is the visible half. */}
      <span id={labelId} className={classNames(styles.label, hideLabel && styles.visuallyHidden)}>
        {label}
      </span>
      <div
        ref={containerRef}
        className={classNames(styles.container, styles.hostedContainer, containerClassName)}
        // The focus ring, which `:focus-visible` can't give a frame whose
        // focus this page never sees.
        data-focused={field.focused || undefined}
      >
        {guardBefore ? (
          <span
            className={styles.focusGuard}
            tabIndex={disabled ? -1 : 0}
            onFocus={(event) => handleGuardFocus(event, -1)}
          />
        ) : null}
        <div className={styles.hostedElement}>
          {field.render({ label, placeholder, style, disabled: disabled || readOnly })}
        </div>
        {guardAfter ? (
          <span
            className={styles.focusGuard}
            tabIndex={disabled ? -1 : 0}
            onFocus={(event) => handleGuardFocus(event, 1)}
          />
        ) : null}
        <input
          ref={probeRef}
          className={classNames(styles.input, styles.styleProbe)}
          type={masked ? "password" : "text"}
          placeholder={placeholder ?? " "}
          aria-hidden="true"
          disabled
          tabIndex={-1}
          value=""
          readOnly
        />
        <span ref={errorProbeRef} className={classNames(styles.errorDescription, styles.styleProbe)} aria-hidden="true" />
      </div>
      {errorText ? (
        <p id={errorTextId} className={classNames(styles.description, styles.errorDescription, styles.visuallyHidden)}>
          {errorText}
        </p>
      ) : null}
    </div>
  );
}
