import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { IncrediCardHostedFieldContext, IncrediCardHostedFieldState, IncrediCardNetwork } from "../../src";
import figtree from "../../src/assets/fonts/Figtree-VariableFont_wght.woff2?inline";
import ocrA from "../../src/assets/fonts/OCR-A.woff2?inline";
import ocrB from "../../src/assets/fonts/OCR-B.woff2?inline";
import { mockHostedFieldDocument, type MockHostedFieldKind } from "./mockHostedFieldDocument";

export type { MockHostedFieldKind } from "./mockHostedFieldDocument";

/** What the mock reports, like a processor's change event. */
export type MockHostedFieldReport = IncrediCardHostedFieldState & {
  network?: IncrediCardNetwork | null;
  last4?: string;
};

export const EMPTY_MOCK_REPORT: MockHostedFieldReport = { empty: true, complete: false, focused: false };

export type MockHostedFieldHandle = {
  /** The same two steps a processor's `focus()` takes: focus the frame from
   * outside, which a browser allows, then ask the page inside to focus its
   * input, which it then allows too, since its frame has focus. */
  focus: () => void;
};

// IncrediCard's fonts, which a processor's frame doesn't have: like a real
// processor's `fonts` option, the mock is handed the files. Data URLs here,
// because the frame's opaque origin can't load a font from this page's.
const FONTS = [
  { family: "IncrediCard Figtree", src: figtree, weight: "300 900" },
  { family: "IncrediCard OCR-A", src: ocrA },
  { family: "IncrediCard OCR-B", src: ocrB },
];

type MockHostedFieldProps = {
  kind: MockHostedFieldKind;
  context: IncrediCardHostedFieldContext;
  /** The security code's length, which a processor's own fields work out
   * between themselves. */
  cvcLength?: number;
  onChange: (report: MockHostedFieldReport) => void;
};

// A stand-in for a payment processor's hosted field, for the stories: what a
// consumer's wrapper around Stripe Elements or Braintree's Hosted Fields
// would look like, with the processor swapped for a sandboxed frame (see
// mockHostedFieldDocument.ts). It passes IncrediCard's `context` in as the
// processor's configuration, and reports the frame's state back out.
export const MockHostedField = forwardRef<MockHostedFieldHandle, MockHostedFieldProps>(function MockHostedField(
  { kind, context, cvcLength, onChange },
  ref,
) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  // Built once: a new `srcDoc` would reload the frame and lose what's typed.
  const frameDocument = useMemo(() => mockHostedFieldDocument(kind), [kind]);

  useImperativeHandle(ref, () => ({
    focus() {
      const frame = frameRef.current;
      if (!frame) return;
      frame.focus();
      frame.contentWindow?.postMessage({ type: "focus" }, "*");
    },
  }), []);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      // The frame's origin is opaque ("null"), so it's told apart by window.
      if (event.source !== frameRef.current?.contentWindow) return;
      const message = event.data;
      if (message?.type === "ready") setReady(true);
      else if (message?.type === "state") onChangeRef.current(message.report);
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const { style, placeholder, label, disabled } = context;
  useEffect(() => {
    if (!ready) return;
    frameRef.current?.contentWindow?.postMessage(
      { type: "config", style, placeholder, label, disabled, cvcLength, fonts: FONTS },
      "*",
    );
  }, [ready, style, placeholder, label, disabled, cvcLength]);

  return (
    <iframe
      ref={frameRef}
      title={label}
      sandbox="allow-scripts"
      srcDoc={frameDocument}
      data-mock-hosted-field={kind}
      style={{ height: style?.lineHeight ?? "1.25rem" }}
    />
  );
});
