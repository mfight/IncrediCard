# IncrediCard

A credit-card entry form for React with a dimensional card that mirrors what's typed. The card shows the name, number and expiration date on the front and the security code on the back, and it flips when you ask it to. Underneath, the actual inputs are real, labeled, accessible form fields, so the card is just a picture of them.

**[See the demo](https://incredicard.markfight.com/)**

> **This is not a payment integration.** IncrediCard checks the format of what's typed. It has no payment processor, no tokenization and no submission flow, and it makes no PCI-compliance claim. Pair it with your processor's own validation, the same as any other card form, or let your processor's hosted fields take the card data (see Hosted fields).

## Features

- **Real fields:** name, number, expiration and security code are ordinary inputs with labels, `autocomplete` values and error messages. Typing, pasting and browser autofill all work, and `autoComplete={false}` asks the browser not to offer a saved card.
- **Two layouts:** `floating` puts the fields on the card itself; `stacked` puts a decorative card above a normal field list.
- **Network detection:** Visa, Mastercard, American Express, Discover, Diners Club, JCB, Maestro and UnionPay, with each network's grouping, length and security-code rules. The card shows the detected network with the acceptance mark you supply, or its name.
- **Four themes:** `ribbons`, a dark card printed with fine twisting lines; `vintage`, an embossed plastic card set in OCR-A and OCR-B; `globe`, the same dark card printed with an engraved globe; and `glass`, mostly clear glass that shows the page behind it, with light or dark text for that page (`textTone`), and bends it at the edge in Chromium browsers, or in any browser if you tell it what's behind the card (`glassBackdrop`). Or pass your own definition, starting from one of these with `extendIncrediCardTheme`.
- **Hosted fields:** your payment processor's own fields can take the number, expiration and security code (`hostedFields`), so the card data never touches your page, with the card, flip and Tab order working around them.
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

### Acceptance marks

IncrediCard ships no card-network acceptance marks: they're trademarks of their networks, and each network publishes its own artwork and rules for using it. Get the marks from each network's brand resources and pass them in, as URLs or static image imports:

```tsx
import visaMark from "./marks/visa.svg";
import mastercardMark from "./marks/mastercard.svg";

<IncrediCard id="payment-card" acceptanceMarks={{ visa: visaMark, mastercard: mastercardMark }} />;
```

A detected network with no mark shows its name as text in the same corner. The marks in the demo are recreations drawn for it, kept in this repository's `demo/acceptance-marks/` and not in the package; copying them into your app is your choice, and the trademarks remain their networks'.

### Hosted fields

To keep card data off your page, pass your payment processor's hosted fields as `hostedFields`, for the number, expiration and security code together. IncrediCard depends on no processor: you render each field into the slot it gives you, report the field's state, and pass in the text styles it hands you, since your CSS can't reach inside the processor's frame. The Overview's "A Payment Processor's Hosted Fields" section covers the whole shape. In terms of two processors' documented events:

| IncrediCard | Stripe Elements (`cardNumber`, `cardExpiry`, `cardCvc`) | Braintree Hosted Fields |
| --- | --- | --- |
| `empty` | `empty` on the `change` event | the field's `isEmpty` |
| `complete` | `complete` on the `change` event | the field's `isValid` |
| `error` | `error?.message` on the `change` event | none; IncrediCard uses its own from `labels` |
| `focused` | the `focus` and `blur` events | the field's `isFocused` |
| `focus()` | `element.focus()` | `hostedFieldsInstance.focus("number")`, and so on |
| `network` | `brand` on the number's `change` event, with `"diners"` as `"dinersclub"` and `"unknown"` as `null` | the `cardTypeChange` event's only card's `type`, with `"master-card"` as `"mastercard"`, `"american-express"` as `"amex"` and `"diners-club"` as `"dinersclub"` |
| `style` from `render` | the element's `style.base` (and `invalid.color`), through `element.update()` | `styles`, when creating the fields |

Check each processor's own documentation before relying on these. The demo's `MockHostedField` (in `demo/hostedFields/`, not in the package) is a working wrapper around a mock processor.

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

## Contributing

Bug reports and ideas are welcome as issues; pull requests aren't being accepted yet. See [CONTRIBUTING.md](CONTRIBUTING.md), and the [Code of Conduct](CODE_OF_CONDUCT.md). To report a security problem privately, see [SECURITY.md](SECURITY.md).

## Acknowledgments

IncrediCard was inspired by [Skeuocard](https://kenkeiter.com/skeuocard/), originally created by Ken Keiter. IncrediCard is an independent, from-scratch React implementation and is not affiliated with or endorsed by the original project.

## License

IncrediCard is licensed under the [Apache License 2.0](LICENSE). Copyright 2026 Mark Fight.

Some bundled material keeps its own terms, listed in [NOTICE](NOTICE):

- **Fonts:** Figtree and OCR-B under the SIL Open Font License 1.1, and OCR-A as its author describes in its readme. The license files are in `src/assets/fonts/`, and in `dist/licenses/` in the published package.
- **The demo's card-network acceptance marks** (`demo/acceptance-marks/`, in this repository only, not in the package): recreations of trademarks of their respective owners, shown only to identify a card's network. The Apache license grants no rights to them.
