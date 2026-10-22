#!/usr/bin/env node
// Builds the installable package into dist/.
//
//   dist/**/*.js           ES modules, one per source module, each keeping
//                          its own "use client" line
//   dist/**/*.d.ts         type declarations
//   dist/incredicard.css   every style the component needs, fonts included
//   dist/assets/           the images and fonts, as files
//   dist/licenses/         the bundled fonts' licenses
//
// Usage: npm run build

import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { build } from "vite";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const DIST = join(ROOT, "dist");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));

// React stays the consumer's (a peer), subpaths included (react/jsx-runtime).
const external = Object.keys(pkg.peerDependencies);
const isExternal = (id) => external.some((name) => id === name || id.startsWith(`${name}/`));

// Library mode inlines every asset as base64, whatever its size. An image
// imported from code becomes its own file instead, referenced as
// `new URL("./x.svg", import.meta.url)`, which Vite, webpack and Turbopack
// all resolve in a consumer's build.
const ASSET = /\.(svg|png|jpe?g|webp|gif|avif|woff2?)$/;
const assetFiles = {
  name: "incredicard-asset-files",
  enforce: "pre",
  load(id) {
    if (id.includes("?") || !ASSET.test(id)) return null;
    const ref = this.emitFile({ type: "asset", name: basename(id), source: readFileSync(id) });
    return `export default import.meta.ROLLUP_FILE_URL_${ref};`;
  },
};

rmSync(DIST, { recursive: true, force: true });

await build({
  root: ROOT,
  configFile: false,
  logLevel: "warn",
  publicDir: false,
  plugins: [assetFiles],
  css: { modules: { generateScopedName: "incredicard-[local]-[hash:base64:6]" } },
  build: {
    outDir: DIST,
    emptyOutDir: false,
    sourcemap: true,
    minify: false,
    cssCodeSplit: false,
    lib: { entry: { index: join(SRC, "index.ts") }, formats: ["es"] },
    rolldownOptions: {
      external: isExternal,
      output: {
        preserveModules: true,
        preserveModulesRoot: SRC,
        entryFileNames: "[name].js",
        assetFileNames: (asset) => (asset.names?.[0]?.endsWith(".css") ? "incredicard.css" : "assets/[name]-[hash][extname]"),
      },
    },
  },
});

// The same for the fonts and images the stylesheet's url() pulled in:
// library mode inlined them as data: URIs, so each becomes a file beside
// the stylesheet.
const EXTENSIONS = { "font/woff2": "woff2", "font/woff": "woff", "image/svg+xml": "svg", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
function extractInlinedAssets(cssFile) {
  let css = readFileSync(cssFile, "utf8");
  mkdirSync(join(DIST, "assets"), { recursive: true });
  css = css.replace(/url\("?data:([a-z0-9+/.-]+);base64,([A-Za-z0-9+/=]+)"?\)/g, (match, mime, data) => {
    const extension = EXTENSIONS[mime];
    if (!extension) return match;
    const bytes = Buffer.from(data, "base64");
    const name = `inline-${createHash("sha256").update(bytes).digest("hex").slice(0, 12)}.${extension}`;
    writeFileSync(join(DIST, "assets", name), bytes);
    return `url("./assets/${name}")`;
  });
  // An SVG is inlined URL-encoded rather than as base64.
  css = css.replace(/url\("data:image\/svg\+xml,([^"]*)"\)/g, (_, encoded) => {
    const bytes = Buffer.from(decodeURIComponent(encoded), "utf8");
    const name = `inline-${createHash("sha256").update(bytes).digest("hex").slice(0, 12)}.svg`;
    writeFileSync(join(DIST, "assets", name), bytes);
    return `url("./assets/${name}")`;
  });
  writeFileSync(cssFile, css);
}
extractInlinedAssets(join(DIST, "incredicard.css"));

// The fonts ship inside the package, so their licenses do too.
mkdirSync(join(DIST, "licenses"), { recursive: true });
for (const name of readdirSync(join(SRC, "assets/fonts"))) {
  if (name.endsWith(".txt")) cpSync(join(SRC, "assets/fonts", name), join(DIST, "licenses", name));
}

execFileSync("npx", ["tsc", "-p", "tsconfig.build.json"], { cwd: ROOT, stdio: "inherit" });

console.log(`Built ${relative(process.cwd(), DIST) || "dist"}.`);
