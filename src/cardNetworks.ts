// Deliberately minimal, safe IIN-prefix detection for eight networks:
// Visa, Mastercard, Amex, Discover, Diners Club, JCB, Maestro and
// UnionPay. Only prefix ranges settled enough to never misfire against a
// different network are covered; anything else, including every edge
// case a full BIN/IIN database would resolve, stays "unknown" rather than
// guessing (detection must remain conservative). No brand marks, logos
// or brand colors come from this module; the app supplies any marks
// (see acceptanceMarks.ts). This module only provides the plain
// network name plus the mechanical facts detection safely implies: which
// lengths the number can have, how it groups at each, and how long its
// CVC is.
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
  /** Every length a number on this network is issued at, shortest
   * first. A number is complete at any of them (if it also passes
   * `luhnCheck`), so a network issuing 16- and 19-digit cards accepts
   * either. These are the lengths the networks publish, not a promise
   * that every issuer uses all of them. */
  numberLengths: readonly number[];
  /** Digit groups for the lengths that don't group in fours. Amex's
   * 4-6-5 and 14-digit Diners Club's 4-6-4 are how those cards are
   * printed; formatting either in fours would misgroup it. */
  numberGroups?: Readonly<Record<number, readonly number[]>>;
  /** Amex's CVC ("CID") is printed on the *front* of the card and is 4
   * digits; every other network here prints a 3-digit CVC on the back. */
  cvcLength: number;
  /** Plain text only, no brand mark; see this file's header comment.
   * The card shows it where the app supplied no mark for the network. */
  displayName: string;
};

// The longest number any network here issues.
export const MAX_CARD_NUMBER_LENGTH = 19;

const NETWORK_INFO: Record<CardNetwork, CardNetworkInfo> = {
  // Visa also had 13-digit cards, long since retired.
  visa: { network: "visa", numberLengths: [16, 19], cvcLength: 3, displayName: "Visa" },
  mastercard: { network: "mastercard", numberLengths: [16], cvcLength: 3, displayName: "Mastercard" },
  amex: {
    network: "amex",
    numberLengths: [15],
    numberGroups: { 15: [4, 6, 5] },
    cvcLength: 4,
    displayName: "American Express",
  },
  discover: { network: "discover", numberLengths: [16, 17, 18, 19], cvcLength: 3, displayName: "Discover" },
  dinersclub: {
    network: "dinersclub",
    numberLengths: [14, 16, 19],
    numberGroups: { 14: [4, 6, 4] },
    cvcLength: 3,
    displayName: "Diners Club",
  },
  jcb: { network: "jcb", numberLengths: [16, 17, 18, 19], cvcLength: 3, displayName: "JCB" },
  maestro: {
    network: "maestro",
    numberLengths: [12, 13, 14, 15, 16, 17, 18, 19],
    cvcLength: 3,
    displayName: "Maestro",
  },
  unionpay: {
    network: "unionpay",
    numberLengths: [14, 15, 16, 17, 18, 19],
    cvcLength: 3,
    displayName: "UnionPay",
  },
  // Nothing detected yet, or a prefix this module doesn't recognize: a
  // generic 16. That's an imperfect assumption for a real but undetected
  // network, and a reasonable one for format feedback, which is all this
  // component claims to provide.
  unknown: { network: "unknown", numberLengths: [16], cvcLength: 3, displayName: "" },
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

/** How many digits a number on this network can hold. Nothing is
 * detected until a few digits are in, so "unknown" holds the most any
 * network does: a pasted 19-digit number keeps every digit until its
 * prefix identifies it. */
export function cardNumberCapacity(info: CardNetworkInfo): number {
  return info.network === "unknown"
    ? MAX_CARD_NUMBER_LENGTH
    : info.numberLengths[info.numberLengths.length - 1];
}

/** The length a number with `digitCount` digits so far is heading for:
 * the shortest of the network's lengths it hasn't passed. Past every one
 * of them, the digits typed, up to the network's capacity. */
export function cardNumberTargetLength(info: CardNetworkInfo, digitCount: number): number {
  return (
    info.numberLengths.find((length) => length >= digitCount) ??
    Math.min(digitCount, cardNumberCapacity(info))
  );
}

/** Whether `digits` is a complete, well-formed number on this network:
 * one of its lengths, and passing the checksum. Format only. */
export function isCardNumberComplete(info: CardNetworkInfo, digits: string): boolean {
  return info.numberLengths.includes(digits.length) && luhnCheck(digits);
}

/**
 * The IncrediCardMaskedField template for a number with `digitCount`
 * digits so far (see maskEngine.ts). It groups for the length the number
 * is heading for, so a 16-digit Visa reads "4242 4242 4242 4242" and
 * regroups only once a 17th digit makes it a 19-digit one. Ungrouped
 * placeholders pad it out to the network's capacity, so the field still
 * takes the next digit, and a complete number has no trailing space.
 */
export function cardNumberPattern(info: CardNetworkInfo, digitCount: number): string {
  const target = cardNumberTargetLength(info, digitCount);
  const groups = info.numberGroups?.[target] ?? groupsOfFour(target);
  const grouped = groups.map((size) => "X".repeat(size)).join(" ");
  return grouped + "X".repeat(Math.max(0, cardNumberCapacity(info) - target));
}

function groupsOfFour(length: number): number[] {
  const groups: number[] = [];
  for (let left = length; left > 0; left -= 4) groups.push(Math.min(4, left));
  return groups;
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
