# Security Policy

## Reporting a vulnerability

Please report security problems privately, through GitHub's [private vulnerability reporting](https://github.com/mfight/IncrediCard/security/advisories/new) (the **Report a vulnerability** button on the repository's **Security** tab). Don't open a public issue, pull request or discussion about it.

Include what you found, how to reproduce it, and what an attacker could do with it.

**Don't include sensitive data, even in a private report:** no real card numbers, security codes, expiration dates, cardholder names, passwords, API keys or other secrets. Use a test card number your payment processor publishes, or digits that just have the right shape.

IncrediCard is maintained by one person, so replies are best-effort. Please give a fix time to land before disclosing the problem publicly.

## Supported versions

IncrediCard is at 0.x. Only the latest release, and the `main` branch until there is one, gets security fixes.

## Scope

IncrediCard is a card-entry form. It checks the format of what's typed; it doesn't process payments, tokenize card data or submit anything, and it makes no PCI-compliance claim.

In scope, for example:

- the component exposing a typed value somewhere it shouldn't: logging it, storing it, sending it over the network, or showing the security code;
- script injection through any of its props, such as `labels`;
- a vulnerability in something the published package ships.

Out of scope:

- how your own application validates, stores, transmits or charges card data;
- the hosting of the demo site;
- reports that need a compromised browser or device to begin with.
