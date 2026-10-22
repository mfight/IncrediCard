import { defineConfig } from "vitest/config";

// Unit tests (npm test): every *.test.ts outside the browser, in Node.
// Stories run as tests separately, in real Chromium
// (vitest.storybook.config.ts, npm run test:storybook).
export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["**/node_modules/**", "dist/**", "scss/**", "storybook-static/**", "tests/visual/**"],
  },
});
