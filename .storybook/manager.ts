// Storybook's own interface (the sidebar, toolbar and panels around the
// stories) in the landing page's look: its card icon and wordmark at the top
// of the sidebar, linking back to the site, and its colors and typeface.
//
// Light uses the landing page's own colors. Dark keeps Storybook's own dark
// grays, with the navy of the landing page's hero for its lines and two
// blues where light needs one: no single blue is both dark enough behind
// white text and light enough as text on the gray. Which one loads
// follows the system's light or dark setting when Storybook opens.
//
// The stories and docs pages themselves render in the preview, which this
// doesn't touch.

import { addons } from "storybook/manager-api";
import { create } from "storybook/theming";

const SITE_URL = "https://incredicard.dev/";

// Declared in manager-head.html, from the font file staticDirs serves.
const FONT = '"IncrediCard Site Figtree", system-ui, -apple-system, "Segoe UI", sans-serif';

// The landing header's card icon and wordmark. Storybook renders the title as
// HTML inside its logo link, which already carries the link's color.
const BRAND = `<span style="display: inline-flex; align-items: center; gap: 0.5rem; font-family: ${FONT.replaceAll('"', "'")}; font-size: 1.125rem; font-weight: 750; letter-spacing: -0.03em;">
  <svg viewBox="0 0 24 24" width="20" height="20" style="width: 1.25rem; height: 1.25rem;" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2.75" y="5.25" width="18.5" height="13.5" rx="2" />
    <path d="M2.75 9.5h18.5" />
  </svg>
  IncrediCard
</span>`;

const shared = {
  brandTitle: BRAND,
  brandUrl: SITE_URL,
  brandTarget: "_self",
  fontBase: FONT,
  fontCode: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  appBorderRadius: 8,
  inputBorderRadius: 6,
};

const light = create({
  base: "light",
  ...shared,
  colorPrimary: "#1a4fd6",
  colorSecondary: "#1a4fd6",
  appBg: "#fbfbf8",
  appContentBg: "#ffffff",
  appPreviewBg: "#ffffff",
  appBorderColor: "#e2e2dc",
  textColor: "#1c1f29",
  textInverseColor: "#ffffff",
  textMutedColor: "#5d6372",
  barBg: "#fbfbf8",
  barTextColor: "#5d6372",
  barHoverColor: "#1a4fd6",
  barSelectedColor: "#1a4fd6",
  inputBg: "#ffffff",
  inputBorder: "#e2e2dc",
  inputTextColor: "#1c1f29",
});

const dark = create({
  base: "dark",
  ...shared,
  colorPrimary: "#6d98f8",
  // The selected story's fill, behind white text (4.69:1).
  colorSecondary: "#2f6bf0",
  // Storybook's own dark grays, with the hero's navy kept for the lines.
  appBg: "#1b1c1d",
  appContentBg: "#222325",
  appPreviewBg: "#ffffff",
  appBorderColor: "#1e2c5e",
  textColor: "#ffffff",
  textInverseColor: "#1b1c1d",
  textMutedColor: "#c9d6f5",
  barBg: "#222325",
  barTextColor: "#c9d6f5",
  // Toolbar icons and the selected panel tab are drawn in these, as text on
  // the gray (5.62:1 or better).
  barHoverColor: "#6d98f8",
  barSelectedColor: "#6d98f8",
  inputBg: "#1b1c1d",
  inputBorder: "#1e2c5e",
  inputTextColor: "#ffffff",
});

const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

addons.setConfig({ theme: prefersDark ? dark : light });
