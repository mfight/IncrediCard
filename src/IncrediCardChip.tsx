"use client";

import { useEffect, useId, useRef } from "react";
import styles from "./IncrediCardChip.module.scss";
import { prefersReducedMotion } from "./reducedMotion";
import {
  subscribeToDeviceOrientation,
  useIncrediCardMotionAvailable,
} from "./IncrediCardOrientation";

// Attaches a pointermove/pointerleave listener to the returned ref's own
// element--meant to be the whole card's own `.faceWrapper` root (passed
// as a `ref` from IncrediCardFace.tsx/IncrediCardEmbeddedFace.tsx), not
// `IncrediCardChip`'s own tiny 36x26 box. The whole card is the natural
// hover target for "tilt the card to catch the light"--requiring
// pixel-precise hovering over a target that small would rarely trigger
// in practice and wouldn't read as the card itself reacting to a light
// source. Writes the cursor's own position relative to that element, as
// percentages, onto CSS custom properties declared on that SAME element
// (`--incredicard-chip-light-x`/`-y`, plus `--incredicard-chip-light-active` while the
// pointer is actually over it--see `handlePointerMove`'s own comment for
// why that's a separate flag, not inferred from x/y alone)--plain
// `style.setProperty` on a ref, not React state: pointermove fires far
// more often than this component should ever re-render for, and nothing
// here needs to. Every mounted `IncrediCardChip`/`IncrediCardHologram`
// inside that same ancestor reads these properties directly via
// ordinary CSS custom-property inheritance (see
// IncrediCardChip.module.scss's `[data-chip-reflection]` block, and the
// glare layers in IncrediCardHologram.module.scss)--no prop, and no
// re-render, ever has to carry the actual position value between
// components.
//
// Inert (attaches nothing) unless `active` is true--the caller passes
// `true` once `chipReflection` and/or `holographic` is set (the
// hologram's pointer response reuses these same properties), so the
// plain default case (neither) adds no listener at all. Also inert
// under `prefers-reduced-motion`--WCAG's "Animation from Interactions"
// guidance treats cursor-driven motion the same as an autoplaying one
// for this purpose, the same reasoning this component's flip transition
// is disabled under. Checked in JS, not CSS--nothing about writing a CSS
// custom property from an event handler is something a `@media` query
// alone can stop.
//
// `(hover: hover) and (pointer: fine)` is a BRANCH rather than a
// bail-out. Touch devices don't get less; they just have no pointer
// position worth reading: a touch device fires real
// `pointermove`/`pointerleave` events during a drag with no hover state
// behind them, so the tracked position jumps around rather than
// settling anywhere meaningful. Device orientation is a genuine position
// signal, so those devices use that instead (see
// IncrediCardOrientation.ts). Pointer-capable devices take the pointer
// path and never attach an orientation listener; the two never run at
// once, so nothing can fight over these properties.
export function useIncrediCardChipLight(active: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const motionAvailable = useIncrediCardMotionAvailable();

  useEffect(() => {
    if (!active) return undefined;
    if (prefersReducedMotion()) return undefined;
    const el = ref.current;
    if (!el) return undefined;

    // Percentages, as the gradient coordinate system these feed expects.
    // Shared by both input paths so a device tilt lands the highlight in
    // the same place a cursor at the equivalent position would--every
    // number downstream of here is tuned against a real cursor (see the
    // `rotate` comment below), and a second mapping written against the
    // same properties would be free to drift from it.
    function writeLight(x: number, y: number) {
      el!.style.setProperty("--incredicard-chip-light-x", `${x}%`);
      el!.style.setProperty("--incredicard-chip-light-y", `${y}%`);
      // A separate on/off signal, not inferred from x/y alone--0%/0%
      // is itself a real, reachable pointer position (the card's own
      // top-left corner), so a consumer of this property (the
      // hologram's glare and color layers) needs an explicit
      // "is anything actually tracking right now" flag rather than
      // trying to guess it from the coordinates themselves.
      el!.style.setProperty("--incredicard-chip-light-active", "1");
      // A `deg`-typed rotation offset, computed here rather than left to
      // a CSS `calc()`--`--incredicard-chip-light-y` above is `%`-typed, and
      // CSS has no operation that converts a percentage into an angle
      // (multiplying one by a plain number keeps it a percentage).
      // Computing the degree value in JS, where `y` is still a plain
      // number, and writing it out pre-unit-suffixed (`${rotate}deg`)
      // sidesteps the limitation entirely--`.glareLinear` in
      // IncrediCardHologram.module.scss reads this directly as an angle
      // inside its `calc(115deg + var(--incredicard-chip-light-rotate, 0deg))`,
      // and `.glareLinearReverse` reads the same value with the sign
      // flipped (`115deg - ...`), so the two bands scissor around a
      // shared axis instead of sweeping together. Only those two consume
      // it (a linear gradient has a meaningful angle to rotate); the
      // radial pair's circular falloff is rotationally symmetric around
      // its center point, so rotating it would be a no-op.
      //
      // A ±45deg swing balances "clearly visible" against "restrained."
      // The linear band is narrow so that rotation reads at all (see
      // `.glareLinear`'s comment on band width); a much smaller swing is
      // hard to notice, and a much larger one is more dramatic than this
      // otherwise-restrained effect calls for.
      const rotate = ((y - 50) / 50) * 45;
      el!.style.setProperty("--incredicard-chip-light-rotate", `${rotate}deg`);
    }

    function clearLight() {
      el!.style.removeProperty("--incredicard-chip-light-x");
      el!.style.removeProperty("--incredicard-chip-light-y");
      el!.style.removeProperty("--incredicard-chip-light-active");
      el!.style.removeProperty("--incredicard-chip-light-rotate");
    }

    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      const handlePointerMove = (event: PointerEvent) => {
        const rect = el.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 100;
        const y = ((event.clientY - rect.top) / rect.height) * 100;
        writeLight(x, y);
      };

      el.addEventListener("pointermove", handlePointerMove);
      el.addEventListener("pointerleave", clearLight);
      return () => {
        el.removeEventListener("pointermove", handlePointerMove);
        el.removeEventListener("pointerleave", clearLight);
      };
    }

    if (!motionAvailable) return undefined;

    // The attribute, not the custom properties, is what the hologram's
    // own `@media (hover: none)` blocks key off. Those blocks stop the
    // ambient shimmer and the glare transitions on a device with no
    // pointer, and CSS has no way to ask whether an orientation signal
    // exists--so this element carries the answer. Set here rather than
    // in useIncrediCardTilt because it means precisely "orientation is
    // driving `--incredicard-chip-light-*` on this element," which is exactly
    // the condition those blocks need; tilt's own properties are read
    // by a different rule that never had a touch carve-out.
    el.setAttribute("data-incredicard-orientation", "");

    const unsubscribe = subscribeToDeviceOrientation(window, (offset) => {
      // -0.5..0.5 back into the 0%-100% box this effect's own gradients
      // are addressed in.
      writeLight((offset.x + 0.5) * 100, (offset.y + 0.5) * 100);
    });

    return () => {
      unsubscribe();
      el.removeAttribute("data-incredicard-orientation");
      clearLight();
    };
  }, [active, motionAvailable]);

  return ref;
}

// The card's EMV contact chip--an SVG (gold contact pad, faux
// notches/dividers, inner/outer bevel via filters) reproduced here as
// inline JSX rather than referenced as an `<img src="./chip.svg">`.
// Inline, its filter/gradient/clip-path <defs> share the page's id
// namespace, so each one gets a unique, per-instance id (see `useId()`
// below). Every fill in this graphic (the gold body, both gray
// contact-line assemblies) comes from the artwork itself, unaffected by
// "modern"/"vintage" theme--the same chip sits on the card in either
// theme; only the plastic body around it differs (see the
// `[data-theme="vintage"]` blocks in IncrediCardFace.module.scss and
// IncrediCardEmbeddedFace.module.scss, which don't touch `.chip`).
//
// SVG ids (`clip0_0_7286`, `filter0_iiii_0_7286`, etc., as exported)
// are document-global once rendered--reused verbatim, a second
// <IncrediCardChip> mounted anywhere else on the same page (two
// IncrediCard instances on one checkout page, or two stories mounted on
// one Storybook docs page) would have every chip resolve each
// `url(#...)` reference against whichever instance's element happened to
// render first, silently breaking every other instance's fill/filter.
// `useId()` gives each mounted instance its own unique id namespace
// instead of hardcoding the exported file's ids.
//
// The chip's metal surface catches light from the pointer's direction,
// confined to roughly the chip's rounded silhouette via
// `.chipWrapper`'s `overflow: hidden` + border-radius (an approximate,
// not pixel-exact, match to the svg's `rx="8"` corner rounding at this
// render size--close enough that it never visibly spills past a square
// corner). See `useIncrediCardChipLight` above for the mechanism. The
// pointer-following highlight is the only reflection mode, so
// `reflection` is a plain boolean.
//
// Neutralized under `prefers-reduced-motion`--the same convention this
// component's flip transition follows.
export type IncrediCardChipProps = {
  /** Default true. Purely visual--nothing here changes what the chip
   * means, only whether its own metal surface catches the light. */
  reflection?: boolean;
};

export function IncrediCardChip({ reflection = true }: IncrediCardChipProps) {
  const uid = useId();
  const clipId = `incredicard-chip-clip-${uid}`;
  const bevelFilterId = `incredicard-chip-bevel-${uid}`;
  const leftShadowFilterId = `incredicard-chip-shadow-l-${uid}`;
  const leftLinesFilterId = `incredicard-chip-lines-l-${uid}`;
  const rightLinesFilterId = `incredicard-chip-lines-r-${uid}`;
  const gradientId = `incredicard-chip-gradient-${uid}`;

  return (
    <span
      className={styles.chipWrapper}
      data-chip-reflection={reflection ? "" : undefined}
      aria-hidden="true"
    >
      <svg className={styles.chipSvg} viewBox="0 0 46 33" fill="none">
        <g clipPath={`url(#${clipId})`}>
          <g filter={`url(#${bevelFilterId})`}>
            <rect
              x="1"
              y="0.767456"
              width="44"
              height="31.4651"
              rx="8"
              fill={`url(#${gradientId})`}
            />
          </g>
          <rect
            x="0.67"
            y="0.437456"
            width="44.66"
            height="32.1251"
            rx="8.33"
            stroke="#4E4E4E"
            strokeWidth="0.66"
          />
          <g filter={`url(#${leftShadowFilterId})`}>
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M1 8.76746C1 4.34919 4.58172 0.767456 9 0.767456H30L20.3846 32.2326H9C4.58172 32.2326 1 28.6509 1 24.2326V8.76746Z"
              fill="white"
              fillOpacity="0.2"
            />
          </g>
          <g filter={`url(#${leftLinesFilterId})`}>
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M11.8 0.767456H11V7.67443H1V8.28839H11V16.1163H1V16.7302H11V24.5582H1V25.1721H11V32.2326H11.8V0.767456Z"
              fill="#6B6B6B"
            />
          </g>
          <g filter={`url(#${rightLinesFilterId})`}>
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M34.9992 7.67444H34.1992V32.2326H34.9992V7.67444ZM45 24.5582H35V25.1721H45V24.5582ZM35 16.1163H45V16.7303H35V16.1163ZM45 7.67444H35V8.28839H45V7.67444Z"
              fill="#6B6B6B"
            />
          </g>
        </g>
        <defs>
          <filter
            id={bevelFilterId}
            x="-0.319912"
            y="-0.552578"
            width="46.6398"
            height="34.1052"
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feBlend
              mode="normal"
              in="SourceGraphic"
              in2="BackgroundImageFix"
              result="shape"
            />
            <feColorMatrix
              in="SourceAlpha"
              type="matrix"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
              result="hardAlpha"
            />
            <feMorphology
              radius="0.66"
              operator="erode"
              in="SourceAlpha"
              result="effect1_innerShadow"
            />
            <feOffset dx="1" />
            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0.94902 0 0 0 0 0.839216 0 0 0 0 0.392157 0 0 0 0.8 0"
            />
            <feBlend mode="normal" in2="shape" result="effect1_innerShadow" />
            <feColorMatrix
              in="SourceAlpha"
              type="matrix"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
              result="hardAlpha"
            />
            <feMorphology
              radius="0.66"
              operator="erode"
              in="SourceAlpha"
              result="effect2_innerShadow"
            />
            <feOffset dx="-1" />
            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0.937255 0 0 0 0 0.792157 0 0 0 0 0.282353 0 0 0 0.8 0"
            />
            <feBlend
              mode="normal"
              in2="effect1_innerShadow"
              result="effect2_innerShadow"
            />
            <feColorMatrix
              in="SourceAlpha"
              type="matrix"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
              result="hardAlpha"
            />
            <feMorphology
              radius="0.66"
              operator="erode"
              in="SourceAlpha"
              result="effect3_innerShadow"
            />
            <feOffset dy="-1" />
            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0.737255 0 0 0 0 0.627451 0 0 0 0 0.168627 0 0 0 0.5 0"
            />
            <feBlend
              mode="normal"
              in2="effect2_innerShadow"
              result="effect3_innerShadow"
            />
            <feColorMatrix
              in="SourceAlpha"
              type="matrix"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
              result="hardAlpha"
            />
            <feMorphology
              radius="0.66"
              operator="erode"
              in="SourceAlpha"
              result="effect4_innerShadow"
            />
            <feOffset dy="1" />
            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.85 0"
            />
            <feBlend
              mode="normal"
              in2="effect3_innerShadow"
              result="effect4_innerShadow"
            />
          </filter>
          <filter
            id={leftShadowFilterId}
            x="-1"
            y="-4.23254"
            width="39"
            height="41.4651"
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feColorMatrix
              in="SourceAlpha"
              type="matrix"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
              result="hardAlpha"
            />
            <feOffset dx="3" />
            <feGaussianBlur stdDeviation="2.5" />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.28 0"
            />
            <feBlend
              mode="normal"
              in2="BackgroundImageFix"
              result="effect1_dropShadow"
            />
            <feBlend
              mode="normal"
              in="SourceGraphic"
              in2="effect1_dropShadow"
              result="shape"
            />
          </filter>
          <filter
            id={leftLinesFilterId}
            x="1"
            y="0.267456"
            width="10.8"
            height="32.4651"
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feColorMatrix
              in="SourceAlpha"
              type="matrix"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
              result="hardAlpha"
            />
            <feOffset dy="0.5" />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"
            />
            <feBlend
              mode="screen"
              in2="BackgroundImageFix"
              result="effect1_dropShadow"
            />
            <feColorMatrix
              in="SourceAlpha"
              type="matrix"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
              result="hardAlpha"
            />
            <feOffset dy="-0.5" />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0.85098 0 0 0 0 0.760784 0 0 0 0 0.34902 0 0 0 1 0"
            />
            <feBlend
              mode="multiply"
              in2="effect1_dropShadow"
              result="effect2_dropShadow"
            />
            <feBlend
              mode="normal"
              in="SourceGraphic"
              in2="effect2_dropShadow"
              result="shape"
            />
          </filter>
          <filter
            id={rightLinesFilterId}
            x="34.1992"
            y="7.17444"
            width="10.8008"
            height="25.5581"
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feColorMatrix
              in="SourceAlpha"
              type="matrix"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
              result="hardAlpha"
            />
            <feOffset dy="0.5" />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"
            />
            <feBlend
              mode="screen"
              in2="BackgroundImageFix"
              result="effect1_dropShadow"
            />
            <feColorMatrix
              in="SourceAlpha"
              type="matrix"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
              result="hardAlpha"
            />
            <feOffset dy="-0.5" />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0.85098 0 0 0 0 0.760784 0 0 0 0 0.34902 0 0 0 1 0"
            />
            <feBlend
              mode="multiply"
              in2="effect1_dropShadow"
              result="effect2_dropShadow"
            />
            <feBlend
              mode="normal"
              in="SourceGraphic"
              in2="effect2_dropShadow"
              result="shape"
            />
          </filter>
          <radialGradient
            id={gradientId}
            cx="0"
            cy="0"
            r="1"
            gradientTransform="matrix(116.25 -1.433 2.00387 83.1325 52.8474 76.0504)"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0.0349756" stopColor="#D8D0B5" />
            <stop offset="1" stopColor="#FFFBBE" />
          </radialGradient>
          <clipPath id={clipId}>
            <rect width="46" height="33" fill="white" />
          </clipPath>
        </defs>
      </svg>
      <span className={styles.reflection} />
    </span>
  );
}
