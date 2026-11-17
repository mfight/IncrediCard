// One test card number per network the card recognizes, each the standard
// published test number for its network, so none belongs to a real
// account. Amex has the most structural differences: 4-6-5 number
// grouping, a 4-digit CVC, and that CVC printed on the FRONT of the card
// rather than the back. Its name, the longest, wraps onto two lines.
// Diners Club's 14-digit number groups 4-6-4. The rest share the neutral
// shape, so what they show is detection itself.
import type { CardNetwork } from "../src/cardNetworks";

export type SampleCard = { name: string; network: CardNetwork; cardNumber: string; cvc?: string };

export const SAMPLE_CARDS: readonly SampleCard[] = [
  { name: "American Express", network: "amex", cardNumber: "378282246310005", cvc: "1234" },
  { name: "Diners Club", network: "dinersclub", cardNumber: "30569309025904" },
  { name: "Discover", network: "discover", cardNumber: "6011111111111117" },
  { name: "JCB", network: "jcb", cardNumber: "3530111333300000" },
  { name: "Maestro", network: "maestro", cardNumber: "6700000000000000" },
  { name: "Mastercard", network: "mastercard", cardNumber: "5555555555554444" },
  { name: "UnionPay", network: "unionpay", cardNumber: "6200000000000005" },
  { name: "Visa", network: "visa", cardNumber: "4242424242424242" },
];
