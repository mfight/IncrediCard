# Contributing to IncrediCard

Thanks for your interest. Bug reports and ideas are welcome as [issues](https://github.com/mfight/IncrediCard/issues). **Pull requests aren't being accepted yet**, so please open an issue instead of sending code. That will change once the project settles.

To report a security problem, don't open an issue: follow [SECURITY.md](SECURITY.md).

Everyone taking part is expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Never post real card data

Don't include a real card number, security code, expiration date or cardholder name anywhere: not in an issue, a comment, a screenshot or a recording. Use a test number your payment processor publishes, or digits that just have the right shape. IncrediCard only checks the format of what's typed, so a fake number reproduces any bug a real one would.

## Reporting a bug

Check the [demo](https://incredicard.markfight.com/) and the existing issues first. Then open a bug report with:

- the steps that cause it, starting from a story in the demo if you can;
- what you expected, and what happened instead;
- your browser and its version, your operating system, and the device if it's a phone or tablet;
- the props involved (`layout`, `theme`, the effects you turned on);
- whether reduced motion, a screen reader, browser autofill or a zoomed page is part of it;
- a screenshot or recording, if the problem is visual.

## Suggesting a feature

Describe the problem you're trying to solve before the change you have in mind. Some things are out of scope on purpose: IncrediCard is a card-entry form, not a payment integration, so payment processing, tokenization and submitting the form belong to your own code.

## Running it locally

To reproduce or investigate a bug yourself, see [Developing](README.md#developing) in the README. You'll need Node 20.19 or later, and Playwright's Chromium for the Storybook and consumer tests.

## What the project holds to

Reports that one of these has slipped are especially welcome.

- **Real, accessible fields.** The inputs are ordinary labeled form fields, usable by keyboard, screen readers, paste and browser autofill. The card's decoration is hidden from assistive technology. Every story runs accessibility checks in `npm run test:storybook`.
- **Reduced motion.** Under `prefers-reduced-motion`, every effect keeps its state and loses only its movement, or is replaced by a calmer signal. It never silently stops working.
- **Payment data stays in the form.** The component never logs, stores or sends what's typed, and never shows the security code: its field is masked, and the card shows only dots for it. It makes no network requests.
- **Self-contained.** Nothing but React is required: the styles, fonts and English strings ship with it.
- **American English** in code, comments, docs and strings, checked by `npm run check:american-english`.
