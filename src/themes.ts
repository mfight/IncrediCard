import type { CSSProperties } from "react";
import frontBlackArtwork from "./assets/images/incredicard-front-black.svg";

// IncrediCard's themes. Each one is a single object below, and adding a
// theme means adding one more: its key becomes a valid `theme` prop, and
// `satisfies` makes leaving out any piece a compile error rather than a
// card that quietly renders as another theme.
//
// A theme supplies two kinds of thing:
//
// - VALUES: colors, artwork, fonts, the hologram's tuning. The component
//   writes them onto its root as `--incredicard-*` custom properties (see
//   `incredicardThemeStyle` below), and the stylesheets only ever read
//   those properties. No stylesheet mentions a theme by name.
// - A FACE LAYOUT: how the printed text is arranged on the card, which is
//   structure, not a value. Each layout is one CSS block, keyed off a
//   `data-face-layout` attribute, so several themes can share one.
//   "printed" sets the text the way a modern printed card does; "embossed"
//   the way an embosser lays out an older raised-character card (centered
//   number, tighter type sizes, wider tracking).
//
// A theme can only set values the stylesheets already read. Something
// that needs a property they don't read yet (a backdrop filter, say)
// starts with adding that read, with a default that leaves the existing
// themes unchanged.
//
// The objects are internal for now: `theme` takes a name. The shape is
// meant to become public, so apps can define their own themes.

export type IncrediCardFaceLayout = "printed" | "embossed";

// The hologram's blend mode and the color that, under that mode, means
// "leave the backdrop alone". The glare layers fade toward that color
// away from their highlight, so a mismatch doesn't soften the effect, it
// inverts it: black under `color-burn` drives every channel to zero and
// paints the far half of the card solid black. So a theme names only the
// blend mode, and its falloff color comes with it from here. A new blend
// mode is a new row, with its own correctly paired color.
//
// Not pure black and white: 12% off each, so the far side of the card
// keeps its ribbons lit but drained rather than going dark (see the
// falloff note in IncrediCardHologram.module.scss).
export const INCREDICARD_HOLOGRAM_BLENDS = {
  "color-dodge": { falloffColor: "#1f1f1f" },
  "color-burn": { falloffColor: "#e0e0e0" },
} as const;

export type IncrediCardHologramBlend = keyof typeof INCREDICARD_HOLOGRAM_BLENDS;

// The values a consumer can override through a `--theme-incredicard-*`
// property (see Overview.mdx's CSS custom properties section). A theme
// can pin any of them, if an override would make no sense against its
// artwork, by listing it in `fixed`.
const KNOBS = {
  radius: "face-radius",
  background: "face-background",
  color: "face-color",
  shadow: "face-shadow",
  invalidColor: "face-invalid-color",
  linesOpacity: "face-lines-opacity",
  restingSaturation: "holo-resting-saturation",
  glareStrength: "holo-glare-strength",
  colorRadius: "holo-color-radius",
  falloffColor: "holo-falloff-color",
} as const;

export type IncrediCardThemeKnob = keyof typeof KNOBS;

export type IncrediCardThemeDefinition = {
  faceLayout: IncrediCardFaceLayout;
  face: {
    /** Tied to the artwork's own corner radius (its `rx`). */
    radius: string;
    /** A `background` shorthand: the card's material. */
    background: string;
    color: string;
    shadow: string;
    invalidColor: string;
    /** How strongly the ribbon lines are printed before any light hits
     * them. 0 for a face with no ribbons. */
    linesOpacity: number;
  };
  hologram: {
    blend: IncrediCardHologramBlend;
    opacity: number;
    /** How much of the foil's color survives where no light falls. */
    restingSaturation: number;
    glareStrength: number;
    colorRadius: string;
  };
  /** `null` keeps the component's own font and no shadow. */
  type: {
    /** The cardholder name, on the card and in its field. */
    nameFont: string | null;
    /** Number, expiration and security code, on the card and in their
     * fields. */
    printFont: string | null;
    /** A raised-character shadow on the card's printed text. */
    faceEmboss: string | null;
    /** The same, tuned for the fields' light background. */
    fieldEmboss: string | null;
  };
  /** Knobs this theme pins, ignoring any `--theme-*` override. */
  fixed: readonly IncrediCardThemeKnob[];
};

export const INCREDICARD_THEMES = {
  // The Figtree-set, dark-material card, with the ribbon foil.
  modern: {
    faceLayout: "printed",
    face: {
      radius: "0.75rem",
      // Exported artwork: the card's material and nothing else. The ribbon
      // lines are a separate layer (`.face::before`), so the printed lines
      // and the lit foil are the same file. The artwork's `rx="12"`
      // matches `radius`; a materially different radius needs a
      // re-export, not just a new value.
      background: `url("${frontBlackArtwork}") 0 0 / 100% 100% no-repeat`,
      color: "#ffffff",
      shadow: "0 0.5rem 1.5rem rgb(0 0 0 / 30%)",
      invalidColor: "#dc2626",
      // Faint: the glare layers are tuned to compensate.
      linesOpacity: 0.08,
    },
    hologram: {
      blend: "color-dodge",
      opacity: 0.22,
      // Silver at rest, a trace of hue rather than none: real stamped
      // foil isn't colorless, it just isn't a rainbow.
      restingSaturation: 0.35,
      glareStrength: 1,
      colorRadius: "72%",
    },
    type: {
      nameFont: null,
      printFont: null,
      faceEmboss: null,
      fieldEmboss: null,
    },
    fixed: [],
  },

  // An homage to an embossed plastic card: OCR-A for the engraved name,
  // OCR-B for the three characters an embosser treats as printed (number,
  // expiration, security code), on aged ivory. Two layered text-shadows (a
  // light highlight, a dark counter-shadow) stand in for raised
  // characters; a real bevel would need 3D geometry per glyph, which CSS
  // can't produce for live-typed text. Both fonts are self-hosted under
  // assets/fonts/ (OCR-A-ReadMe.txt, OCR-B-OFL.txt), and only downloaded
  // once this theme uses them.
  vintage: {
    faceLayout: "embossed",
    face: {
      radius: "0.75rem",
      background: "linear-gradient(160deg, #f1e7d0 0%, #dbc999 55%, #c3aa73 100%)",
      color: "#43331d",
      shadow: "0 0.5rem 1.25rem rgb(0 0 0 / 20%), inset 0 0.0625rem 0 rgb(255 255 255 / 40%)",
      invalidColor: "#dc2626",
      // No ribbon artwork on a plain ivory face; still overridable, so an
      // app that wants the lines can have them.
      linesOpacity: 0,
    },
    hologram: {
      // `color-dodge`'s mirror: darkens rather than brightens, which is
      // what shows color against a light face instead of washing out.
      blend: "color-burn",
      opacity: 0.35,
      // The silver resting treatment suits near-black material only.
      restingSaturation: 1,
      glareStrength: 1,
      colorRadius: "72%",
    },
    type: {
      nameFont: '"IncrediCard OCR-A", ui-monospace, monospace',
      printFont: '"IncrediCard OCR-B", ui-monospace, monospace',
      // Darker on the card's mid-tone face than on the fields' near-white.
      faceEmboss:
        "-0.0625rem -0.0625rem 0.0312rem rgb(255 255 255 / 60%), 0.0625rem 0.0938rem 0.0938rem rgb(0 0 0 / 35%)",
      fieldEmboss:
        "-0.0625rem -0.0625rem 0.0312rem rgb(255 255 255 / 90%), 0.0625rem 0.0625rem 0.0625rem rgb(0 0 0 / 25%)",
    },
    fixed: [],
  },
} as const satisfies Record<string, IncrediCardThemeDefinition>;

export type IncrediCardTheme = keyof typeof INCREDICARD_THEMES;

/** A theme by name, falling back to "modern" for a name it doesn't
 * know (only reachable from untyped code). */
export function getIncrediCardTheme(name: string | undefined): IncrediCardThemeDefinition {
  return Object.hasOwn(INCREDICARD_THEMES, name ?? "")
    ? INCREDICARD_THEMES[name as IncrediCardTheme]
    : INCREDICARD_THEMES.modern;
}

/**
 * The theme as custom properties, for the component's root. Every
 * overridable knob is written as `var(--theme-incredicard-*, value)`, so
 * an override set on any ancestor (or on the root through `className`)
 * still wins, unless the theme pins it.
 */
export function incredicardThemeStyle(theme: IncrediCardThemeDefinition): CSSProperties {
  const knobs: Record<IncrediCardThemeKnob, string | number> = {
    ...theme.face,
    restingSaturation: theme.hologram.restingSaturation,
    glareStrength: theme.hologram.glareStrength,
    colorRadius: theme.hologram.colorRadius,
    falloffColor: INCREDICARD_HOLOGRAM_BLENDS[theme.hologram.blend].falloffColor,
  };
  const style: Record<string, string> = {};
  for (const [knob, name] of Object.entries(KNOBS) as Array<[IncrediCardThemeKnob, string]>) {
    const value = String(knobs[knob]);
    style[`--incredicard-${name}`] = theme.fixed.includes(knob)
      ? value
      : `var(--theme-incredicard-${name}, ${value})`;
  }
  // Internal: these let each theme tune the hologram for its own face, and
  // are not an override point.
  style["--incredicard-holo-blend-mode"] = theme.hologram.blend;
  style["--incredicard-holo-opacity"] = String(theme.hologram.opacity);
  // Left unset when null, so the rules that read them fall back to
  // inheriting, exactly as if they had never been declared.
  const type = {
    "--incredicard-name-font": theme.type.nameFont,
    "--incredicard-print-font": theme.type.printFont,
    "--incredicard-face-emboss": theme.type.faceEmboss,
    "--incredicard-field-emboss": theme.type.fieldEmboss,
  };
  for (const [name, value] of Object.entries(type)) {
    if (value !== null) style[name] = value;
  }
  return style as CSSProperties;
}
