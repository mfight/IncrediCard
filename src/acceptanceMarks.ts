import type { CardNetwork } from "./cardNetworks";
import amex from "./assets/images/acceptance-amex.svg";
import dinersclub from "./assets/images/acceptance-diners-club.svg";
import discover from "./assets/images/acceptance-discover.svg";
import jcb from "./assets/images/acceptance-jcb.svg";
import maestro from "./assets/images/acceptance-maestro.svg";
import mastercard from "./assets/images/acceptance-mastercard.svg";
import unionpay from "./assets/images/acceptance-union-pay.svg";
import visa from "./assets/images/acceptance-visa.svg";

// A static image import's runtime shape depends on the bundler. Next.js
// returns a `{ src, width, height }` object (`StaticImageData`); Vite
// returns a URL string, and for files under its default 4KB inlining
// threshold that string is an inline `data:` URI. These eight marks
// straddle that line (3.4KB-19.4KB on disk; Visa, Discover and JCB fall
// under it), so a single bundler can produce different shapes for
// different entries of the same map, depending on nothing but file size.
// Reading `.src` on a string returns `undefined` rather than throwing, so
// assuming one shape fails silently: the `acceptanceMarkSrc ?` check in
// each face component sees a falsy value and skips rendering the mark,
// with no error anywhere. This helper normalizes both shapes per asset,
// so the map works with any bundler, and keeps working if a replacement
// asset crosses the 4KB line in either direction.
function resolveAssetSrc(asset: string | { src: string }): string {
  return typeof asset === "string" ? asset : asset.src;
}

// Per-network acceptance marks, shipped in assets/images/. Kept separate
// from cardNetworks.ts on purpose (see that file's header comment: no
// brand marks or logos come from that module). This is the artwork for
// the card face's bottom-right acceptance mark (see `.acceptanceMark` in
// IncrediCardFace.module.scss and IncrediCardEmbeddedFace.module.scss),
// always rendered once a network is detected. Every key here is a real
// network with an asset; "unknown" is deliberately absent, so a lookup
// miss (nothing detected yet) is `undefined` without a separate
// placeholder asset.
const ACCEPTANCE_MARKS: Partial<Record<CardNetwork, string>> = {
  amex: resolveAssetSrc(amex),
  dinersclub: resolveAssetSrc(dinersclub),
  discover: resolveAssetSrc(discover),
  jcb: resolveAssetSrc(jcb),
  maestro: resolveAssetSrc(maestro),
  mastercard: resolveAssetSrc(mastercard),
  unionpay: resolveAssetSrc(unionpay),
  visa: resolveAssetSrc(visa),
};

export function getAcceptanceMarkSrc(
  network: CardNetwork,
): string | undefined {
  return ACCEPTANCE_MARKS[network];
}
