import "./preview.css";

import type { Preview } from "@storybook/react-vite";

const preview: Preview = {
  parameters: {
    // addon-a11y's axe checks run in every story test
    // (npm run test:storybook) and in the Storybook Test panel. "error"
    // fails the story that introduced a violation.
    a11y: {
      test: "error",
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    options: {
      // Overview first, then the stories in the order the file declares
      // them. A declarative `order` can't express this: the stories' title
      // is "IncrediCard" with the story name as the leaf, while the docs
      // page's title is "IncrediCard/Overview". Storybook extracts this
      // function's source and evaluates it on its own, so it can't use
      // anything declared outside it.
      storySort: (a, b) => {
        const leaf = (entry) => (entry.type === "docs" ? entry.title.split("/").pop() : entry.name);
        if (leaf(a) === "Overview") return -1;
        if (leaf(b) === "Overview") return 1;
        return 0;
      },
    },
  },
};

export default preview;
