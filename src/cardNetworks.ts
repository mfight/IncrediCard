// Deliberately minimal, safe IIN-prefix detection for eight networks:
// Visa, Mastercard, Amex, Discover, Diners Club, JCB, Maestro and
// UnionPay. Only prefix ranges settled enough to never misfire against a
// different network are covered; anything else, including every edge
// case a full BIN/IIN database would resolve, stays "unknown" rather than
// guessing (detection must remain conservative). No brand marks, logos
// or brand colors come from this module; network artwork lives
// separately, in acceptanceMarks.ts. This module only provides the plain
// network name plus the mechanical facts detection safely implies: how
// the number groups visually, how long its CVC is, and how long the
// number itself is.
export type CardNetwork =
  | "visa"
  | "mastercard"
  | "amex"
  | "discover"
  | "dinersclub"
  | "jcb"
  | "maestro"
  | "unionpay"
  | "unknown";

export type CardNetworkInfo = {
  network: CardNetwork;
  /** IncrediCardMaskedField-compatible template; see maskEngine.ts.
   * Amex's 4-6-5 grouping is a genuine exception to every other
   * supported network's 4-4-4-4 grouping, not a simplification: an Amex
   * number formatted 4-4-4-3 would misgroup it. */
  numberPattern: string;
  /** How many digits `numberPattern` holds (its 'X' count): 15 for Amex,
   * 16 for every other supported network. */
  numberLength: number;
  /** Amex's CVC ("CID") is printed on the *front* of the card and is 4
   * digits; every other network here prints a 3-digit CVC on the back. */
  cvcLength: number;
  /** Plain text only, no brand mark; see this file's header comment. */
  displayName: string;
};

const NEUTRAL_NUMBER_PATTERN = "XXXX XXXX XXXX XXXX";
const AMEX_NUMBER_PATTERN = "XXXX XXXXXX XXXXX";

const NETWORK_INFO: Record<CardNetwork, CardNetworkInfo> = {
  visa: { network: "visa", numberPattern: NEUTRAL_NUMBER_PATTERN, numberLength: 16, cvcLength: 3, displayName: "Visa" },
  mastercard: {
    network: "mastercard",
    numberPattern: NEUTRAL_NUMBER_PATTERN,
    numberLength: 16,
    cvcLength: 3,
    displayName: "Mastercard",
  },
  amex: {
    network: "amex",
    numberPattern: AMEX_NUMBER_PATTERN,
    numberLength: 15,
    cvcLength: 4,
    displayName: "American Express",
  },
  discover: {
    network: "discover",
    numberPattern: NEUTRAL_NUMBER_PATTERN,
    numberLength: 16,
    cvcLength: 3,
    displayName: "Discover",
  },
  dinersclub: {
    network: "dinersclub",
    numberPattern: NEUTRAL_NUMBER_PATTERN,
    numberLength: 16,
    cvcLength: 3,
    displayName: "Diners Club",
  },
  jcb: { network: "jcb", numberPattern: NEUTRAL_NUMBER_PATTERN, numberLength: 16, cvcLength: 3, displayName: "JCB" },
  // Real Maestro and UnionPay cards can run 12-19 digits, not a fixed 16.
  // Treating them as 16 is the same deliberate "generic 16"
  // simplification the "unknown" fallback (and every supported network
  // except Amex) makes.
  maestro: {
    network: "maestro",
    numberPattern: NEUTRAL_NUMBER_PATTERN,
    numberLength: 16,
    cvcLength: 3,
    displayName: "Maestro",
  },
  unionpay: {
    network: "unionpay",
    numberPattern: NEUTRAL_NUMBER_PATTERN,
    numberLength: 16,
    cvcLength: 3,
    displayName: "UnionPay",
  },
  unknown: {
    network: "unknown",
    numberPattern: NEUTRAL_NUMBER_PATTERN,
    numberLength: 16,
    cvcLength: 3,
    displayName: "",
  },
};

// Tested against `digits` as typed so far, not a complete number: each
// range below is only checked against as many leading digits as exist (a
// 2-digit prefix check never needs a 4th digit), so this returns a
// confident answer as soon as the user has typed enough of a prefix to
// safely tell, and "unknown" otherwise, never a guess. Ranges are the
// settled, standard IIN prefixes for each network (Visa: 4; Mastercard:
// 51-55 and 2221-2720; Amex: 34/37; Discover: 6011, 65, 644-649; Diners
// Club: 300-305/36/38; JCB: 3528-3589; Maestro: 50/56-58, 6304, 6390, 67;
// UnionPay: 62), deliberately not the full ISO/IEC 7812 table. An
// exhaustive BIN database is out of scope; this module makes no
// guarantee that every regional or private-label card network is
// supported.
//
// Maestro's real-world BIN ranges are notoriously broader and less
// consistent than any other network here (issuer-specific overlap is
// common). 50/56-58, 6304, 6390, and 67 are the commonly cited,
// conservative subset that several independent card-detection libraries
// converge on, chosen because none of them collide with another range
// checked below (50/56-58 sit outside Mastercard's 51-55; 6304/6390/67
// don't overlap Discover's 6011/65/644-649). That's not every prefix a
// real Maestro card can start with, consistent with this file's "stay
// neutral rather than guess" rule for anything less settled.
export function detectCardNetwork(digits: string): CardNetwork {
  if (digits.length === 0) return "unknown";
  if (digits.startsWith("4")) return "visa";
  if (/^3[47]/.test(digits)) return "amex";
  if (/^6011/.test(digits) || /^65/.test(digits) || /^64[4-9]/.test(digits)) return "discover";
  if (/^3(?:0[0-5]|[68])/.test(digits)) return "dinersclub";
  if (/^35(?:2[89]|[3-8][0-9])/.test(digits)) return "jcb";
  if (/^62/.test(digits)) return "unionpay";
  if (/^5[0678]/.test(digits) || /^6304/.test(digits) || /^6390/.test(digits) || /^67/.test(digits)) return "maestro";
  const twoDigit = Number(digits.slice(0, 2));
  if (!Number.isNaN(twoDigit) && twoDigit >= 51 && twoDigit <= 55) return "mastercard";
  const fourDigit = Number(digits.slice(0, 4));
  if (digits.length >= 4 && !Number.isNaN(fourDigit) && fourDigit >= 2221 && fourDigit <= 2720) return "mastercard";
  return "unknown";
}

export function getCardNetworkInfo(network: CardNetwork): CardNetworkInfo {
  return NETWORK_INFO[network];
}

// Standard mod-10 checksum. Operates on already digit-filtered input
// (IncrediCardMaskedField's committed value), never on an in-progress
// draft with punctuation still in it.
export function luhnCheck(digits: string): boolean {
  if (digits.length === 0) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let digit = Number(digits[i]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}
