import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  INCREDICARD_HOLOGRAM_BLENDS,
  INCREDICARD_THEMES,
  getIncrediCardTheme,
  incredicardThemeStyle,
  type IncrediCardThemeDefinition,
} from "./themes";
import { INCREDICARD_LINE_ART } from "./lineArt";

// Whether the themes LOOK right isn't provable here; that was checked by
// comparing screenshots of every story before and after themes became
// objects (identical, pixel for pixel). This covers the contract the
// stylesheets rely on: every theme writes every property they read.

const OVERRIDABLE = [
  "face-radius",
  "face-background",
  "face-color",
  "face-shadow",
  "face-invalid-color",
  "face-lines-opacity",
  "holo-resting-saturation",
  "holo-glare-strength",
  "holo-color-radius",
  "holo-falloff-color",
];

const modern = INCREDICARD_THEMES.modern;

describe.each(Object.entries(INCREDICARD_THEMES))("the %s theme", (_name, theme) => {
  const style = incredicardThemeStyle(theme) as Record<string, string>;

  it("writes every overridable value behind its --theme-* override", () => {
    for (const name of OVERRIDABLE) {
      expect(style[`--incredicard-${name}`]).toMatch(
        new RegExp(`^var\\(--theme-incredicard-${name}, .+\\)$`, "s"),
      );
    }
  });

  it("pairs its falloff color with its blend mode", () => {
    expect(style["--incredicard-holo-blend-mode"]).toBe(theme.hologram.blend);
    expect(style["--incredicard-holo-falloff-color"]).toBe(
      `var(--theme-incredicard-holo-falloff-color, ${INCREDICARD_HOLOGRAM_BLENDS[theme.hologram.blend].falloffColor})`,
    );
  });

  it("writes its line art's three files, for the stylesheets that draw it", () => {
    const art = INCREDICARD_LINE_ART[theme.lineArt];
    expect(style["--incredicard-lines"]).toBe(`url("${art.foil}")`);
    expect(style["--incredicard-lines-mask-a"]).toBe(`url("${art.maskA}")`);
    expect(style["--incredicard-lines-mask-b"]).toBe(`url("${art.maskB}")`);
  });

  it("writes only the type values it has", () => {
    const written = ["nameFont", "printFont", "faceEmboss", "fieldEmboss"].filter(
      (key) => theme.type[key as keyof typeof theme.type] !== null,
    ).length;
    const typeProps = Object.keys(style).filter((p) =>
      /^--incredicard-(name-font|print-font|face-emboss|field-emboss)$/.test(p),
    );
    expect(typeProps).toHaveLength(written);
  });
});

describe("incredicardThemeStyle", () => {
  it("pins a knob a theme lists as fixed, ignoring overrides", () => {
    const pinned: IncrediCardThemeDefinition = { ...modern, fixed: ["linesOpacity"] };
    const style = incredicardThemeStyle(pinned) as Record<string, string>;
    expect(style["--incredicard-face-lines-opacity"]).toBe("0.08");
    expect(style["--incredicard-face-color"]).toBe("var(--theme-incredicard-face-color, #ffffff)");
  });

  it("leaves a null font unset, so the text inherits", () => {
    const style = incredicardThemeStyle(modern) as Record<string, string>;
    expect(style).not.toHaveProperty("--incredicard-name-font");
    const vintage = incredicardThemeStyle(INCREDICARD_THEMES.vintage) as Record<string, string>;
    expect(vintage["--incredicard-name-font"]).toContain("IncrediCard OCR-A");
  });
});

describe("face layouts", () => {
  // "printed" is the base rules; every other layout a theme uses needs its
  // own block in both faces' stylesheets, or it would quietly render as
  // "printed".
  const layouts = new Set(Object.values(INCREDICARD_THEMES).map((t) => t.faceLayout));
  layouts.delete("printed");
  it.each([...layouts])("%s has a block in both faces' stylesheets", (layout) => {
    for (const sheet of ["IncrediCardFace.module.scss", "IncrediCardEmbeddedFace.module.scss"]) {
      const css = readFileSync(new URL(sheet, import.meta.url), "utf8");
      expect(css).toContain(`[data-face-layout="${layout}"]`);
    }
  });
});

describe("getIncrediCardTheme", () => {
  it("finds a theme by name", () => {
    expect(getIncrediCardTheme("vintage")).toBe(INCREDICARD_THEMES.vintage);
  });

  it("falls back to modern for a name it doesn't know, or none", () => {
    expect(getIncrediCardTheme("glass")).toBe(modern);
    expect(getIncrediCardTheme(undefined)).toBe(modern);
    // Not a theme, though every object has one.
    expect(getIncrediCardTheme("toString")).toBe(modern);
  });
});

// Compile-time guarantees, checked by `npm run typecheck` rather than at
// run time: a theme missing a piece, or setting its falloff color
// directly, doesn't type-check.
export const incompleteTheme = {
  faceLayout: "printed",
  face: modern.face,
  type: modern.type,
  fixed: [],
  // @ts-expect-error -- a theme without its hologram values is incomplete.
} satisfies IncrediCardThemeDefinition;

export const unpairedFalloff = {
  ...modern,
  // @ts-expect-error -- the falloff color comes with the blend mode, never on its own.
  hologram: { ...modern.hologram, falloffColor: "#000000" },
} satisfies IncrediCardThemeDefinition;
