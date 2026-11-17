# Changelog

All notable changes to IncrediCard are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html). While the version starts with 0, a minor version can include breaking changes; any that do are called out here.

## [Unreleased]

### Changed

- The package includes `CHANGELOG.md`, and the README links to it.
- Each release's GitHub release is drafted from its changelog entry.
- The package lists a funding link, shown by `npm fund` and on the package's npm page.

## [0.2.0] - 2026-11-17

### Added

- `side` (`"front"` or `"back"`) chooses the side the card shows from outside. The card turns whenever it changes. Its type, `IncrediCardSide`, is exported. An American Express card stays on its front, since its security code is printed there, and a card that's `processing` finishes its loop, then lands on `side`.
- `onSideChange` reports each time the card turns on its own: from its flip control, or when focus reaches the security code.
- `flippable={false}` removes the card's flip control. The card still turns over when focus reaches the security code.

### Changed

- The site moved to [incredicard.dev](https://incredicard.dev/), with the demo at [incredicard.dev/storybook](https://incredicard.dev/storybook/). The README's links point there.
- Releases are published from GitHub Actions through npm trusted publishing, with a provenance statement linking each version to the commit and workflow run that built it.

## [0.1.1] - 2026-11-11

### Changed

- The README says the package installs from npm. No code changes.

## [0.1.0] - 2026-11-11

The first release.

### Added

- `IncrediCard`, a credit-card entry form with a dimensional card that mirrors real, labeled form fields, in a `floating` layout (fields on the card) and a `stacked` layout (a card above a field list).
- Network detection for Visa, Mastercard, American Express, Discover, Diners Club, JCB, Maestro and UnionPay, with each network's grouping, length and security-code rules, and acceptance marks you supply.
- Four themes, `ribbons`, `vintage`, `globe` and `glass`, plus `extendIncrediCardTheme` for your own.
- `hostedFields`, so a payment processor's own fields can take the card data.
- Optional effects: chip reflection, holographic foil, tilt toward the pointer or the device, and zoom on focus. All of them respect `prefers-reduced-motion`.
- `autoComplete={false}`, `labels` for every string, and styles, fonts and English strings shipped with the component.

[Unreleased]: https://github.com/mfight/IncrediCard/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/mfight/IncrediCard/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/mfight/IncrediCard/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/mfight/IncrediCard/releases/tag/v0.1.0
