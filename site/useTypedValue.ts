// A card value that types itself out, field by field, then starts over:
// the number first (the card picks out the network and the other fields
// appear once it's valid), then the expiration, then the name, then the card
// turns over for the security code and back again. Runs only while
// `running`; otherwise it holds the finished value face-up, which is also
// all a reduced-motion visitor sees.

import { useEffect, useState } from "react";
import type { IncrediCardSide, IncrediCardValue } from "../src";

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

function script(final: IncrediCardValue): Step[] {
  const steps: Step[] = [{ value: EMPTY, side: "front", delay: 900 }];
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
  turn("back", 700);
  type("cvc", final.cvc, 160);
  steps[steps.length - 1].delay = 1600;
  turn("front", 3000);
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
