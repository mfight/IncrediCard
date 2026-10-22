"use client";

import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from "react";
import { IncrediCardField, type IncrediCardFieldProps } from "./IncrediCardField";
import {
  extractAllowedChars,
  applyMask,
  countAllowedCharsBeforeCaret,
  positionAfterNthAllowedChar,
  resolveCharacterTest,
  type MaskCharacterClass,
} from "./maskEngine";

function mergeRefs<T>(...refs: Array<React.Ref<T> | undefined>): React.RefCallback<T> {
  return (node) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === "function") ref(node);
      else (ref as React.MutableRefObject<T | null>).current = node;
    }
  };
}

function charLimitOf(pattern: string): number {
  return pattern.split("").filter((char) => char === "X").length;
}

type IncrediCardMaskedFieldOwnProps = {
  /** Mask template--'X' marks a placeholder, every other character is
   * literal punctuation inserted live as characters are typed (e.g.
   * "XXXX XXXX XXXX XXXX" for a card number, "XX/XX" for an
   * expiration). The character limit is derived from the pattern
   * itself. */
  pattern: string;
  characterClass?: MaskCharacterClass;
  /** Canonical value is always the normalized digits, never the masked
   * display text. */
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (value: string | null) => void;
};

export type IncrediCardMaskedFieldProps = IncrediCardMaskedFieldOwnProps &
  Omit<IncrediCardFieldProps, keyof IncrediCardMaskedFieldOwnProps | "value" | "defaultValue" | "onChange">;

// A IncrediCardField with a caret-preserving live mask (see maskEngine.ts).
// The input shows the masked draft while the canonical value reported
// through `onChange` is only the allowed characters. On each change, the
// caret is placed after the same number of allowed characters it
// followed before reformatting, so typing, deleting and pasting in the
// middle of a value don't throw the caret to the end. Public as
// IncrediCard.MaskedField.
export const IncrediCardMaskedField = forwardRef<HTMLInputElement, IncrediCardMaskedFieldProps>(
  function IncrediCardMaskedField(
    { pattern, characterClass = "numeric", value, defaultValue = null, onChange, onBlur, onFocus, type = "text", inputMode = characterClass === "numeric" ? "numeric" : "text", ...rest },
    ref
  ) {
    const isAllowed = resolveCharacterTest(characterClass);
    const charLimit = charLimitOf(pattern);

    const isControlled = value !== undefined;
    const [uncontrolledValue, setUncontrolledValue] = useState<string | null>(
      defaultValue ? extractAllowedChars(defaultValue, isAllowed).slice(0, charLimit) : null
    );
    const committedValue = isControlled
      ? value
        ? extractAllowedChars(value, isAllowed).slice(0, charLimit)
        : null
      : uncontrolledValue;

    const [draft, setDraft] = useState(() => applyMask(committedValue ?? "", pattern));
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const pendingCaretRef = useRef<number | null>(null);

    useEffect(() => {
      if (isFocused) return;
      setDraft(applyMask(committedValue ?? "", pattern));
    }, [committedValue, pattern, isFocused]);

    useLayoutEffect(() => {
      if (pendingCaretRef.current === null || !inputRef.current) return;
      inputRef.current.setSelectionRange(pendingCaretRef.current, pendingCaretRef.current);
      pendingCaretRef.current = null;
    }, [draft]);

    function commit(next: string | null) {
      if (!isControlled) setUncontrolledValue(next);
      onChange?.(next);
    }

    function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
      const rawValue = event.target.value;
      const caretPos = event.target.selectionStart ?? rawValue.length;
      const charsBeforeCaret = countAllowedCharsBeforeCaret(rawValue, caretPos, isAllowed);
      const chars = extractAllowedChars(rawValue, isAllowed).slice(0, charLimit);
      const formatted = applyMask(chars, pattern);
      pendingCaretRef.current = positionAfterNthAllowedChar(formatted, charsBeforeCaret, isAllowed);
      setDraft(formatted);
      commit(chars.length > 0 ? chars : null);
    }

    function handleBlur(event: React.FocusEvent<HTMLInputElement>) {
      setIsFocused(false);
      onBlur?.(event);
    }

    function handleFocus(event: React.FocusEvent<HTMLInputElement>) {
      setIsFocused(true);
      onFocus?.(event);
    }

    return (
      <IncrediCardField
        {...rest}
        ref={mergeRefs(ref, inputRef)}
        type={type}
        inputMode={inputMode}
        value={draft}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
    );
  }
);
