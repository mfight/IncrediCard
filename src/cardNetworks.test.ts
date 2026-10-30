import { describe, expect, it } from "vitest";
import {
  MAX_CARD_NUMBER_LENGTH,
  cardNumberCapacity,
  cardNumberPattern,
  detectCardNetwork,
  getCardNetworkInfo,
  isCardNumberComplete,
  luhnCheck,
  type CardNetwork,
} from "./cardNetworks";
import { applyMask } from "./maskEngine";

const NETWORKS: CardNetwork[] = [
  "visa",
  "mastercard",
  "amex",
  "discover",
  "dinersclub",
  "jcb",
  "maestro",
  "unionpay",
  "unknown",
];

// A number of `length` digits starting with `prefix`, zero-filled, with
// the check digit that makes it pass `luhnCheck`.
function cardNumber(prefix: string, length: number): string {
  const body = prefix.padEnd(length - 1, "0");
  const check = [..."0123456789"].find((d) => luhnCheck(body + d))!;
  return body + check;
}

// `digits` in groups of four, the way most of these networks print.
function fours(digits: string): string {
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}

function format(digits: string): string {
  const info = getCardNetworkInfo(detectCardNetwork(digits));
  return applyMask(digits, cardNumberPattern(info, digits.length));
}

describe("detectCardNetwork", () => {
  it.each([
    ["4", "visa"],
    ["34", "amex"],
    ["37", "amex"],
    ["51", "mastercard"],
    ["55", "mastercard"],
    ["2221", "mastercard"],
    ["2720", "mastercard"],
    ["6011", "discover"],
    ["644", "discover"],
    ["649", "discover"],
    ["65", "discover"],
    ["300", "dinersclub"],
    ["305", "dinersclub"],
    ["36", "dinersclub"],
    ["38", "dinersclub"],
    ["3528", "jcb"],
    ["3589", "jcb"],
    ["50", "maestro"],
    ["56", "maestro"],
    ["58", "maestro"],
    ["6304", "maestro"],
    ["6390", "maestro"],
    ["67", "maestro"],
    ["62", "unionpay"],
  ])("reads %s as %s", (prefix, network) => {
    expect(detectCardNetwork(prefix)).toBe(network);
  });

  it.each(["", "3", "30", "306", "35", "3527", "3590", "2", "22", "2220", "2721", "6", "601", "643", "59", "1", "9"])(
    "stays neutral on %j",
    (prefix) => {
      expect(detectCardNetwork(prefix)).toBe("unknown");
    },
  );

  // What keeps detection conservative while a number is typed, pasted or
  // deleted: it reads only the prefix, so once a prefix names a network,
  // no further digit can change its mind, and deleting back to a shorter
  // prefix gives that prefix's answer again. Checked for every prefix up
  // to six digits, which is past the longest range this module reads.
  it("never changes its answer as digits are added", () => {
    let prefixes = [""];
    for (let length = 1; length <= 6; length += 1) {
      const next: string[] = [];
      for (const prefix of prefixes) {
        const network = detectCardNetwork(prefix);
        for (const digit of "0123456789") {
          const extended = prefix + digit;
          if (network !== "unknown") expect(detectCardNetwork(extended)).toBe(network);
          next.push(extended);
        }
      }
      prefixes = next;
    }
  });
});

describe("luhnCheck", () => {
  it.each(["4242424242424242", "378282246310005", "5555555555554444", "30569309025904", "6011111111111117"])(
    "accepts %s",
    (digits) => {
      expect(luhnCheck(digits)).toBe(true);
    },
  );

  it("rejects any single changed digit, and an empty string", () => {
    expect(luhnCheck("4242424242424241")).toBe(false);
    expect(luhnCheck("4242424242424252")).toBe(false);
    expect(luhnCheck("")).toBe(false);
  });
});

describe("number lengths", () => {
  it.each([
    ["visa", "4", [16, 19]],
    ["mastercard", "51", [16]],
    ["amex", "37", [15]],
    ["discover", "6011", [16, 17, 18, 19]],
    ["dinersclub", "36", [14, 16, 19]],
    ["jcb", "3528", [16, 17, 18, 19]],
    ["maestro", "67", [12, 13, 14, 15, 16, 17, 18, 19]],
    ["unionpay", "62", [14, 15, 16, 17, 18, 19]],
  ] as const)("%s is complete at %j digits, and at no other length", (network, prefix, lengths) => {
    const info = getCardNetworkInfo(network);
    for (let length = 10; length <= MAX_CARD_NUMBER_LENGTH; length += 1) {
      const digits = cardNumber(prefix, length);
      expect(detectCardNetwork(digits)).toBe(network);
      expect(isCardNumberComplete(info, digits)).toBe((lengths as readonly number[]).includes(length));
    }
  });

  it("needs the checksum at every length", () => {
    const info = getCardNetworkInfo("visa");
    expect(isCardNumberComplete(info, "4242424242424241")).toBe(false);
    const nineteen = cardNumber("4", 19);
    const broken = nineteen.slice(0, -1) + String((Number(nineteen.at(-1)) + 1) % 10);
    expect(isCardNumberComplete(info, broken)).toBe(false);
  });

  it("keeps a generic 16 when nothing is detected", () => {
    const info = getCardNetworkInfo("unknown");
    expect(isCardNumberComplete(info, cardNumber("9", 16))).toBe(true);
    expect(isCardNumberComplete(info, cardNumber("9", 19))).toBe(false);
  });
});

describe("cardNumberPattern", () => {
  it.each(NETWORKS)("%s: always holds exactly its capacity, at every length", (network) => {
    const info = getCardNetworkInfo(network);
    for (let count = 0; count <= MAX_CARD_NUMBER_LENGTH; count += 1) {
      const pattern = cardNumberPattern(info, count);
      expect(pattern.replace(/[^X]/g, "")).toHaveLength(cardNumberCapacity(info));
    }
  });

  it("holds 19 digits before anything is detected, so a pasted number keeps every one", () => {
    expect(cardNumberCapacity(getCardNetworkInfo("unknown"))).toBe(19);
    expect(cardNumberCapacity(getCardNetworkInfo("mastercard"))).toBe(16);
    expect(cardNumberCapacity(getCardNetworkInfo("amex"))).toBe(15);
  });

  it.each([
    ["4242424242424242", "4242 4242 4242 4242"],
    ["42424242424242421", "4242 4242 4242 4242 1"],
    [cardNumber("4", 19), fours(cardNumber("4", 19))],
    ["378282246310005", "3782 822463 10005"],
    ["30569309025904", "3056 930902 5904"],
    [cardNumber("36", 16), fours(cardNumber("36", 16))],
    [cardNumber("67", 12), fours(cardNumber("67", 12))],
    ["4242", "4242 "],
  ])("groups %s as %j", (digits, grouped) => {
    expect(format(digits)).toBe(grouped);
  });
});
