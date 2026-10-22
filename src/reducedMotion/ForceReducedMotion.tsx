"use client";

import { Fragment, useEffect } from "react";

export type ForceReducedMotionProps = {
  on: boolean;
  children: React.ReactNode;
};

/**
 * Story-only: forces the reduced-motion condition on, so a story can show
 * IncrediCard's reduced-motion presentation without an OS setting.
 *
 * Deliberately holds no Storybook types of its own, so this module stays
 * free of a dev-only dependency -- the story file wraps it in a
 * three-line `Decorator`.
 *
 * Sets the attribute during RENDER, not in an effect, and this is load
 * bearing rather than sloppy. React runs CHILD effects before a parent's,
 * and this component is the parent (a story decorator). An effect here --
 * even a layout effect -- would therefore set the attribute only after the
 * wrapped component's own effects had already read it, so anything gating
 * itself in JavaScript via `prefersReducedMotion()` would see the old value
 * on mount and never re-read it. Rendering is the only phase that reliably
 * precedes a child's effects.
 *
 * The cleanup effect is still an effect, which is fine -- it only has to
 * run at unmount, and nothing reads the attribute after that.
 *
 * The `key` remounts the subtree when the toggle changes, which restarts
 * animations rather than leaving them mid-cycle, and re-runs the children's
 * effects so a JS-gated one picks up the new value.
 */
export function ForceReducedMotion({ on, children }: ForceReducedMotionProps) {
  if (typeof document !== "undefined") {
    document.documentElement.toggleAttribute("data-reduced-motion", on);
  }

  useEffect(
    () => () => document.documentElement.removeAttribute("data-reduced-motion"),
    [],
  );

  return <Fragment key={on ? "reduced" : "full"}>{children}</Fragment>;
}
