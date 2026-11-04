#!/usr/bin/env node
// Proves the package installs and works in a project that has
// nothing of this repository but the packed tarball.
//
//   1. npm pack (which builds first, through `prepack`).
//   2. A throwaway Vite + React app in a temporary directory installs the
//      tarball and React, as any consumer would.
//   3. Server rendering: Node imports the component through the package's
//      own exports and renders it to HTML.
//   4. A production build of the app, served and opened in Chromium: no
//      console errors, every request succeeds, the stylesheet and its fonts
//      load, and the card artwork loads as a file. Typing a Visa number
//      into a card given no acceptance marks names the network in text;
//      into a card given the app's own Visa mark, it shows that mark,
//      loaded as a file too. A card given hosted fields places them, hands
//      them the theme's text styles, and isn't frosted.
//
// Before installing, it checks the tarball itself carries no acceptance
// marks: those are the app's to supply.
//
// Usage: npm run test:consumer   (KEEP=1 keeps the temporary app)

import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const run = (command, args, cwd) => execFileSync(command, args, { cwd, stdio: ["ignore", "pipe", "inherit"], encoding: "utf8" });

const app = mkdtempSync(join(tmpdir(), "incredicard-consumer-"));
const failures = [];
const check = (ok, message) => {
  console.log(`${ok ? "  ok  " : "  FAIL"} ${message}`);
  if (!ok) failures.push(message);
};

try {
  console.log("Packing...");
  const tarball = run("npm", ["pack", "--silent", "--pack-destination", app], ROOT).trim().split("\n").pop();
  const tarballPath = join(app, tarball.split("/").pop());
  const packed = run("tar", ["-tzf", tarballPath], app).trim().split("\n");
  const marks = packed.filter(
    (file) => /\.(svg|png|jpe?g|webp|gif|avif)$/i.test(file) && /acceptance|amex|diners|discover|jcb|maestro|mastercard|union-?pay|visa/i.test(file),
  );
  check(marks.length === 0, `the package ships no acceptance marks${marks.length ? `: ${marks.join(", ")}` : ""}`);

  writeFileSync(
    join(app, "package.json"),
    JSON.stringify({ name: "incredicard-consumer", private: true, type: "module" }, null, 2),
  );
  console.log("Installing the tarball into a fresh app...");
  run("npm", ["install", "--no-audit", "--no-fund", tarballPath, `react@${pkg.devDependencies.react}`, `react-dom@${pkg.devDependencies["react-dom"]}`, `vite@${pkg.devDependencies.vite}`], app);

  // --- Server rendering in Node, through the package's exports only.
  writeFileSync(
    join(app, "ssr.mjs"),
    `import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { IncrediCard, DEFAULT_INCREDICARD_LABELS } from "incredicard";
const html = renderToString(h(IncrediCard, { id: "payment-card", defaultValue: { cardholderName: "Ada Lovelace", cardNumber: "4242424242424242", expirationMonth: "12", expirationYear: "30", cvc: "" } }));
console.log(JSON.stringify({ html, label: DEFAULT_INCREDICARD_LABELS.cardNumberLabel, field: Boolean(IncrediCard.Field) && Boolean(IncrediCard.MaskedField) }));
`,
  );
  const ssr = JSON.parse(run("node", ["ssr.mjs"], app).trim().split("\n").pop());
  check(ssr.html.includes("<input") && ssr.html.includes("Ada Lovelace"), "server-renders IncrediCard through the package exports");
  check(Boolean(ssr.label) && ssr.html.includes(ssr.label), `renders the default English labels ("${ssr.label}")`);
  check(ssr.field, "IncrediCard.Field and IncrediCard.MaskedField are reachable on the namespace");

  // --- A production build, opened in Chromium.
  mkdirSync(join(app, "src"));
  writeFileSync(
    join(app, "index.html"),
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>IncrediCard consumer</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>`,
  );
  // The app's own mark: a stand-in drawn here, not anyone's artwork.
  writeFileSync(
    join(app, "src/visa-mark.svg"),
    `<svg xmlns="http://www.w3.org/2000/svg" width="70" height="56" viewBox="0 0 70 56"><rect width="70" height="56" rx="6" fill="#fff"/></svg>\n`,
  );
  writeFileSync(
    join(app, "src/main.tsx"),
    `import "incredicard/styles.css";
import { createRoot } from "react-dom/client";
import {
  IncrediCard,
  extendIncrediCardTheme,
  type IncrediCardAcceptanceMarks,
  type IncrediCardHostedField,
  type IncrediCardHostedFieldStyle,
} from "incredicard";
import visaMark from "./visa-mark.svg";

const marks: IncrediCardAcceptanceMarks = { visa: visaMark };
const customTheme = extendIncrediCardTheme("glass", { face: { background: "rgb(1 2 3)" } }, { textTone: "dark" });

// A processor's fields, reduced to what IncrediCard sees of them: an element
// to place and a reported state. The styles each one is handed are kept for
// the checks.
const hostedStyles: Record<string, IncrediCardHostedFieldStyle | null> = {};
(window as unknown as { hostedStyles: typeof hostedStyles }).hostedStyles = hostedStyles;
const hostedField = (key: string, complete: boolean): IncrediCardHostedField => ({
  empty: !complete,
  complete,
  focused: false,
  render: (context) => {
    hostedStyles[key] = context.style;
    return <div data-consumer-hosted={key} />;
  },
  focus: () => {},
});

createRoot(document.getElementById("root")!).render(
  <>
    <IncrediCard id="plain-card" />
    <IncrediCard id="marked-card" acceptanceMarks={marks} />
    <IncrediCard id="globe-card" theme="globe" holofoil />
    <IncrediCard id="vintage-card" theme="vintage" holofoil />
    <IncrediCard id="custom-card" theme={customTheme} />
    <IncrediCard id="glass-card" theme="glass" />
    <IncrediCard id="copy-card" theme="glass" glassBackdrop={{ element: { current: document.body }, background: "linear-gradient(#123, #456)" }} />
    <IncrediCard
      id="hosted-card"
      theme="glass"
      hostedFields={{
        cardNumber: hostedField("cardNumber", true),
        expiration: hostedField("expiration", false),
        cvc: hostedField("cvc", false),
        network: "visa",
        last4: "4242",
      }}
    />
  </>,
);
`,
  );
  // Vite inlines an asset under 4KB as a data: URI by default, which is
  // the app's choice and would hide whether the package's own files
  // resolve. Keeping every asset a file is what makes the checks below
  // test the package.
  writeFileSync(join(app, "vite.config.js"), `export default { build: { assetsInlineLimit: 0 } };\n`);
  console.log("Building the app...");
  run("npx", ["vite", "build", "--logLevel", "warn"], app);

  const port = 4710 + Math.floor(Math.random() * 200);
  const server = spawn("npx", ["vite", "preview", "--port", String(port), "--strictPort"], { cwd: app, stdio: "ignore" });
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const errors = [];
    const failedRequests = [];
    page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("response", (response) => response.status() >= 400 && failedRequests.push(`${response.status()} ${response.url()}`));
    for (let attempt = 0; ; attempt++) {
      try {
        await page.goto(`http://localhost:${port}/`, { waitUntil: "networkidle" });
        break;
      } catch (error) {
        if (attempt > 30) throw error;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    await page.evaluate(() => document.fonts.ready);

    // A Visa test number, typed the way a user would, into both cards.
    for (const card of ["#plain-card", "#marked-card"]) {
      await page.locator(`${card} input[autocomplete="cc-number"]`).fill("4242424242424242");
    }
    await page.waitForLoadState("networkidle");

    const facts = await page.evaluate(async () => {
      const status = async (url) => (url ? (await fetch(url)).status : null);
      const artwork = [...document.querySelectorAll("*")]
        .map((element) => getComputedStyle(element).backgroundImage)
        .find((value) => value && value.includes("url("));
      const artworkUrl = artwork?.match(/url\("?([^")]+)"?\)/)?.[1] ?? null;
      // The line art a card prints (its face's ::before) and the first
      // glare mask its hologram uses, as URLs.
      const lineArt = (card) => {
        const elements = [...(document.querySelector(card)?.querySelectorAll("*") ?? [])];
        const url = (value) => value?.match(/url\("?([^")]+)"?\)/)?.[1] ?? null;
        return {
          printed: url(elements.map((e) => getComputedStyle(e, "::before").backgroundImage).find((v) => v.includes("incredicard-lines-"))),
          mask: url(elements.map((e) => getComputedStyle(e).maskImage).find((v) => v.includes("incredicard-lines-"))),
        };
      };
      const glassFace = [...(document.querySelector("#glass-card")?.querySelectorAll("*") ?? [])].find(
        (element) => getComputedStyle(element).backdropFilter !== "none",
      );
      // The base rule alone, as a browser outside the `@supports` block
      // reads it: the standard property has to survive minifying, since
      // Firefox has no other. Same-origin here, so the rules are readable.
      // Not the rule that takes the frost off for hosted fields, which sets
      // it to `none`.
      const baseRules = [...document.styleSheets]
        .flatMap((sheet) => [...sheet.cssRules])
        .filter((rule) => {
          const value = rule.selectorText && rule.style?.getPropertyValue("backdrop-filter");
          return Boolean(value) && value !== "none";
        });
      const hostedCard = document.querySelector("#hosted-card");
      const hostedFaces = [...(hostedCard?.querySelectorAll("[data-hosted-fields] *") ?? [])].filter((element) =>
        getComputedStyle(element).backdropFilter.includes("blur"),
      );
      const hostedStyles = window.hostedStyles ?? {};
      // Its rules matter only outside Chromium, so nothing visible here would
      // show a minifier dropping them. Read them from the computed styles.
      const copyImage = [...(document.querySelector("#copy-card")?.querySelectorAll("span") ?? [])].find((span) => span.style.background);
      const copyBent = copyImage?.parentElement;
      const copy = copyBent?.parentElement;
      const lensHref = document.querySelector("#glass-card feImage")?.getAttribute("href") ?? "";
      const customRoot = document.querySelector("#custom-card")?.closest("[style*='--incredicard-face-background']");
      const custom = customRoot && {
        background: getComputedStyle(customRoot).getPropertyValue("--incredicard-face-background"),
        color: getComputedStyle(customRoot).getPropertyValue("--incredicard-face-color"),
        theme: customRoot.getAttribute("data-theme"),
      };
      const ribbons = lineArt("#plain-card");
      const globe = lineArt("#globe-card");
      const plain = document.querySelector("#plain-card");
      const mark = document.querySelector("#marked-card")?.querySelector('img[src*="visa"]');
      return {
        plainImages: plain?.querySelectorAll("img").length ?? -1,
        plainName: [...(plain?.querySelectorAll("span") ?? [])].some((span) => span.textContent === "Visa"),
        markedName: [...(document.querySelector("#marked-card")?.querySelectorAll("span") ?? [])].some((span) => span.textContent === "Visa"),
        fontLoaded: [...document.fonts].some((font) => font.family.includes("IncrediCard Figtree") && font.status === "loaded"),
        inputFont: getComputedStyle(document.querySelector("input")).fontFamily,
        artworkUrl,
        artworkStatus: await status(artworkUrl),
        markUrl: mark?.src ?? null,
        markStatus: await status(mark?.src),
        markLoaded: Boolean(mark?.complete && mark.naturalWidth > 0),
        glassFilter: glassFace ? getComputedStyle(glassFace).backdropFilter : null,
        lensInlined: lensHref.startsWith("data:image/png"),
        custom,
        glassBaseRules: baseRules.length,
        copy: copy && {
          display: getComputedStyle(copy).display,
          mask: getComputedStyle(copy).maskImage,
          filter: getComputedStyle(copyBent).filter,
        },
        ribbons: { ...ribbons, status: await status(ribbons.printed) },
        globe: { ...globe, status: await status(globe.printed), maskStatus: await status(globe.mask) },
        vintageMask: lineArt("#vintage-card").mask,
        hosted: {
          slots: hostedCard?.querySelectorAll("[data-consumer-hosted]").length ?? -1,
          inputs: [...(hostedCard?.querySelectorAll("input:not([disabled])") ?? [])].map((input) => input.autocomplete),
          frostedFaces: hostedFaces.length,
          numberStyle: hostedStyles.cardNumber ?? null,
        },
      };
    });
    await browser.close();
    check(errors.length === 0, `no console errors${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
    check(failedRequests.length === 0, `every request succeeds${failedRequests.length ? `: ${failedRequests.slice(0, 3).join(" | ")}` : ""}`);
    check(facts.fontLoaded, "styles.css loads the component's own Figtree");
    check(facts.inputFont.includes("IncrediCard Figtree"), `the fields use it (${facts.inputFont})`);
    check(Boolean(facts.artworkUrl) && !facts.artworkUrl.startsWith("data:") && facts.artworkStatus === 200, `the card artwork loads as a file (${facts.artworkUrl}, ${facts.artworkStatus})`);
    check(/incredicard-lines-ribbons-[^/]*\.svg$/.test(facts.ribbons.printed ?? "") && facts.ribbons.status === 200, `the default theme prints the ribbons, loaded as a file (${facts.ribbons.printed}, ${facts.ribbons.status})`);
    check(
      /incredicard-lines-globe-[^/]*\.svg$/.test(facts.globe.printed ?? "") && facts.globe.status === 200 && /incredicard-lines-globe-a-[^/]*\.svg$/.test(facts.globe.mask ?? "") && facts.globe.maskStatus === 200,
      `theme="globe" prints the globe and masks its glare with it, both loaded as files (${facts.globe.printed}, ${facts.globe.status}; ${facts.globe.mask}, ${facts.globe.maskStatus})`,
    );
    check(facts.vintageMask === null, `theme="vintage" has no foil, so holofoil adds no glare to it (${facts.vintageMask})`);
    // This Chromium run has to get both. An app's minifier is what can lose
    // either one, which is why this is checked on a real, minified build.
    check(facts.custom?.background.includes("rgb(1 2 3)") && facts.custom.color.includes("#05131a") && facts.custom.theme === null, `a theme extended from glass, with dark text, renders as its own (${JSON.stringify(facts.custom)})`);
    check(facts.glassFilter?.includes("url(") && facts.glassFilter.includes("blur") && facts.lensInlined, `theme="glass" frosts and refracts the backdrop, with its lens map inlined (${facts.glassFilter}, inlined: ${facts.lensInlined})`);
    check(facts.glassBaseRules === 2, `both faces' base rules keep the standard backdrop-filter after minifying, for Firefox (${facts.glassBaseRules})`);
    check(facts.copy?.display === "none" && facts.copy.mask.includes("gradient") && facts.copy.filter.includes("url(") && facts.copy.filter.includes("blur"), `glassBackdrop's copy stays out of Chromium, with its mask and filter intact after minifying (${JSON.stringify(facts.copy)})`);
    check(
      facts.hosted.slots === 3 && facts.hosted.inputs.join() === "cc-name",
      `hostedFields places the number, expiration and security code, leaving only the name as an input (${facts.hosted.slots} slots; inputs: ${facts.hosted.inputs.join() || "none"})`,
    );
    check(
      facts.hosted.numberStyle?.fontFamily.includes("IncrediCard Figtree") && /px$/.test(facts.hosted.numberStyle.lineHeight) && facts.hosted.numberStyle.color.startsWith("rgb"),
      `a hosted field is handed the theme's resolved text styles (${JSON.stringify(facts.hosted.numberStyle)})`,
    );
    check(facts.hosted.frostedFaces === 0, `a floating glass card with hosted fields isn't frosted, after minifying (${facts.hosted.frostedFaces} frosted)`);
    check(facts.plainName && facts.plainImages === 0, `with no marks given, a Visa number names the network in text (${facts.plainImages} images)`);
    check(facts.markLoaded && !facts.markUrl.startsWith("data:") && facts.markStatus === 200 && !facts.markedName, `with the app's own Visa mark, a Visa number shows it, loaded as a file (${facts.markUrl}, ${facts.markStatus})`);
  } finally {
    server.kill();
  }
} finally {
  if (process.env.KEEP) console.log(`Kept ${app}`);
  else rmSync(app, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log("\nThe package installs and works in a fresh consumer.");
