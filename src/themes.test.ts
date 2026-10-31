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
  "face-backdrop",
  "face-specular",
  "face-placeholder",
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

describe("the glass backdrop", () => {
  const glass = INCREDICARD_THEMES.glass;

  const luminance = (rgb: number[]) => {
    const [r, g, b] = rgb.map((c) => {
      const v = c / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a: number[], b: number[]) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const over = (top: number[], alpha: number, under: number[]) => under.map((c, i) => top[i] * alpha + c * (1 - alpha));

  // Blur and saturation leave pure white as it is, so a white page is the
  // brightest the glass can get. Worst of all where the sheen is strongest.
  const brightness = Number(glass.face.backdrop.match(/brightness\(([\d.]+)\)/)![1]);
  const [r, g, b, tint] = glass.face.background.match(/rgb\((\d+) (\d+) (\d+) \/ (\d+)%\)$/)!.slice(1).map(Number);
  const sheen = Number(glass.face.background.match(/rgb\(255 255 255 \/ (\d+)%\)/)![1]);
  const page = [255, 255, 255].map((c) => c * brightness);
  const worst = over([255, 255, 255], sheen / 100, over([r, g, b], tint / 100, page));

  it("keeps the text readable over a pure white page", () => {
    expect(contrast([255, 255, 255], worst)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the placeholder readable over a pure white page", () => {
    const alpha = Number(glass.face.placeholder.match(/\/ (\d+)%/)![1]) / 100;
    expect(contrast(over([255, 255, 255], alpha, worst), worst)).toBeGreaterThanOrEqual(4.5);
  });

  it("refers to the card's own filter, ahead of the backdrop", () => {
    const style = incredicardThemeStyle(glass, "card-filter") as Record<string, string>;
    expect(style["--incredicard-face-backdrop-refracted"]).toBe("url(#card-filter) var(--incredicard-face-backdrop)");
    expect(incredicardThemeStyle(modern, "card-filter")).not.toHaveProperty("--incredicard-face-backdrop-refracted");
  });

  // Safari discards the whole filter if it holds a `url()`, and an app's
  // minifier can collapse any two declarations of it into one. So the
  // refraction has to stay behind its own `@supports`, and the base rule
  // plain. Nothing in a browser test here would catch this moving: Chromium
  // renders it either way. (The install test checks a minified build.)
  it.each(["IncrediCardFace.module.scss", "IncrediCardEmbeddedFace.module.scss"])(
    "%s offers refraction only behind a Chromium-only check",
    (sheet) => {
      const css = readFileSync(new URL(sheet, import.meta.url), "utf8");
      const refracted = [...css.matchAll(/^\s*backdrop-filter:.*refracted.*$/gm)];
      expect(refracted).toHaveLength(1);
      const before = css.slice(0, refracted[0].index);
      expect(before.trimEnd().endsWith("@supports (-webkit-app-region: none) {")).toBe(true);
      expect(css).not.toMatch(/-webkit-backdrop-filter:.*refracted/);
      // A minifier keeps the last of the pair, and Firefox reads only this one.
      expect(css.indexOf("\n  backdrop-filter:")).toBeGreaterThan(css.indexOf("\n  -webkit-backdrop-filter:"));
    },
  );
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
    expect(getIncrediCardTheme("paper")).toBe(modern);
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
