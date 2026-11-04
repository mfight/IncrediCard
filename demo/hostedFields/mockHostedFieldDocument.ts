// The page inside a mock hosted field's frame (see MockHostedField.tsx): a
// stand-in for a payment processor's field, for the stories only. It runs in
// a sandboxed frame with an opaque origin, so, like a real processor's frame
// on another origin, the page outside can't read its input, and focus and
// key presses inside it stay inside. Everything crosses by `postMessage`.
//
// It checks what a processor checks, roughly: a Luhn-valid number of the
// right length for a few networks, a month and a year not in the past, and a
// security code of the length it's told. Its error messages are written the
// way a processor's are, so they read as the processor's, not IncrediCard's.
//
// Messages in:
// - { type: "config", style, placeholder, label, disabled, cvcLength, fonts }
// - { type: "focus" }: focus the input (the frame itself has just been
//   focused from outside, which is what allows this)
// - { type: "type", text }: for the stories' tests only, which can't reach
//   inside the frame to type; replaces the value as if typed
//
// Messages out:
// - { type: "ready" }
// - { type: "state", report: { empty, complete, error, focused, network, last4 } }

export type MockHostedFieldKind = "cardNumber" | "expiration" | "cvc";

const SCRIPT = String.raw`
const kind = document.documentElement.dataset.kind;
const input = document.querySelector("input");
const dynamic = document.getElementById("dynamic");
let cvcLength = 3;

function post(message) {
  parent.postMessage(message, "*");
}

function detect(digits) {
  if (/^3[47]/.test(digits)) return "amex";
  if (/^4/.test(digits)) return "visa";
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(digits)) return "mastercard";
  if (/^(6011|65|64[4-9])/.test(digits)) return "discover";
  return null;
}

function luhn(digits) {
  let sum = 0;
  for (let index = 0; index < digits.length; index += 1) {
    let digit = Number(digits[digits.length - 1 - index]);
    if (index % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

function lengthFor(network) {
  return network === "amex" ? 15 : 16;
}

function format(digits) {
  if (kind === "cardNumber") {
    const network = detect(digits);
    const groups = network === "amex" ? [4, 6, 5] : [4, 4, 4, 4];
    const kept = digits.slice(0, lengthFor(network));
    const parts = [];
    let start = 0;
    for (const size of groups) {
      if (start >= kept.length) break;
      parts.push(kept.slice(start, start + size));
      start += size;
    }
    return parts.join(" ");
  }
  if (kind === "expiration") {
    const kept = digits.slice(0, 4);
    return kept.length > 2 ? kept.slice(0, 2) + " / " + kept.slice(2) : kept;
  }
  return digits.slice(0, cvcLength);
}

function report() {
  const digits = input.value.replace(/\D/g, "");
  const state = {
    empty: digits.length === 0,
    complete: false,
    error: undefined,
    focused: document.activeElement === input,
    network: null,
    last4: undefined,
  };
  if (kind === "cardNumber") {
    state.network = detect(digits);
    if (digits.length === lengthFor(state.network)) {
      if (luhn(digits)) {
        state.complete = true;
        // A real processor reveals these only once the card is tokenized.
        state.last4 = digits.slice(-4);
      } else {
        state.error = "Your card number is invalid.";
      }
    }
  } else if (kind === "expiration") {
    if (digits.length === 4) {
      const month = Number(digits.slice(0, 2));
      const year = 2000 + Number(digits.slice(2));
      const now = new Date();
      if (month < 1 || month > 12) state.error = "Your card's expiration date is invalid.";
      else if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1))
        state.error = "Your card's expiration year is in the past.";
      else state.complete = true;
    }
  } else {
    state.complete = digits.length === cvcLength;
  }
  input.classList.toggle("invalid", Boolean(state.error));
  post({ type: "state", report: state });
}

function reformat() {
  const formatted = format(input.value.replace(/\D/g, ""));
  if (formatted !== input.value) input.value = formatted;
  report();
}

function applyConfig(config) {
  cvcLength = config.cvcLength || cvcLength;
  input.placeholder = config.placeholder || "";
  input.setAttribute("aria-label", config.label || "");
  input.disabled = Boolean(config.disabled);
  const style = config.style;
  const faces = (config.fonts || [])
    .map((font) => "@font-face { font-family: " + JSON.stringify(font.family) + "; src: url(" + font.src + "); font-weight: " + (font.weight || "normal") + "; }")
    .join("\n");
  dynamic.textContent = style
    ? faces + "\ninput { font-family: " + style.fontFamily + "; font-size: " + style.fontSize + "; font-weight: " + style.fontWeight +
      "; letter-spacing: " + style.letterSpacing + "; line-height: " + style.lineHeight + "; height: " + style.lineHeight +
      "; color: " + style.color + "; text-shadow: " + style.textShadow + "; text-align: " + style.textAlign +
      "; font-variant-numeric: " + style.fontVariantNumeric + "; }\ninput::placeholder { color: " + style.placeholderColor +
      "; }\ninput.invalid { color: " + style.errorColor + "; }"
    : faces;
  reformat();
}

input.addEventListener("input", reformat);
input.addEventListener("focus", report);
input.addEventListener("blur", report);
addEventListener("message", (event) => {
  const message = event.data || {};
  if (message.type === "config") applyConfig(message);
  else if (message.type === "focus") input.focus();
  else if (message.type === "type") {
    input.value = message.text;
    reformat();
  }
});
post({ type: "ready" });
`;

// One document per kind of field. Transparent, unpadded and unbordered:
// IncrediCard's slot draws the box around it.
export function mockHostedFieldDocument(kind: MockHostedFieldKind) {
  const inputMode = "numeric";
  const autocomplete = kind === "cardNumber" ? "cc-number" : kind === "expiration" ? "cc-exp" : "cc-csc";
  return `<!doctype html>
<html data-kind="${kind}">
<head>
<meta charset="utf-8">
<style>
  :root { color-scheme: normal; }
  html, body { margin: 0; padding: 0; background: transparent; overflow: hidden; }
  input {
    display: block; box-sizing: border-box; width: 100%; margin: 0; padding: 0;
    border: 0; outline: none; background: transparent; font: inherit;
  }
</style>
<style id="dynamic"></style>
</head>
<body>
<input inputmode="${inputMode}" autocomplete="${autocomplete}"${kind === "cvc" ? ' type="password"' : ""}>
<script>${SCRIPT}</script>
</body>
</html>`;
}
