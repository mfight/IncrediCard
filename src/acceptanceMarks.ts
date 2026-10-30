import type { CardNetwork } from "./cardNetworks";

/** A network this component can detect. */
export type IncrediCardNetwork = Exclude<CardNetwork, "unknown">;

/** An acceptance-mark image: a URL, or a bundler's static image import.
 * Vite and webpack import an image as a URL string; Next.js imports it as
 * a `{ src, width, height }` object. */
export type IncrediCardAcceptanceMark = string | { src: string };

/** The app's acceptance-mark artwork, per network. A network left out
 * shows its name as text instead. */
export type IncrediCardAcceptanceMarks = Partial<Record<IncrediCardNetwork, IncrediCardAcceptanceMark>>;

/** What a card face shows in its bottom-right corner for a detected
 * network: the app's mark if it supplied one, the network's name if
 * not. */
export type IncrediCardNetworkMark = { src?: string; name: string };

// The package ships no acceptance marks. They are trademarks of their
// networks, and each network sets its own rules for how its mark is
// reproduced, so the artwork is the app's to supply (`acceptanceMarks`
// on IncrediCard), usually from the network's own brand resources. With
// none supplied, the corner still confirms the detected network, as
// plain text. Kept apart from cardNetworks.ts, which knows nothing of any
// artwork.
//
// A static image import's runtime shape depends on the bundler: Next.js
// returns an object, Vite and webpack a URL string, which for a small
// file under Vite's inlining threshold is a `data:` URI. Reading `.src`
// on a string returns `undefined` rather than throwing, so assuming one
// shape would fail silently, with no mark and no error. Both shapes are
// accepted and normalized here.
export function getNetworkMark(
  network: CardNetwork,
  displayName: string,
  marks: IncrediCardAcceptanceMarks | undefined,
): IncrediCardNetworkMark | undefined {
  if (network === "unknown") return undefined;
  const mark = marks?.[network];
  const src = typeof mark === "string" ? mark : mark?.src;
  return { src: src || undefined, name: displayName };
}
