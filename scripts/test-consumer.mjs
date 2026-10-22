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
//      load, the card artwork loads as a file, and typing a Visa number
//      shows the Visa acceptance mark, loaded as a file too.
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
  writeFileSync(
    join(app, "src/main.tsx"),
    `import "incredicard/styles.css";
import { createRoot } from "react-dom/client";
import { IncrediCard } from "incredicard";

createRoot(document.getElementById("root")!).render(<IncrediCard id="payment-card" />);
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

    // A Visa test number, typed the way a user would.
    await page.locator('input[autocomplete="cc-number"]').fill("4242424242424242");
    await page.waitForLoadState("networkidle");

    const facts = await page.evaluate(async () => {
      const status = async (url) => (url ? (await fetch(url)).status : null);
      const artwork = [...document.querySelectorAll("*")]
        .map((element) => getComputedStyle(element).backgroundImage)
        .find((value) => value && value.includes("url("));
      const artworkUrl = artwork?.match(/url\("?([^")]+)"?\)/)?.[1] ?? null;
      const mark = [...document.querySelectorAll("img")].find((image) => image.src.includes("visa"));
      return {
        fontLoaded: [...document.fonts].some((font) => font.family.includes("IncrediCard Figtree") && font.status === "loaded"),
        inputFont: getComputedStyle(document.querySelector("input")).fontFamily,
        artworkUrl,
        artworkStatus: await status(artworkUrl),
        markUrl: mark?.src ?? null,
        markStatus: await status(mark?.src),
        markLoaded: Boolean(mark?.complete && mark.naturalWidth > 0),
      };
    });
    await browser.close();
    check(errors.length === 0, `no console errors${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
    check(failedRequests.length === 0, `every request succeeds${failedRequests.length ? `: ${failedRequests.slice(0, 3).join(" | ")}` : ""}`);
    check(facts.fontLoaded, "styles.css loads the component's own Figtree");
    check(facts.inputFont.includes("IncrediCard Figtree"), `the fields use it (${facts.inputFont})`);
    check(Boolean(facts.artworkUrl) && !facts.artworkUrl.startsWith("data:") && facts.artworkStatus === 200, `the card artwork loads as a file (${facts.artworkUrl}, ${facts.artworkStatus})`);
    check(facts.markLoaded && !facts.markUrl.startsWith("data:") && facts.markStatus === 200, `a Visa number shows the Visa mark, loaded as a file (${facts.markUrl}, ${facts.markStatus})`);
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
