import { forwardRef } from "react";
import styles from "./IncrediCardField.module.scss";

export type IncrediCardFieldSize = "sm" | "md" | "lg" | "xl";

function classNames(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

type IncrediCardFieldOwnProps = {
  id: string;
  label: React.ReactNode;
  /** Visually hides the label while keeping it in the accessibility
   * tree (still a real `<label htmlFor>`, just visually collapsed). Used
   * by the "overlay" layout, where the field's position on the card
   * conveys what it means. */
  hideLabel?: boolean;
  size?: IncrediCardFieldSize;
  invalid?: boolean;
  helperText?: React.ReactNode;
  errorText?: React.ReactNode;
  /** Visually hides `errorText` while keeping it in the accessibility
   * tree (a real element, still referenced by `aria-describedby`, just
   * visually collapsed). For a caller (such as IncrediCard.tsx) that shows
   * consolidated error text elsewhere instead of next to each field, but
   * still wants the per-field screen-reader announcement. The `invalid`
   * visual cue (a red border and glow; see IncrediCardField.module.scss)
   * is unaffected either way. */
  hideErrorText?: boolean;
  className?: string;
  /** Applied to the bordered box itself, not the outer
   * label+box+description stack, so a caller can style the box without
   * touching this component. */
  containerClassName?: string;
};

export type IncrediCardFieldProps = IncrediCardFieldOwnProps &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, keyof IncrediCardFieldOwnProps> & {
    "aria-describedby"?: never;
    "aria-invalid"?: never;
  };

// A small, self-contained text field: a label, a bordered input box, and
// helper/error text underneath, all styled by IncrediCardField.module.scss.
// It's the field every IncrediCard input is built on, and it's public as
// IncrediCard.Field for composing custom layouts. It has no state or
// validation of its own, and no dependency beyond React.
export const IncrediCardField = forwardRef<HTMLInputElement, IncrediCardFieldProps>(function IncrediCardField(
  {
    id,
    label,
    hideLabel = false,
    size = "md",
    invalid = false,
    disabled = false,
    readOnly = false,
    helperText,
    errorText,
    hideErrorText = false,
    className,
    containerClassName,
    ...rest
  },
  ref
) {
  const isInvalid = invalid || Boolean(errorText);
  const helperTextId = `${id}-helper`;
  const errorTextId = `${id}-error`;
  const describedBy =
    [errorText ? errorTextId : null, helperText ? helperTextId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div
      className={classNames(styles.field, styles[`size-${size}`], className)}
      data-invalid={isInvalid || undefined}
      data-disabled={disabled || undefined}
      data-readonly={readOnly || undefined}
    >
      <label htmlFor={id} className={classNames(styles.label, hideLabel && styles.visuallyHidden)}>
        {label}
      </label>
      <div className={classNames(styles.container, containerClassName)}>
        <input
          {...rest}
          ref={ref}
          id={id}
          disabled={disabled}
          readOnly={readOnly}
          aria-invalid={isInvalid ? "true" : undefined}
          aria-describedby={describedBy}
          className={styles.input}
        />
      </div>
      {helperText ? (
        <p id={helperTextId} className={classNames(styles.description, Boolean(errorText) && styles.visuallyHidden)}>
          {helperText}
        </p>
      ) : null}
      {errorText ? (
        <p
          id={errorTextId}
          className={classNames(styles.description, styles.errorDescription, hideErrorText && styles.visuallyHidden)}
        >
          {errorText}
        </p>
      ) : null}
    </div>
  );
});
