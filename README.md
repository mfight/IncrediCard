# IncrediCard

A credit-card entry form for React with a dimensional card that mirrors what's typed. The card shows the name, number and expiration date on the front and the security code on the back, and it flips when you ask it to. Underneath, the actual inputs are real, labeled, accessible form fields, so the card is just a picture of them.

**[See the demo](https://incredicard.markfight.com/)**

> **This is not a payment integration.** IncrediCard checks the format of what's typed. It has no payment processor, no tokenization and no submission flow, and it makes no PCI-compliance claim. Pair it with your processor's own validation, the same as any other card form.

## Features

- **Real fields:** name, number, expiration and security code are ordinary inputs with labels, `autocomplete` values and error messages. Typing, pasting and browser autofill all work.
- **Two layouts:** `overlay` puts the fields on the card itself; `stacked` puts a decorative card above a normal field list.
- **Network detection:** Visa, Mastercard, American Express, Discover, Diners Club, JCB, Maestro and UnionPay, with each network's grouping, length and security-code rules, and its acceptance mark.
- **Two themes:** `modern`, and `vintage`, an embossed plastic card set in OCR-A and OCR-B.
- **Optional effects:** chip reflection, a holographic foil, tilt toward the pointer (or the device, where motion access is granted), and zoom on focus.
- **Reduced motion:** every effect respects `prefers-reduced-motion`. The state stays the same; only the movement goes.
- **Self-contained:** the component ships its own styles, fonts and English strings, and depends on nothing but React. Every string can be replaced through `labels`.

## Installing

IncrediCard isn't on npm yet. Once it is:

```sh
npm install incredicard
```

It needs React 19.2 or later.

## Using it

Import the stylesheet once, then render the component. `id` is required; the fields' own ids are built from it.

```tsx
import "incredicard/styles.css";
import { IncrediCard } from "incredicard";

export function PaymentForm() {
  return (
    <IncrediCard
      id="payment-card"
      onChange={(value) => {
        // value.cardNumber, value.expirationMonth, value.expirationYear,
        // value.cardholderName, value.cvc
      }}
      onCompletionChange={(complete) => {
        // true once every field is filled in and passes its format check
      }}
    />
  );
}
```

`onCompletionChange` reports that the form is complete as far as IncrediCard can tell. It doesn't mean the card is real or can be charged; only your payment processor can tell you that.

The [demo's Overview page](https://incredicard.markfight.com/) documents every prop, the layouts and themes, composing your own layout from `IncrediCard.Field` and `IncrediCard.MaskedField`, accessibility, and how the card treats sensitive data.

## Developing

```sh
npm install
npm run storybook        # the demo, at localhost:6006
npm run typecheck
npm run lint
npm test                 # unit tests
npm run test:storybook   # every story in Chromium, with accessibility checks
npm run build            # the package, into dist/
npm run test:consumer    # packs it and installs it into a fresh Vite app
```

The Storybook tests and the consumer test need Playwright's Chromium: `npx playwright install chromium`.

## Acknowledgments

IncrediCard was inspired by [Skeuocard](https://kenkeiter.com/skeuocard/), originally created by Ken Keiter. IncrediCard is an independent, from-scratch React implementation and is not affiliated with or endorsed by the original project.

## License

IncrediCard is licensed under the [Apache License 2.0](LICENSE). Copyright 2026 Mark Fight.

Some bundled material keeps its own terms, listed in [NOTICE](NOTICE):

- **Fonts:** Figtree and OCR-B under the SIL Open Font License 1.1, and OCR-A as its author describes in its readme. The license files are in `src/assets/fonts/`, and in `dist/licenses/` in the published package.
- **Card-network acceptance marks:** trademarks of their respective owners, shown only to identify a card's network. The Apache license grants no rights to them.
- **Ribbon-line artwork** (`src/assets/images/incredicard-front-holo*.svg`): adapted from a licensed stock illustration, and not covered by the Apache license.
