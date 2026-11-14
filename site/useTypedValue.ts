// A card value that types itself out, field by field, then starts over:
// the number first (the card picks out the network and the other fields
// appear once it's valid), then the expiration, then the name. Runs only
// while `running`; otherwise it holds the finished value, which is also all
// a reduced-motion visitor sees.

import { useEffect, useState } from "react";
import type { IncrediCardValue } from "../src";

export const SAMPLE_VALUE: IncrediCardValue = {
  cardholderName: "Alex Morgan",
  cardNumber: "4242424242424242",
  expirationMonth: "08",
  expirationYear: "29",
  cvc: "",
};

const EMPTY: IncrediCardValue = {
  cardholderName: "",
  cardNumber: "",
  expirationMonth: "",
  expirationYear: "",
  cvc: "",
};

type Step = { value: IncrediCardValue; delay: number };

function script(final: IncrediCardValue): Step[] {
  const steps: Step[] = [{ value: EMPTY, delay: 900 }];
  let value = EMPTY;
  const type = (field: keyof IncrediCardValue, text: string, pace: number) => {
    for (const char of text) {
      value = { ...value, [field]: value[field] + char };
      steps.push({ value, delay: pace });
    }
  };
  type("cardNumber", final.cardNumber, 90);
  steps[steps.length - 1].delay = 600;
  type("expirationMonth", final.expirationMonth, 140);
  type("expirationYear", final.expirationYear, 140);
  steps[steps.length - 1].delay = 500;
  type("cardholderName", final.cardholderName, 85);
  steps[steps.length - 1].delay = 3200;
  return steps;
}

export function useTypedValue(final: IncrediCardValue, running: boolean, startDelay = 0) {
  const [value, setValue] = useState(final);

  useEffect(() => {
    if (!running) return;
    const steps = script(final);
    let index = 0;
    let timer = window.setTimeout(function next() {
      const step = steps[index];
      setValue(step.value);
      index = (index + 1) % steps.length;
      timer = window.setTimeout(next, step.delay);
    }, startDelay);
    return () => window.clearTimeout(timer);
  }, [final, running, startDelay]);

  return running ? value : final;
}
