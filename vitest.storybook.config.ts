import { defineConfig } from "vitest/config";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { fileURLToPath } from "node:url";

// Runs every Storybook story as a test (npm run test:storybook), a
// second config beside vitest.config.ts (unit tests in Node), because
// stories need a real browser and unit tests don't.
//
// Each story renders in real Chromium through Playwright, not jsdom, so a
// story passes only if it renders without throwing and its `play`
// function (if any) passes. The storybookTest plugin also runs
// @storybook/addon-a11y's axe checks per story; preview.tsx sets
// `a11y.test: "error"`, so a violation fails the story.
//
// The plugin reads .storybook/main.ts for the story globs and applies
// .storybook/preview.tsx's decorators, parameters and globals itself--no
// setup file with setProjectAnnotations is needed.
export default defineConfig({
  plugins: [
    storybookTest({
      configDir: fileURLToPath(new URL("./.storybook", import.meta.url)),
      // Links each result to its story when Storybook is running locally.
      storybookScript: "npm run storybook -- --no-open",
    }),
  ],
  test: {
    name: "storybook",
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
  },
});
