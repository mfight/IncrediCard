import type { StorybookConfig } from "@storybook/react-vite";
import remarkGfm from "remark-gfm";

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(ts|tsx)"],
  addons: [
    "@storybook/addon-a11y",
    // Runs stories as Vitest tests; see vitest.storybook.config.ts.
    "@storybook/addon-vitest",
    // remark-gfm: GitHub-flavored Markdown in MDX, so tables render as
    // tables instead of raw pipe text.
    {
      name: "@storybook/addon-docs",
      options: {
        mdxPluginOptions: {
          mdxCompileOptions: {
            remarkPlugins: [remarkGfm],
          },
        },
      },
    },
  ],
  framework: "@storybook/react-vite",
};
export default config;
