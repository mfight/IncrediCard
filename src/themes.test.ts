import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  INCREDICARD_HOLOGRAM_BLENDS,
  INCREDICARD_THEMES,
  extendIncrediCardTheme,
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
  "face-lines-opacity",
  "face-backdrop",
  "face-specular",
  "face-placeholder",
  "holo-resting-saturation",
  "holo-glare-strength",
  "holo-color-radius",
  "holo-falloff-color",
];

const ribbons = INCREDICARD_THEMES.ribbons;

describe.each(Object.entries(INCREDICARD_THEMES))("the %s theme", (_name, theme: IncrediCardThemeDefinition) => {
  const style = incredicardThemeStyle(theme) as Record<string, string>;
  const { hologram } = theme;

  it("writes every overridable value it has behind its --theme-* override", () => {
    for (const name of OVERRIDABLE.filter((name) => hologram || !name.startsWith("holo-"))) {
      expect(style[`--incredicard-${name}`]).toMatch(
        new RegExp(`^var\\(--theme-incredicard-${name}, .+\\)$`, "s"),
      );
    }
  });

  it.runIf(hologram)("pairs its falloff color with its blend mode", () => {
    expect(style["--incredicard-holo-blend-mode"]).toBe(hologram!.blend);
    expect(style["--incredicard-holo-falloff-color"]).toBe(
      `var(--theme-incredicard-holo-falloff-color, ${INCREDICARD_HOLOGRAM_BLENDS[hologram!.blend].falloffColor})`,
    );
  });

  it("writes its line art's three files, for the stylesheets that draw it", () => {
    const art = INCREDICARD_LINE_ART[theme.lineArt as keyof typeof INCREDICARD_LINE_ART];
    expect(style["--incredicard-lines"]).toBe(`url("${art.foil}")`);
    expect(style["--incredicard-lines-mask-a"]).toBe(`url("${art.maskA}")`);
    expect(style["--incredicard-lines-mask-b"]).toBe(`url("${art.maskB}")`);
  });

  it("writes only the type values it has", () => {
    const written = ["nameFont", "printFont", "faceEmboss", "floatingFieldEmboss"].filter(
      (key) => theme.type[key as keyof typeof theme.type] !== null,
    ).length;
    const typeProps = Object.keys(style).filter((p) =>
      /^--incredicard-(name-font|print-font|face-emboss|floating-field-emboss)$/.test(p),
    );
    expect(typeProps).toHaveLength(written);
  });
});

describe("incredicardThemeStyle", () => {
  it("pins a knob a theme lists as fixed, ignoring overrides", () => {
    const pinned: IncrediCardThemeDefinition = { ...ribbons, fixed: ["linesOpacity"] };
    const style = incredicardThemeStyle(pinned) as Record<string, string>;
    expect(style["--incredicard-face-lines-opacity"]).toBe("0.08");
    expect(style["--incredicard-face-color"]).toBe("var(--theme-incredicard-face-color, #ffffff)");
  });

  it("leaves a null font unset, so the text inherits", () => {
    const style = incredicardThemeStyle(ribbons) as Record<string, string>;
    expect(style).not.toHaveProperty("--incredicard-name-font");
    const vintage = incredicardThemeStyle(INCREDICARD_THEMES.vintage) as Record<string, string>;
    expect(vintage["--incredicard-name-font"]).toContain("IncrediCard OCR-A");
  });
});

describe("the glare's blends", () => {
  const { "color-dodge": dodge, screen } = INCREDICARD_HOLOGRAM_BLENDS;
  const lightness = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return (Math.max(n >> 16, (n >> 8) & 255, n & 255) + Math.min(n >> 16, (n >> 8) & 255, n & 255)) / 510;
  };
  const stops = (texture: string) => texture.match(/#[0-9a-f]{6}/gi)!;

  // On a light face the foil has to get lighter than the face, not darker,
  // and a translucent face can't count on the blend to do it: its layers
  // mostly show as they are. So everything screen paints is light.
  it("builds a light face's glare from light colors, and brightens its lines", () => {
    expect(Math.min(...stops(screen.glare.texture).map(lightness))).toBeGreaterThan(0.65);
    expect(Math.max(...stops(dodge.glare.texture).map(lightness))).toBeLessThan(0.35);
    expect(screen.glare.layers).toBe("screen, screen, normal");
    // A black highlight and falloff center add nothing under screen.
    expect(screen.glare.light).toBe("0 0 0");
    expect(screen.brightness).toBeGreaterThan(1);
    expect(dodge.brightness).toBe(1);
  });

  it("writes the glare that goes with the theme's blend mode", () => {
    const style = incredicardThemeStyle(getIncrediCardTheme("glass", "dark")) as Record<string, string>;
    expect(style["--incredicard-holo-blend-mode"]).toBe("screen");
    expect(style["--incredicard-holo-brightness"]).toBe(String(screen.brightness));
    expect(style["--incredicard-holo-glare-light"]).toBe(screen.glare.light);
    expect(style["--incredicard-holo-glare-texture"]).toBe(screen.glare.texture);
    expect(style["--incredicard-holo-glare-layers"]).toBe(screen.glare.layers);
    expect(style["--incredicard-holo-glare-filter"]).toBe(screen.glare.filter);
  });

  it("is what every glare layer reads, not a fixed highlight, texture or filter", () => {
    const css = readFileSync(new URL("IncrediCardHologram.module.scss", import.meta.url), "utf8");
    const rules = css.replace(/^\s*\/\/.*$/gm, "");
    expect(rules).not.toMatch(/rgb\(255 255 255/);
    expect(rules.match(/var\(--incredicard-holo-glare-texture,/g)).toHaveLength(4);
    expect(rules.match(/var\(--incredicard-holo-glare-layers,/g)).toHaveLength(4);
    expect(rules.match(/var\(--incredicard-holo-glare-filter,/g)).toHaveLength(4);
    expect(rules.match(/var\(--incredicard-holo-glare-light,/g)).toHaveLength(8);
  });

  // A positioned layer paints over in-flow text whatever the markup order,
  // and only the blend math hid it while the foil was dark layers over
  // light text, or the reverse.
  it.each(["IncrediCardHologram.module.scss", "IncrediCardFace.module.scss", "IncrediCardEmbeddedFace.module.scss"])(
    "%s keeps the foil and printed lines under the card's text",
    (sheet) => {
      const css = readFileSync(new URL(sheet, import.meta.url), "utf8");
      const block = sheet.startsWith("IncrediCardHologram")
        ? css.slice(css.indexOf(".hologramWrapper {"), css.indexOf("}", css.indexOf(".hologramWrapper {")))
        : css.slice(css.indexOf("&::before {"), css.indexOf("}", css.indexOf("&::before {")));
      expect(block).toContain("z-index: -1;");
    },
  );
});

describe("a theme with no foil", () => {
  const vintage = INCREDICARD_THEMES.vintage;

  it("is vintage, which writes none of the foil's values", () => {
    expect(vintage.hologram).toBeNull();
    const style = incredicardThemeStyle(vintage) as Record<string, string>;
    expect(Object.keys(style).filter((name) => name.includes("holo"))).toEqual([]);
  });

  it("passes its lack of foil on to a theme made from it", () => {
    expect(extendIncrediCardTheme("vintage", { face: { color: "#000000" } }).hologram).toBeNull();
  });

  it("can be made from a theme that has one", () => {
    expect(extendIncrediCardTheme("ribbons", { hologram: null }).hologram).toBeNull();
  });

  it("gains one from tuning, starting from the default theme's", () => {
    const foiled = extendIncrediCardTheme("vintage", { hologram: { blend: "screen" } });
    expect(foiled.hologram).toEqual({ ...ribbons.hologram, blend: "screen" });
  });
});

describe("the glass backdrop", () => {
  const glass = INCREDICARD_THEMES.glass;

  // The two tones stay paired: light text with the blend that can light a dark
  // page, dark text with the one that can mark a bright page.
  it("offers dark text, which brings its own colors and hologram", () => {
    const dark = getIncrediCardTheme("glass", "dark");
    expect(glass.face.color).toBe("#ffffff");
    expect(glass.hologram.blend).toBe("color-dodge");
    expect(dark.face.color).toBe("#05131a");
    expect(dark.hologram?.blend).toBe("screen");
    expect(dark.face.backdrop).toBe(glass.face.backdrop);
    const style = incredicardThemeStyle(dark) as Record<string, string>;
    expect(style["--incredicard-holo-falloff-color"]).toContain(INCREDICARD_HOLOGRAM_BLENDS.screen.falloffColor);
  });

  it("leaves the other themes alone", () => {
    expect(getIncrediCardTheme("ribbons", "dark")).toBe(ribbons);
    expect(getIncrediCardTheme("vintage", "dark")).toBe(INCREDICARD_THEMES.vintage);
  });

  it("refers to the card's own filter, ahead of the backdrop", () => {
    const style = incredicardThemeStyle(glass, "card-filter") as Record<string, string>;
    expect(style["--incredicard-face-backdrop-refracted"]).toBe("url(#card-filter) var(--incredicard-face-backdrop)");
    expect(incredicardThemeStyle(ribbons, "card-filter")).not.toHaveProperty("--incredicard-face-backdrop-refracted");
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

  it("falls back to ribbons for a name it doesn't know, or none", () => {
    expect(getIncrediCardTheme("paper")).toBe(ribbons);
    expect(getIncrediCardTheme(undefined)).toBe(ribbons);
    // Not a theme, though every object has one.
    expect(getIncrediCardTheme("toString")).toBe(ribbons);
  });
});

describe("a custom theme", () => {
  const files = { foil: "/foil.svg", maskA: "/a.svg", maskB: "/b.svg" };

  it("comes back as it is, whatever the text tone", () => {
    const custom: IncrediCardThemeDefinition = { ...ribbons, lineArt: files };
    expect(getIncrediCardTheme(custom)).toBe(custom);
    expect(getIncrediCardTheme(custom, "dark")).toBe(custom);
  });

  it("merges each group with its base, and keeps the rest", () => {
    const custom = extendIncrediCardTheme("ribbons", {
      face: { background: "#123456" },
      hologram: { opacity: 0.5 },
      type: { printFont: "Example" },
    });
    expect(custom.face).toEqual({ ...ribbons.face, background: "#123456" });
    expect(custom.hologram).toEqual({ ...ribbons.hologram, opacity: 0.5 });
    expect(custom.type).toEqual({ ...ribbons.type, printFont: "Example" });
    expect(custom.lineArt).toBe(ribbons.lineArt);
    expect(custom.faceLayout).toBe(ribbons.faceLayout);
  });

  it("replaces fixed and line art whole, and leaves the built-in theme alone", () => {
    const before = structuredClone(ribbons);
    const custom = extendIncrediCardTheme("ribbons", { fixed: ["color"], lineArt: files });
    expect(custom.fixed).toEqual(["color"]);
    expect(custom.lineArt).toBe(files);
    expect(ribbons).toEqual(before);
  });

  it("takes its tone once, when it's made, and keeps no tones of its own", () => {
    const dark = extendIncrediCardTheme("glass", { face: { background: "#ffffff1a" } }, { textTone: "dark" });
    expect(dark.face.color).toBe("#05131a");
    expect(dark.hologram?.blend).toBe("screen");
    expect(dark.face.background).toBe("#ffffff1a");
    expect(dark).not.toHaveProperty("darkText");
    expect(getIncrediCardTheme(dark, "light")).toBe(dark);

    const light = extendIncrediCardTheme("glass", {});
    expect(light.face.color).toBe("#ffffff");
    expect(getIncrediCardTheme(light, "dark").face.color).toBe("#ffffff");
  });

  it("gets the falloff color that goes with its blend mode", () => {
    const custom = extendIncrediCardTheme("ribbons", { hologram: { blend: "screen" } });
    const style = incredicardThemeStyle(custom) as Record<string, string>;
    expect(style["--incredicard-holo-falloff-color"]).toContain(INCREDICARD_HOLOGRAM_BLENDS.screen.falloffColor);
  });

  it("writes its own line art, and can't break out of the URL's string", () => {
    const style = incredicardThemeStyle({
      ...ribbons,
      lineArt: { foil: "/foil.svg", maskA: 'x"), url("/other', maskB: "a\\b\nc" },
    }) as Record<string, string>;
    expect(style["--incredicard-lines"]).toBe('url("/foil.svg")');
    expect(style["--incredicard-lines-mask-a"]).toBe('url("x\\"), url(\\"/other")');
    expect(style["--incredicard-lines-mask-b"]).toBe('url("a\\\\b\\a c")');
  });
});

// Compile-time guarantees, checked by `npm run typecheck` rather than at
// run time: a theme missing a piece, or setting its falloff color
// directly, doesn't type-check.
export const incompleteTheme = {
  faceLayout: "printed",
  face: ribbons.face,
  type: ribbons.type,
  fixed: [],
  // @ts-expect-error -- a theme without its hologram values is incomplete.
} satisfies IncrediCardThemeDefinition;

export const unpairedFalloff = {
  ...ribbons,
  // @ts-expect-error -- the falloff color comes with the blend mode, never on its own.
  hologram: { ...ribbons.hologram, falloffColor: "#000000" },
} satisfies IncrediCardThemeDefinition;

export const incompleteLineArt = {
  ...ribbons,
  // @ts-expect-error -- custom line art needs all three of its files.
  lineArt: { foil: "/foil.svg", maskA: "/a.svg" },
} satisfies IncrediCardThemeDefinition;

export const customLayout = {
  ...ribbons,
  // @ts-expect-error -- a layout is a CSS block, so only the built-in ones exist.
  faceLayout: "sideways",
} satisfies IncrediCardThemeDefinition;

export const publicToneVariants = {
  ...ribbons,
  // @ts-expect-error -- a custom theme is one fixed look, with no tone variants.
  darkText: INCREDICARD_THEMES.glass.darkText,
} satisfies IncrediCardThemeDefinition;
