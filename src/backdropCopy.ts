/** The image URLs a CSS `background` value would load, so the card can wait
 * for them before showing its copy. */
export function backgroundImageUrls(background: string): string[] {
  return [...background.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/g)].map(
    (match) => match[1] ?? match[2] ?? match[3],
  );
}
