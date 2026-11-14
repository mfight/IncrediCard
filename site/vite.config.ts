// The landing page at the site root (incredicard.markfight.com/). It renders
// the component from src/ through its public API, the way an app would. The
// Storybook is built separately into site-dist/storybook/; see pages.yml.
//
//   npm run site          dev server
//   npm run build-site    builds into site-dist/

import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root,
  publicDir: false,
  css: { modules: { generateScopedName: "[local]-[hash:base64:5]" } },
  server: { port: Number(process.env.PORT) || 6007 },
  build: {
    outDir: fileURLToPath(new URL("../site-dist", import.meta.url)),
    emptyOutDir: true,
  },
});
