// The JS half of the reduced-motion condition, kept in step with the CSS
// half in reduced-motion.scss. See that file for why the condition has to
// be addressable rather than just a media query.
//
// Some effects gate themselves in JavaScript rather than CSS, because
// nothing about writing a custom property from a pointermove handler (or
// running a setInterval) is something a `@media` query alone can stop --
// IncrediCard's chip tracking, card tilt and processing flip loop are all
// like this. They go through here so a story forcing reduced motion reaches
// them too; otherwise the CSS would go still while the JS-driven effects
// carried on, a state no real user ever gets, which would misrepresent
// what the story control exists to demonstrate.
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
  return document.documentElement.hasAttribute("data-reduced-motion");
}
