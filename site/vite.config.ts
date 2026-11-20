// The landing page at the site root (incredicard.dev/). It renders
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
  // site/public/ is copied to the site root as is: the share image, which
  // social previews fetch by its full URL.
  publicDir: "public",
  css: { modules: { generateScopedName: "[local]-[hash:base64:5]" } },
  server: { port: Number(process.env.PORT) || 6007 },
  build: {
    outDir: fileURLToPath(new URL("../site-dist", import.meta.url)),
    emptyOutDir: true,
  },
});
