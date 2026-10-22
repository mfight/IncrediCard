// The caret-preserving mask engine behind IncrediCardMaskedField. Every
// function here is pure and dependency-free (no React, no other
// IncrediCard file). Internal: not part of the public API, and free to
// change.
export type MaskCharacterClass = "numeric" | "alphanumeric" | RegExp | ((char: string) => boolean);

const CHARACTER_CLASS_PATTERNS: Record<"numeric" | "alphanumeric", RegExp> = {
  numeric: /[0-9]/,
  alphanumeric: /[a-zA-Z0-9]/,
};

export function resolveCharacterTest(characterClass: MaskCharacterClass): (char: string) => boolean {
  if (typeof characterClass === "function") return characterClass;
  if (characterClass instanceof RegExp) return (char) => characterClass.test(char);
  return (char) => CHARACTER_CLASS_PATTERNS[characterClass].test(char);
}

// Strips every character that fails `isAllowed`, one code point at a time.
export function extractAllowedChars(value: string, isAllowed: (char: string) => boolean): string {
  let result = "";
  for (const char of value) {
    if (isAllowed(char)) result += char;
  }
  return result;
}

// Renders `chars` into `template`, where 'X' marks a placeholder and
// every other character is literal punctuation. Progressive/partial by
// construction: a literal is only emitted once at least one character
// has already been placed, and the walk stops the instant a placeholder
// has no character left to fill.
export function applyMask(chars: string, template: string): string {
  if (chars.length === 0) return "";
  let result = "";
  let charIndex = 0;
  for (const templateChar of template) {
    if (templateChar === "X") {
      if (charIndex >= chars.length) break;
      result += chars[charIndex];
      charIndex += 1;
    } else {
      result += templateChar;
    }
  }
  return result;
}

// How many allowed characters sit at or before `caretPos` in `value`--
// counted against the pre-reformat string, so the same code path
// handles typing, backspace/delete, and paste alike.
export function countAllowedCharsBeforeCaret(
  value: string,
  caretPos: number,
  isAllowed: (char: string) => boolean
): number {
  let count = 0;
  for (let i = 0; i < caretPos && i < value.length; i += 1) {
    if (isAllowed(value[i])) count += 1;
  }
  return count;
}

// The inverse: where the caret belongs in a freshly-masked string so
// that exactly `n` allowed characters sit before it.
export function positionAfterNthAllowedChar(
  formatted: string,
  n: number,
  isAllowed: (char: string) => boolean
): number {
  if (n <= 0) return 0;
  let count = 0;
  for (let i = 0; i < formatted.length; i += 1) {
    if (isAllowed(formatted[i])) {
      count += 1;
      if (count === n) return i + 1;
    }
  }
  return formatted.length;
}
