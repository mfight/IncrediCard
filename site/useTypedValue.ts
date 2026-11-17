// A card value that types itself out, field by field, then starts over:
// the number first (the card picks out the network and the other fields
// appear once it's valid), then the expiration, then the name, then the card
// turns over for the security code and back again. Runs only while
// `running`; otherwise it holds the finished value face-up, which is also
// all a reduced-motion visitor sees. An American Express card prints its
// code on the front, so it stays face-up throughout.

import { useCallback, useEffect, useRef, useState } from "react";
import type { IncrediCardSide, IncrediCardValue } from "../src";
import { detectCardNetwork } from "../src/cardNetworks";

export const SAMPLE_VALUE: IncrediCardValue = {
  cardholderName: "Alex Morgan",
  cardNumber: "4242424242424242",
  expirationMonth: "08",
  expirationYear: "29",
  cvc: "123",
};

const EMPTY: IncrediCardValue = {
  cardholderName: "",
  cardNumber: "",
  expirationMonth: "",
  expirationYear: "",
  cvc: "",
};

type Typed = { value: IncrediCardValue; side: IncrediCardSide };
type Step = Typed & { delay: number };

// `once` leaves off the closing turn and its long hold: the caller ends on
// the front by itself.
function script(final: IncrediCardValue, once = false): Step[] {
  const steps: Step[] = [{ value: EMPTY, side: "front", delay: once ? 300 : 900 }];
  let value = EMPTY;
  let side: IncrediCardSide = "front";
  const type = (field: keyof IncrediCardValue, text: string, pace: number) => {
    for (const char of text) {
      value = { ...value, [field]: value[field] + char };
      steps.push({ value, side, delay: pace });
    }
  };
  const turn = (to: IncrediCardSide, delay: number) => {
    side = to;
    steps.push({ value, side, delay });
  };
  type("cardNumber", final.cardNumber, 90);
  steps[steps.length - 1].delay = 600;
  type("expirationMonth", final.expirationMonth, 140);
  type("expirationYear", final.expirationYear, 140);
  steps[steps.length - 1].delay = 500;
  type("cardholderName", final.cardholderName, 85);
  steps[steps.length - 1].delay = 900;
  // The flip takes a moment; the code starts once the back is showing.
  const codeOnBack = detectCardNetwork(final.cardNumber) !== "amex";
  if (codeOnBack) turn("back", 700);
  type("cvc", final.cvc, 160);
  steps[steps.length - 1].delay = 1600;
  if (!once) turn("front", 3000);
  return steps;
}

export function useTypedValue(final: IncrediCardValue, running: boolean, startDelay = 0): Typed {
  const [typed, setTyped] = useState<Typed>({ value: final, side: "front" });

  useEffect(() => {
    if (!running) return;
    const steps = script(final);
    let index = 0;
    let timer = window.setTimeout(function next() {
      const step = steps[index];
      setTyped({ value: step.value, side: step.side });
      index = (index + 1) % steps.length;
      timer = window.setTimeout(next, step.delay);
    }, startDelay);
    return () => window.clearTimeout(timer);
  }, [final, running, startDelay]);

  return running ? typed : { value: final, side: "front" };
}

// The same script, once through, started by a visitor's choice instead of
// by coming on screen. `typed` is null while it isn't running, so the
// caller shows its own value and side; `finish` stops it where it is.
export function useTypeOut() {
  const [typed, setTyped] = useState<Typed | null>(null);
  const timerRef = useRef(0);

  const finish = useCallback(() => {
    window.clearTimeout(timerRef.current);
    setTyped(null);
  }, []);

  const start = useCallback((final: IncrediCardValue) => {
    window.clearTimeout(timerRef.current);
    const steps = script(final, true);
    let index = 0;
    const next = () => {
      const step = steps[index++];
      if (!step) {
        setTyped(null);
        return;
      }
      setTyped({ value: step.value, side: step.side });
      timerRef.current = window.setTimeout(next, step.delay);
    };
    next();
  }, []);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  return { typed, start, finish };
}
