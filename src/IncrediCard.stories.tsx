import { Fragment, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
// Imported from the index, not the component module: the index is where
// the compound namespace is composed, and it has to be.
import {
  IncrediCard,
  extendIncrediCardTheme,
  requestIncrediCardMotionAccess,
  type IncrediCardMotionAccess,
} from ".";
import { demoAcceptanceMarks } from "../demo/acceptanceMarks";
import { engravedCardTheme } from "../demo/themes/engravedCard";
import globeFoil from "./assets/images/incredicard-lines-globe.svg";
import globeMaskA from "./assets/images/incredicard-lines-globe-a.svg";
import globeMaskB from "./assets/images/incredicard-lines-globe-b.svg";
import { ForceReducedMotion } from "./reducedMotion";
import { INCREDICARD_THEMES } from "./themes";
import themedStyles from "./IncrediCard.stories.module.scss";

// `reducedMotion` is a STORY arg, not a component prop -- it forces the
// reduced-motion condition on so anyone can see that appearance without
// changing an OS setting (see reducedMotion/reduced-motion.scss for why it
// cannot simply be faked). Widening the meta's arg type is what makes a
// non-prop arg type-check.
type IncrediCardStoryArgs = React.ComponentProps<typeof IncrediCard> & {
  reducedMotion?: boolean;
};

// The forcing itself lives in src/reducedMotion/ForceReducedMotion.tsx;
// only this three-line Decorator is local, which keeps Storybook's types
// out of the library's source.
const withReducedMotion: Decorator = (Story, context) => (
  <ForceReducedMotion on={Boolean(context.args.reducedMotion)}>
    <Story />
  </ForceReducedMotion>
);

// Storybook hands every arg to the component as a prop, so the story-only
// `reducedMotion` arg is taken out first. Left in, it reaches the card's
// root element and React warns about an unknown DOM attribute.
function cardProps({ reducedMotion: _reducedMotion, ...props }: IncrediCardStoryArgs) {
  return props;
}

const meta = {
  title: "IncrediCard",
  component: IncrediCard,
  render: (args) => <IncrediCard {...cardProps(args)} />,
  // Every story shows the demo's acceptance marks, which the package
  // doesn't ship (see demo/acceptanceMarks.ts), passed in the way an app
  // passes its own.
  args: { acceptanceMarks: demoAcceptanceMarks },
  parameters: {
    layout: "centered",
  },
  argTypes: {
    // Image URLs, not something to edit in a control.
    acceptanceMarks: {
      control: false,
    },
    fieldSize: {
      control: "select",
      options: ["sm", "md", "lg", "xl"],
    },
    textTone: {
      control: "select",
      options: ["light", "dark"],
    },
    theme: {
      control: "select",
      // Every theme themes.ts declares, so a new one appears here too.
      options: Object.keys(INCREDICARD_THEMES),
    },
    chipReflection: {
      control: "boolean",
    },
    holographic: {
      control: "boolean",
    },
    // The Effects story relies on these controls as the way to toggle an
    // effect. Storybook would infer a boolean control from the prop type,
    // but declaring them keeps all four effects grouped and labeled the
    // same way rather than relying on inference.
    tilt: {
      control: "boolean",
    },
    scale: {
      control: "boolean",
    },
    layout: {
      control: "select",
      options: ["overlay", "stacked"],
    },
    reducedMotion: {
      control: "boolean",
      name: "reducedMotion (story only)",
      description:
        "Forces this component's reduced-motion appearance on, without changing your OS setting. Not a component prop -- real users get the real `prefers-reduced-motion` media query.",
    },
  },
} satisfies Meta<IncrediCardStoryArgs>;

export default meta;
// `StoryObj<IncrediCardStoryArgs>` rather than `StoryObj<typeof meta>`:
// the latter infers its args from the meta's `component`, which would
// exclude the story-only `reducedMotion` arg no matter what the meta is
// declared to satisfy.
type Story = StoryObj<IncrediCardStoryArgs>;

// The default layout: "overlay", where the real fields live directly on
// the card itself (IncrediCardEmbeddedFace), positioned where a physical
// card's embossed text sits, instead of a separate decorative card above
// a normal field list. No `layout` arg here on purpose: this story shows
// what a plain `<IncrediCard id="..." />` renders, with the demo's marks.
//
// An empty card: only the number field exists until a valid number
// reveals the rest, and it already sits in the position it will keep
// once it does (no jump on reveal; see the placeholder-row comment in
// IncrediCardEmbeddedFace). Every field's validation and
// network-detection behavior is identical to the "stacked" stories; only
// where the fields visually live differs.
export const Default: Story = {
  args: { id: "story-default" },
};

// The other layout: a purely decorative card (IncrediCardFace) above a
// normal, fully labeled field list. Passed explicitly, as every story
// that wants it must, since the component's default is "overlay".
export const StackedDefault: Story = {
  name: "Stacked: Default",
  args: { id: "story-stacked", layout: "stacked" },
};

// 4242424242424242: a widely published Visa test number, valid enough to
// pass the Luhn and length checks and demonstrate the "valid" state
// without anyone's actual card.
export const StackedFilled: Story = {
  name: "Stacked: Filled",
  args: {
    id: "story-filled",
    layout: "stacked",
    defaultValue: {
      cardholderName: "Alex Rivera",
      cardNumber: "4242424242424242",
      expirationMonth: "12",
      expirationYear: "29",
      cvc: "123",
    },
  },
};

// One story per supported network, in the same alphabetical order the
// sidebar shows them. Each `name` is set explicitly so they group under
// a shared "Network:" prefix rather than sorting by export name.
//
// Every number below detects as the network it claims (per
// `detectCardNetwork`), passes `luhnCheck`, AND has one of that network's
// lengths, which is what the card requires before it will reveal.
//
// Amex is the one with the most structural differences to demonstrate:
// 4-6-5 number grouping, a 4-digit CVC, and that CVC printed on the FRONT
// of the card rather than the back. Diners Club's 14-digit number groups
// 4-6-4. The rest share the neutral shape, so what they demonstrate is
// detection itself, and their acceptance mark. The last, "without a mark",
// shows what an app that supplies no marks gets.

export const NetworkAmex: Story = {
  name: "Network: AMEX",
  args: {
    id: "story-amex",
    defaultValue: {
      cardholderName: "Alex Rivera",
      cardNumber: "378282246310005",
      expirationMonth: "12",
      expirationYear: "29",
      cvc: "1234",
    },
  },
};

export const NetworkDinersClub: Story = {
  name: "Network: Diners Club",
  args: {
    id: "story-dinersclub",
    defaultValue: {
      cardholderName: "Alex Rivera",
      cardNumber: "30569309025904",
      expirationMonth: "12",
      expirationYear: "29",
      cvc: "123",
    },
  },
};

export const NetworkDiscover: Story = {
  name: "Network: Discover",
  args: {
    id: "story-discover",
    defaultValue: {
      cardholderName: "Alex Rivera",
      cardNumber: "6011111111111117",
      expirationMonth: "12",
      expirationYear: "29",
      cvc: "123",
    },
  },
};

export const NetworkJcb: Story = {
  name: "Network: JCB",
  args: {
    id: "story-jcb",
    defaultValue: {
      cardholderName: "Alex Rivera",
      cardNumber: "3530111333300000",
      expirationMonth: "12",
      expirationYear: "29",
      cvc: "123",
    },
  },
};

export const NetworkMaestro: Story = {
  name: "Network: Maestro",
  args: {
    id: "story-maestro",
    defaultValue: {
      cardholderName: "Alex Rivera",
      cardNumber: "6700000000000000",
      expirationMonth: "12",
      expirationYear: "29",
      cvc: "123",
    },
  },
};

export const NetworkMastercard: Story = {
  name: "Network: Mastercard",
  args: {
    id: "story-mastercard",
    defaultValue: {
      cardholderName: "Alex Rivera",
      cardNumber: "5555555555554444",
      expirationMonth: "12",
      expirationYear: "29",
      cvc: "123",
    },
  },
};

export const NetworkUnionPay: Story = {
  name: "Network: UnionPay",
  args: {
    id: "story-unionpay",
    defaultValue: {
      cardholderName: "Alex Rivera",
      cardNumber: "6200000000000005",
      expirationMonth: "12",
      expirationYear: "29",
      cvc: "123",
    },
  },
};

export const NetworkVisa: Story = {
  name: "Network: Visa",
  args: {
    id: "story-visa",
    defaultValue: {
      cardholderName: "Alex Rivera",
      cardNumber: "4242424242424242",
      expirationMonth: "12",
      expirationYear: "29",
      cvc: "123",
    },
  },
};

// An app that supplies no acceptance marks: the corner names the network
// in text instead. American Express, the longest name, wraps onto two
// lines.
export const NetworkWithoutMark: Story = {
  name: "Network: Without a Mark",
  args: {
    id: "story-without-mark",
    acceptanceMarks: {},
    defaultValue: {
      cardholderName: "Alex Rivera",
      cardNumber: "378282246310005",
      expirationMonth: "12",
      expirationYear: "29",
      cvc: "1234",
    },
  },
};

export const StackedDisabled: Story = {
  name: "Stacked: Disabled",
  args: {
    id: "story-disabled",
    layout: "stacked",
    disabled: true,
    defaultValue: {
      cardholderName: "Alex Rivera",
      cardNumber: "4242424242424242",
      expirationMonth: "12",
      expirationYear: "29",
      cvc: "123",
    },
  },
};

// Visual-only busy state for a submission the application owns (see the
// `processing` doc comment in IncrediCard.tsx); this component has no
// submission flow of its own to pause.
export const Processing: Story = {
  decorators: [withReducedMotion],
  args: {
    id: "story-processing",
    processing: true,
    defaultValue: {
      cardholderName: "Alex Rivera",
      cardNumber: "4242424242424242",
      expirationMonth: "12",
      expirationYear: "29",
      cvc: "123",
    },
  },
};

// A "narrow layout" example would be redundant: every other story
// renders at the "stacked" layout's narrowest supported width, since
// Storybook's `layout: "centered"` parameter doesn't stretch its subject
// wide enough to reach the row-layout switch. This story is wide enough
// (`themedStyles.wideWrapper`, 720px) to cross the `@container
// (min-width: 640px)` threshold and show the card and field column side
// by side.
export const StackedSideBySide: Story = {
  name: "Stacked: Side By Side",
  args: {
    id: "story-side-by-side",
    layout: "stacked",
    defaultValue: {
      cardholderName: "Alex Rivera",
      cardNumber: "4242424242424242",
      expirationMonth: "12",
      expirationYear: "29",
      cvc: "123",
    },
  },
  render: (args) => (
    <div className={themedStyles.wideWrapper}>
      <IncrediCard {...cardProps(args)} />
    </div>
  ),
};

// theme="vintage": OCR-A (the name) and OCR-B (the number, expiration,
// and CVC) on an aged-ivory card face, with an embossed text-shadow
// treatment standing in for a real card's raised plastic; see the
// "vintage" theme in themes.ts. A filled value
// shows the effect on real digits and letters rather than placeholder
// text.
export const VintageStacked: Story = {
  name: "Vintage: Stacked",
  args: {
    id: "story-vintage",
    layout: "stacked",
    theme: "vintage",
    defaultValue: {
      cardholderName: "Alex Rivera",
      cardNumber: "4242424242424242",
      expirationMonth: "12",
      expirationYear: "29",
      cvc: "123",
    },
  },
};

// The same "vintage" theme with layout="overlay": the embossed OCR fonts
// apply identically to the real on-card fields, not just to the
// "stacked" layout's decorative mirror.
export const VintageOverlay: Story = {
  name: "Vintage: Overlay",
  args: {
    id: "story-vintage-overlay",
    theme: "vintage",
    layout: "overlay",
    defaultValue: {
      cardholderName: "Alex Rivera",
      cardNumber: "4242424242424242",
      expirationMonth: "12",
      expirationYear: "29",
      cvc: "123",
    },
  },
};

// theme="atlas": "modern"'s card and type, printed with an engraved globe
// instead of ribbons (see the "atlas" theme in themes.ts and its art in
// lineArt.ts). Holographic, since the foil is what the line art is for:
// move the pointer across the card to light the land and the sphere's
// rings separately.
export const AtlasOverlay: Story = {
  name: "Atlas: Overlay",
  args: {
    id: "story-atlas-overlay",
    theme: "atlas",
    layout: "overlay",
    holographic: true,
    defaultValue: {
      cardholderName: "Alex Rivera",
      cardNumber: "4242424242424242",
      expirationMonth: "12",
      expirationYear: "29",
      cvc: "123",
    },
  },
};

export const AtlasStacked: Story = {
  name: "Atlas: Stacked",
  args: {
    id: "story-atlas",
    theme: "atlas",
    layout: "stacked",
    holographic: true,
    defaultValue: {
      cardholderName: "Alex Rivera",
      cardNumber: "4242424242424242",
      expirationMonth: "12",
      expirationYear: "29",
      cvc: "123",
    },
  },
};

// theme="glass": the page behind the card shows through, so these stories
// give it a page worth seeing, with hard edges for the frost and refraction
// to act on. Move the pointer across the card for the highlight. Refraction
// shows in Chromium; Safari gets the same glass without it.
const onGlassBackdrop: Decorator = (Story) => (
  <div className={themedStyles.glassBackdrop}>
    <Story />
  </div>
);

const GLASS_VALUE = {
  cardholderName: "Alex Rivera",
  cardNumber: "4242424242424242",
  expirationMonth: "12",
  expirationYear: "29",
  cvc: "123",
};

export const GlassOverlay: Story = {
  name: "Glass: Overlay",
  decorators: [onGlassBackdrop],
  args: { id: "story-glass-overlay", theme: "glass", layout: "overlay", defaultValue: GLASS_VALUE },
};

export const GlassStacked: Story = {
  name: "Glass: Stacked",
  decorators: [onGlassBackdrop],
  args: { id: "story-glass", theme: "glass", layout: "stacked", defaultValue: GLASS_VALUE },
};

// An app's own theme: `modern` with a different material and its own line art,
// passed as files rather than a name.
export const CustomTheme: Story = {
  name: "Custom Theme",
  args: {
    id: "story-custom-theme",
    theme: extendIncrediCardTheme("modern", {
      face: {
        background: "linear-gradient(135deg, #0b3b3c, #14532d)",
        linesOpacity: 0.16,
      },
      lineArt: { foil: globeFoil, maskA: globeMaskA, maskB: globeMaskB },
    }),
    layout: "overlay",
    holographic: true,
    defaultValue: {
      cardholderName: "Alex Rivera",
      cardNumber: "4242424242424242",
      expirationMonth: "12",
      expirationYear: "29",
      cvc: "123",
    },
  },
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector<HTMLElement>("[style*='--incredicard-face-background']");
    await expect(root).not.toBeNull();
    await expect(root?.hasAttribute("data-theme")).toBe(false);
    const style = getComputedStyle(root as HTMLElement);
    await expect(style.getPropertyValue("--incredicard-face-background")).toContain("linear-gradient");
    await expect(style.getPropertyValue("--incredicard-lines")).toContain("globe");
  },
};

// What a custom theme is for: an issuer's own printed card, with no foil. The
// face is the issuer's artwork, and the fields sit on it in dark text.
export const CustomThemeEngravedCard: Story = {
  name: "Custom Theme: Engraved Card",
  args: {
    id: "story-custom-theme-engraved",
    theme: engravedCardTheme,
    // The demo's marks are white, for dark cards. An app would pass dark ones
    // here; without any, the network's name prints in the theme's dark text.
    acceptanceMarks: undefined,
    layout: "overlay",
    defaultValue: {
      cardholderName: "Alex Rivera",
      cardNumber: "378282246310005",
      expirationMonth: "12",
      expirationYear: "29",
      cvc: "1234",
    },
  },
};

// Dark text, for a bright page. An empty card, for the placeholder, which is
// the faintest text it has.
export const GlassDarkText: Story = {
  name: "Glass: Dark Text on a White Page",
  args: { id: "story-glass-white", theme: "glass", textTone: "dark", layout: "overlay" },
};

// Dark text, filled in, on a page with color in it. The demo's marks are white,
// so an app would pass dark ones here; this one leaves them out to show the
// network's name, which follows the text.
export const GlassDarkTextFilled: Story = {
  name: "Glass: Dark Text, Filled",
  render: (args) => (
    <div style={{ padding: "3rem", background: "linear-gradient(120deg, #fde68a, #fbcfe8 50%, #bfdbfe)" }}>
      <IncrediCard {...cardProps(args)} />
    </div>
  ),
  args: {
    id: "story-glass-dark-filled",
    theme: "glass",
    textTone: "dark",
    layout: "overlay",
    acceptanceMarks: {},
    defaultValue: GLASS_VALUE,
  },
};

// Told what's behind it, so browsers that can't bend the live page bend a copy
// at the rim. Chromium looks the same as Glass: Overlay; open this in Safari to
// see the difference.
const KNOWN_BACKDROP =
  "repeating-linear-gradient(115deg, rgb(255 255 255 / 16%) 0 0.5rem, rgb(255 255 255 / 0%) 0.5rem 2.5rem), linear-gradient(120deg, #0f172a, #312e81 50%, #134e4a)";

function OnKnownBackdrop(args: IncrediCardStoryArgs) {
  const page = useRef<HTMLDivElement>(null);
  return (
    <div ref={page} data-testid="known-backdrop" style={{ padding: "3rem", background: KNOWN_BACKDROP }}>
      <IncrediCard {...cardProps(args)} glassBackdrop={{ element: page, background: KNOWN_BACKDROP }} />
    </div>
  );
}

// Tilt is on, and the button is here, because the copy's risk is how it moves:
// on iOS the card hears no device tilt until something asks for motion access.
function KnownBackdropDemo(args: IncrediCardStoryArgs) {
  const [access, setAccess] = useState<IncrediCardMotionAccess | null>(null);
  return (
    <>
      <OnKnownBackdrop {...args} />
      <div className={themedStyles.motionActions}>
        <button
          type="button"
          className={themedStyles.storyButton}
          onClick={() => {
            // Called straight from the handler, as in the DeviceTilt story.
            void requestIncrediCardMotionAccess().then(setAccess);
          }}
        >
          Allow motion access
        </button>
        {access ? (
          <span className={themedStyles.motionStatus} data-access={access}>
            {access}
          </span>
        ) : null}
      </div>
    </>
  );
}

export const GlassKnownBackdrop: Story = {
  name: "Glass: With a Known Backdrop",
  render: (args) => <KnownBackdropDemo {...args} />,
  args: {
    id: "story-glass-known",
    theme: "glass",
    layout: "overlay",
    defaultValue: GLASS_VALUE,
    tilt: true,
    chipReflection: true,
  },
};

// The copy's wiring, on both faces: lined up with the app's element, hidden
// in Chromium, which bends the live page, and carrying the card's own filter.
export const GlassBackdropCopyWiring: Story = {
  tags: ["!dev"],
  render: (args) => <OnKnownBackdrop {...args} />,
  args: { id: "story-glass-copy", theme: "glass", layout: "overlay", defaultValue: GLASS_VALUE },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement).getByTestId("known-backdrop").getBoundingClientRect();
    const images = [...canvasElement.querySelectorAll<HTMLElement>('[class*="_image_"]')];
    await expect(images).toHaveLength(2);
    for (const image of images) {
      await expect(parseFloat(image.style.width)).toBeCloseTo(page.width, 1);
      await expect(parseFloat(image.style.height)).toBeCloseTo(page.height, 1);
      await expect(getComputedStyle(image.parentElement!).filter).toContain("url(");
      await expect(getComputedStyle(image.parentElement!.parentElement!).display).toBe("none");
    }
  },
};

// A theme that doesn't refract has no use for a copy.
export const NoBackdropCopyOnOpaqueThemes: Story = {
  tags: ["!dev"],
  render: (args) => <OnKnownBackdrop {...args} />,
  args: { id: "story-modern-copy", theme: "modern", layout: "overlay", defaultValue: GLASS_VALUE },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[class*="_image_"]')).toBeNull();
  },
};

// The glass's wiring: both faces have the backdrop, Chromium keeps the
// refraction ahead of it, the filter it refers to exists in the document,
// and the other themes have none of this.
export const GlassBackdropWiring: Story = {
  tags: ["!dev"],
  decorators: [onGlassBackdrop],
  args: { id: "story-glass-wiring", theme: "glass", layout: "overlay", defaultValue: GLASS_VALUE },
  play: async ({ canvasElement }) => {
    const faces = [...canvasElement.querySelectorAll('[class*="face"]')].filter(
      (element) => getComputedStyle(element).backdropFilter !== "none",
    );
    await expect(faces).toHaveLength(2);
    for (const face of faces) {
      const { backdropFilter } = getComputedStyle(face);
      await expect(backdropFilter).toContain("blur");
      const id = backdropFilter.match(/url\("?#([^")]+)"?\)/)?.[1];
      await expect(id).toBeTruthy();
      const filter = canvasElement.ownerDocument.getElementById(id!);
      await expect(filter?.tagName.toLowerCase()).toBe("filter");
      // One bend per color channel, each its own strength, for the fringe.
      const scales = [...filter!.querySelectorAll("feDisplacementMap")].map((map) => map.getAttribute("scale"));
      await expect(new Set(scales).size).toBe(3);
      const rim = face.querySelector<HTMLElement>('[class*="rim"]');
      await expect(rim).not.toBeNull();
      // The resting rim gives way while the light is tracking, so the sheen
      // moves rather than adding to fixed highlights.
      await expect(getComputedStyle(rim!).opacity).toBe("1");
      (face as HTMLElement).style.setProperty("--incredicard-chip-light-active", "1");
      await waitFor(() => expect(getComputedStyle(rim!).opacity).toBe("0.25"));
      (face as HTMLElement).style.removeProperty("--incredicard-chip-light-active");
    }
  },
};

export const NoBackdropOnOpaqueThemes: Story = {
  tags: ["!dev"],
  args: { id: "story-no-backdrop", theme: "modern", layout: "overlay" },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("feDisplacementMap")).toBeNull();
    await expect(canvasElement.querySelector('[class*="rim"]')).toBeNull();
    for (const element of canvasElement.querySelectorAll('[class*="face"]')) {
      await expect(getComputedStyle(element).backdropFilter).toBe("none");
    }
  },
};

// A pre-filled security code in a web font can show empty boxes instead of
// its mask in WebKit, which this suite doesn't run in, so this holds the rule
// that avoids it: the masked field uses system fonts, in every theme.
export const MaskedFieldUsesSystemFonts: Story = {
  tags: ["!dev"],
  render: (args) => (
    <>
      {Object.keys(INCREDICARD_THEMES).map((theme) => (
        <IncrediCard
          {...cardProps(args)}
          key={theme}
          id={`story-mask-${theme}`}
          theme={theme as keyof typeof INCREDICARD_THEMES}
        />
      ))}
    </>
  ),
  args: { layout: "overlay", defaultValue: GLASS_VALUE },
  play: async ({ canvasElement }) => {
    const fields = [...canvasElement.querySelectorAll<HTMLInputElement>('input[type="password"]')];
    await expect(fields).toHaveLength(Object.keys(INCREDICARD_THEMES).length);
    for (const field of fields) {
      await expect(field.value).toBe("123");
      await expect(getComputedStyle(field).fontFamily).not.toContain("IncrediCard");
    }
  },
};

// Everything this component animates, with reduced motion forced ON --
// the state a user gets from the OS-level "reduce motion" setting,
// without needing to change that setting to see it.
//
// Toggle the `reducedMotion (story only)` control to compare against the
// same card with motion allowed. What should change, and what should not:
//
//   * The card stops flipping on its processing loop, and does NOT snap
//     between faces instead -- the loop is skipped, not merely
//     un-animated.
//   * The spinner is hidden (one that cannot spin is decoration, not
//     activity), and a slow opacity pulse carries the busy state instead.
//     The "Processing…" label stays.
//   * The hologram stops shimmering and renders a static view of its real
//     colors, rather than holding a frozen mid-animation frame.
//   * Tilt and the chip reflection stop tracking the pointer entirely.
//   * Nothing about the card's STATE changes: it is still processing,
//     still read-only, still dimmed, and every field still holds its
//     value. Reduced motion removes movement, never information.
//
// The forcing here is a story-only affordance. It works by setting an
// attribute that every one of this component's reduced-motion rules also
// keys off (see reducedMotion/reduced-motion.scss), so the two cannot
// drift apart -- a rule added to the media query is by construction in
// this path too. Real users only ever hit the real media query.
export const ReducedMotion: Story = {
  decorators: [withReducedMotion],
  args: {
    id: "story-reduced-motion",
    reducedMotion: true,
    processing: true,
    holographic: true,
    tilt: true,
    scale: true,
    chipReflection: true,
    defaultValue: {
      cardholderName: "Alex Rivera",
      cardNumber: "4242424242424242",
      expirationMonth: "12",
      expirationYear: "29",
      cvc: "123",
    },
  },
};

// Every effect this component offers, all on at once, with the Storybook
// controls as the way to turn any of them off. One story rather than one
// per effect: stories that each differ by a single boolean make the
// sidebar longer without making any effect easier to understand, and
// never show how the effects read together.
//
// All on in this story, deliberately, so a reader sees what the component
// can do rather than having to discover it. The legend below names the
// prop behind each effect, so what is on screen maps to something you can
// pass, and says plainly that they are independent.
//
// `holographic` and `tilt` both track the pointer, so with both on it can
// be hard to attribute a given movement to one or the other. That is
// exactly what you will see with both enabled, which a one-effect-at-a-
// time story wouldn't show.
//
// Device tilt is part of each effect rather than a separate opt-in prop,
// which is why there is no fifth entry naming it. See the DeviceTilt
// story below for the one thing you do have to know: the component never
// asks for orientation permission itself.
const EFFECTS: Array<{ prop: string; description: string }> = [
  {
    prop: "holographic",
    description:
      "A rainbow-foil pattern behind the card's printed content, with a holographic reflection effect that follows the pointer. Follows device tilt on touch devices.",
  },
  {
    prop: "tilt",
    description:
      "The card rotates in 3D following the pointer. Composed with flip, so tilting and flipping animate as one single motion. Follows device tilt on touch devices.",
  },
  {
    prop: "scale",
    description:
      "The card grows when clicked or when a credit card input field takes focus. Uses a transform to prevent reflowing surrounding content.",
  },
  {
    prop: "chipReflection",
    description:
      "The chip catches the light from the pointer's direction. Follows device tilt on touch devices.",
  },
];

export const Effects: Story = {
  decorators: [withReducedMotion],
  args: {
    id: "story-effects",
    holographic: true,
    tilt: true,
    scale: true,
    chipReflection: true,
  },
  render: (args) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <IncrediCard {...cardProps(args)} />
      <div className={themedStyles.effectsLegend}>
        <p className={themedStyles.effectsLegendIntro}>
          All four effects are on. Each is an independent prop — use the
          controls to turn any of them off.
        </p>
        <dl className={themedStyles.effectsLegendList}>
          {EFFECTS.map((effect) => (
            <Fragment key={effect.prop}>
              <dt className={themedStyles.effectsLegendTerm}>{effect.prop}</dt>
              <dd className={themedStyles.effectsLegendDescription}>
                {effect.description}
              </dd>
            </Fragment>
          ))}
        </dl>
        <p className={themedStyles.effectsLegendNote}>
          All four are decorative and none is required. Every one of them
          reduces to a still, non-animated state under{" "}
          <code>prefers-reduced-motion</code>.
        </p>
      </div>
    </div>
  ),
};

// The DeviceTilt story exists for the one thing about this feature that
// is not visible by looking at the card: the component never asks for
// orientation permission. It cannot, safely -- iOS's prompt is one shot
// and remembered per origin, so asking from inside a credit-card form
// would spend it on the tap that opens the keyboard. Your app asks once,
// early (at first sign-in, say), instead, and the story's button stands
// in for that call so the effect is reachable here at all.
//
// Deliberately not a decorator on the Effects story above: a control that
// triggers an OS permission prompt should never fire from merely opening
// a story.
//
// The DeviceTilt story's live readout. When the card seems not to respond
// on one axis, there is no way to tell a wrong sign, a dead sensor axis,
// and a gesture that simply cannot reach its range apart by looking at
// the card.
//
// So this reports BOTH sides of the pipeline: the raw sensor reading, and
// the custom properties the component actually wrote. Reading the real
// properties off the card element matters -- a readout that recomputed
// the mapping itself could agree perfectly with a broken component, since
// it would be running the same arithmetic on the same inputs.
//
// `peak` is the load-bearing column. Live values are unreadable while you
// are moving a phone with both hands, so each row also keeps the largest
// magnitude seen since the last reset. Tilt as far as is comfortable in
// each direction, then look: if vertical peaks well short of horizontal,
// the range is wrong for the gesture rather than the wiring being wrong.
function useLiveOrientationReadout(cardRef: React.RefObject<HTMLElement | null>) {
  const [reading, setReading] = useState<{
    beta: number | null;
    gamma: number | null;
    tiltX: string;
    tiltY: string;
    lightX: string;
    lightY: string;
    peakTiltX: number;
    peakTiltY: number;
  } | null>(null);

  useEffect(() => {
    let peakTiltX = 0;
    let peakTiltY = 0;
    let frame = 0;
    let latest: DeviceOrientationEvent | null = null;

    function handle(event: DeviceOrientationEvent) {
      // Coalesce to one render per frame. `deviceorientation` fires at
      // roughly 60Hz and this panel is React state, unlike the component
      // itself, which writes custom properties precisely to avoid this.
      //
      // The newest event is stashed rather than closed over, so the
      // reading and the properties beside it describe the same moment.
      // Rendering whichever event happened to SCHEDULE the frame while
      // reading the properties as of when it RAN would be a 16ms skew at
      // 60Hz, small enough to miss, but it could pair a sensor value with
      // a tilt that value did not produce. A readout built to answer "is
      // the signal reaching the card" must not be capable of showing a
      // mismatched pair at all.
      latest = event;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const current = latest;
        if (!current) return;
        // The properties live on the component's internal `.faceWrapper`,
        // which IncrediCard does not expose a ref to. Querying for it is
        // deliberate: this instrument should read whatever element the
        // component really writes to, not an element the story assumes.
        const el = cardRef.current?.querySelector<HTMLElement>('[class*="faceWrapper"]');
        const read = (name: string) => el?.style.getPropertyValue(name) ?? "";
        const tiltX = read("--incredicard-tilt-x");
        const tiltY = read("--incredicard-tilt-y");
        peakTiltX = Math.max(peakTiltX, Math.abs(parseFloat(tiltX) || 0));
        peakTiltY = Math.max(peakTiltY, Math.abs(parseFloat(tiltY) || 0));
        setReading({
          beta: current.beta,
          gamma: current.gamma,
          tiltX,
          tiltY,
          lightX: read("--incredicard-chip-light-x"),
          lightY: read("--incredicard-chip-light-y"),
          peakTiltX,
          peakTiltY,
        });
      });
    }

    window.addEventListener("deviceorientation", handle);
    return () => {
      window.removeEventListener("deviceorientation", handle);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [cardRef]);

  return reading;
}

// The component writes full float precision, which is right for CSS and
// unreadable on a phone -- `11.987151376861924deg` wraps across two lines
// and buries the one digit that matters. Rounded only for display; the
// underlying property is untouched.
function degrees(raw: string): string {
  if (!raw) return "\u2014";
  const value = parseFloat(raw);
  return Number.isNaN(value) ? raw : `${value.toFixed(1)}\u00b0`;
}

// Percentages get the same treatment, for the same reason.
function percent(raw: string): string {
  if (!raw) return "\u2014";
  const value = parseFloat(raw);
  return Number.isNaN(value) ? raw : `${value.toFixed(0)}%`;
}

function DeviceTiltDemo(args: IncrediCardStoryArgs) {
  const [access, setAccess] = useState<IncrediCardMotionAccess | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const reading = useLiveOrientationReadout(cardRef);
  // An external browser value that does not exist on the server, read
  // through useSyncExternalStore rather than an effect writing state
  // (which `react-hooks/set-state-in-effect` rejects, rightly: the effect
  // version renders once with a wrong answer and then again with the real
  // one). `isSecureContext` never changes for a
  // document, so `subscribe` has nothing to subscribe to. The server
  // snapshot is `true` so hydration does not flash a warning about an
  // insecurity the server cannot know about.
  const secure = useSyncExternalStore(
    () => () => {},
    () => window.isSecureContext,
    () => true,
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div ref={cardRef}>
        <IncrediCard {...cardProps(args)} />
      </div>
      <div className={themedStyles.effectsLegend}>
        <p className={themedStyles.effectsLegendIntro}>
          On a phone or tablet, <code>holographic</code>, <code>tilt</code> and{" "}
          <code>chipReflection</code> follow the device instead of a pointer.
          The card responds to however you are already holding it: the first
          reading becomes center, and a small wrist roll moves the effects
          through their full range.
        </p>
        <div className={themedStyles.motionActions}>
          <button
            type="button"
            className={themedStyles.storyButton}
            onClick={() => {
              // Called straight from the handler, with nothing awaited
              // ahead of it. An `await` here would lose user activation
              // and iOS would reject instead of prompting.
              void requestIncrediCardMotionAccess().then(setAccess);
            }}
          >
            Allow motion access
          </button>
          {access ? (
            <span className={themedStyles.motionStatus} data-access={access}>
              {access}
            </span>
          ) : null}
        </div>
        {reading ? (
          <dl className={themedStyles.tiltReadout}>
            <dt>beta / gamma</dt>
            <dd>
              {reading.beta?.toFixed(1) ?? "null"} / {reading.gamma?.toFixed(1) ?? "null"}
            </dd>
            <dt>tilt x / y</dt>
            <dd>
              {degrees(reading.tiltX)} / {degrees(reading.tiltY)}
            </dd>
            <dt>peak |x| / |y|</dt>
            <dd>
              {reading.peakTiltX.toFixed(1)} / {reading.peakTiltY.toFixed(1)}
            </dd>
            <dt>light x / y</dt>
            <dd>
              {percent(reading.lightX)} / {percent(reading.lightY)}
            </dd>
          </dl>
        ) : null}
        <p className={themedStyles.effectsLegendNote}>
          Only iOS Safari prompts; everywhere else this resolves{" "}
          <code>granted</code> without a dialog, and the effects start as soon
          as the sensor reports.{" "}
          {!secure ? (
            <strong>
              This page is not a secure context, so orientation events will
              not fire at all — serve Storybook over HTTPS or a tunnel to try
              this on a real device.
            </strong>
          ) : (
            <>
              Orientation requires a secure context, so a phone pointed at{" "}
              <code>http://</code> on a LAN address will show nothing.
            </>
          )}
        </p>
      </div>
    </div>
  );
}

export const DeviceTilt: Story = {
  decorators: [withReducedMotion],
  args: {
    id: "story-device-tilt",
    holographic: true,
    tilt: true,
    scale: true,
    chipReflection: true,
  },
  render: (args) => <DeviceTiltDemo {...args} />,
};

// Checks for the zoom's viewport fit (IncrediCardZoomFit.ts), one per
// layout. Hidden from the sidebar (`!dev`); they exist for
// `npm run test:storybook`.
//
// Overlay pins the card to the page's top-left corner, where an unfitted
// 1.5x would run off the top and the left. Stacked leaves room above the
// card but none to spare below, where its field sits, so the fit has to
// shift the card up rather than down over the field.
//
// Whatever the test browser's viewport, the zoomed card and its flip
// badge must end up inside it, clear of every edge, and clear of the
// focused field and its label. Where the viewport has room for a real
// zoom, it must also have happened: a fit that "passed" by never zooming
// would prove nothing.
async function expectZoomFits(canvasElement: HTMLElement) {
  const input = within(canvasElement).getByLabelText("Card number");
  input.focus();
  const target = await waitFor(() => {
    const el = canvasElement.querySelector<HTMLElement>(
      '[style*="--incredicard-zoom-scale"]',
    );
    expect(el).not.toBeNull();
    // Settled: the transform has finished its transition to the fit.
    const scale = Number(el!.style.getPropertyValue("--incredicard-zoom-scale"));
    const matrix = new DOMMatrixReadOnly(getComputedStyle(el!).transform);
    expect(Math.abs(matrix.a - scale)).toBeLessThan(0.001);
    return el!;
  });

  const scale = Number(target.style.getPropertyValue("--incredicard-zoom-scale"));
  const inset = parseFloat(getComputedStyle(document.documentElement).fontSize);
  const width = document.documentElement.clientWidth;
  const height = document.documentElement.clientHeight;
  const badge = target.querySelector("[data-incredicard-zoom-overhang]");
  const zoomedRects = [target, badge].flatMap((el) => (el ? [el.getBoundingClientRect()] : []));
  for (const rect of zoomedRects) {
    expect(rect.left).toBeGreaterThanOrEqual(inset - 0.5);
    expect(rect.top).toBeGreaterThanOrEqual(inset - 0.5);
    expect(rect.right).toBeLessThanOrEqual(width - inset + 0.5);
    expect(rect.bottom).toBeLessThanOrEqual(height - inset + 0.5);
  }

  if (!target.contains(input)) {
    const field = [input, ...((input as HTMLInputElement).labels ?? [])].map((el) =>
      el.getBoundingClientRect(),
    );
    for (const rect of zoomedRects) {
      for (const f of field) {
        const overlaps =
          rect.left < f.right && f.left < rect.right && rect.top < f.bottom && f.top < rect.bottom;
        expect(overlaps).toBe(false);
      }
    }
  }

  // Overlay, at the corner: only the width and height limit it.
  if (target.contains(input)) {
    const restWidth = target.offsetWidth + (badge ? 18 : 0);
    const room = Math.min(1.5, (width - 2 * inset) / restWidth);
    if (room >= 1.1) expect(scale).toBeGreaterThan(1.09);
    else expect(scale).toBe(1);
  } else if (width - 2 * inset >= target.offsetWidth * 1.5 + 18) {
    // Stacked, with 260px above the card: room for the full zoom, up.
    expect(scale).toBe(1.5);
  }
}

const zoomFitArgs = {
  scale: true,
  defaultValue: {
    cardholderName: "Alex Rivera",
    cardNumber: "4242424242424242",
    expirationMonth: "12",
    expirationYear: "29",
    cvc: "123",
  },
} satisfies Partial<IncrediCardStoryArgs>;

export const ZoomFitOverlay: Story = {
  tags: ["!dev"],
  parameters: { layout: "fullscreen" },
  args: { ...zoomFitArgs, id: "story-zoom-fit-overlay" },
  play: ({ canvasElement }) => expectZoomFits(canvasElement),
};

export const ZoomFitStacked: Story = {
  tags: ["!dev"],
  parameters: { layout: "fullscreen" },
  args: { ...zoomFitArgs, id: "story-zoom-fit-stacked", layout: "stacked" },
  render: (args) => (
    <div style={{ paddingTop: 260, width: 400 }}>
      <IncrediCard {...cardProps(args)} />
    </div>
  ),
  play: ({ canvasElement }) => expectZoomFits(canvasElement),
};

// `onCompletionChange` reports on mount, and again each time "every field
// passes its format check" flips: here one CVC digit short, then complete,
// then short again.
export const CompletionChange: Story = {
  tags: ["!dev"],
  args: {
    id: "story-completion-change",
    layout: "stacked",
    onCompletionChange: fn(),
    defaultValue: {
      cardholderName: "Alex Rivera",
      cardNumber: "4242424242424242",
      expirationMonth: "12",
      expirationYear: "49",
      cvc: "12",
    },
  },
  play: async ({ args, canvasElement }) => {
    const onCompletionChange = args.onCompletionChange as ReturnType<typeof fn>;
    await waitFor(() => expect(onCompletionChange).toHaveBeenLastCalledWith(false));

    const cvc = within(canvasElement).getByLabelText("Security code");
    await userEvent.type(cvc, "3");
    await waitFor(() => expect(onCompletionChange).toHaveBeenLastCalledWith(true));

    await userEvent.type(cvc, "{Backspace}");
    await waitFor(() => expect(onCompletionChange).toHaveBeenLastCalledWith(false));
    expect(onCompletionChange).toHaveBeenCalledTimes(3);
  },
};

// Number lengths other than 16, typed digit by digit at the component's
// narrowest supported width (17.4375rem), where the number row has the
// least room. The grouping follows the length the number is heading for,
// and regroups the moment a 17th digit makes it a 19-digit one; it must do
// so while the field is still focused, not on blur. A 19-digit number
// must also fit the card's number row in both themes.
async function expectLongNumber(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  const input = canvas.getByLabelText("Card number") as HTMLInputElement;
  await userEvent.type(input, "4242424242424242");
  expect(input.value).toBe("4242 4242 4242 4242");
  await userEvent.type(input, "4");
  expect(input.value).toBe("4242 4242 4242 4242 4");
  await userEvent.type(input, "24");
  expect(input.value).toBe("4242 4242 4242 4242 424");
  expect(input).toHaveFocus();

  await document.fonts.ready;
  const wrapper = canvasElement.querySelector("[data-face-layout]")!;
  expect(wrapper).toHaveAttribute("data-long-number");
  if (wrapper.contains(input)) {
    // "overlay": the input itself is the number row.
    expect(input.scrollWidth).toBeLessThanOrEqual(input.clientWidth);
  } else {
    // "stacked": the face mirrors the number into a span; its text must
    // stay inside the span's own box, which the face bounds.
    const row = [...wrapper.querySelectorAll("span, div")].find(
      (el) => el.textContent === "4242 4242 4242 4242 424" && el.children.length === 0,
    )!;
    const range = document.createRange();
    range.selectNodeContents(row);
    const text = range.getBoundingClientRect();
    const box = row.getBoundingClientRect();
    expect(text.left).toBeGreaterThanOrEqual(box.left - 0.5);
    expect(text.right).toBeLessThanOrEqual(box.right + 0.5);
  }
}

const narrowest = (args: IncrediCardStoryArgs) => (
  <div style={{ width: "17.4375rem" }}>
    <IncrediCard {...cardProps(args)} />
  </div>
);

export const LongNumberOverlay: Story = {
  tags: ["!dev"],
  args: { id: "story-long-number-overlay" },
  render: narrowest,
  play: ({ canvasElement }) => expectLongNumber(canvasElement),
};

export const LongNumberOverlayVintage: Story = {
  tags: ["!dev"],
  args: { id: "story-long-number-overlay-vintage", theme: "vintage" },
  render: narrowest,
  play: ({ canvasElement }) => expectLongNumber(canvasElement),
};

export const LongNumberStacked: Story = {
  tags: ["!dev"],
  args: { id: "story-long-number-stacked", layout: "stacked" },
  render: narrowest,
  play: ({ canvasElement }) => expectLongNumber(canvasElement),
};

export const LongNumberStackedVintage: Story = {
  tags: ["!dev"],
  args: { id: "story-long-number-stacked-vintage", layout: "stacked", theme: "vintage" },
  render: narrowest,
  play: ({ canvasElement }) => expectLongNumber(canvasElement),
};

// A 14-digit Diners Club number groups 4-6-4 and completes the card at 14,
// revealing the rest of the form.
export const ShortNumber: Story = {
  tags: ["!dev"],
  args: { id: "story-short-number", layout: "stacked" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.queryByLabelText("Security code")).toBeNull();
    const input = canvas.getByLabelText("Card number") as HTMLInputElement;
    await userEvent.type(input, "30569309025904");
    expect(input.value).toBe("3056 930902 5904");
    await waitFor(() => expect(canvas.getByLabelText("Security code")).toBeInTheDocument());
  },
};

// Pasted before anything is detected, a number keeps all its digits until
// its prefix names a network, then is trimmed to that network's longest:
// 16 digits starting 37 become a 15-digit Amex, in the field and on the
// card alike.
export const PastedOverlongNumber: Story = {
  tags: ["!dev"],
  args: { id: "story-pasted-overlong", layout: "stacked", onChange: fn() },
  play: async ({ args, canvasElement }) => {
    const input = within(canvasElement).getByLabelText("Card number") as HTMLInputElement;
    await userEvent.click(input);
    await userEvent.paste("3782822463100051");
    await waitFor(() => expect(input.value).toBe("3782 822463 10005"));
    const onChange = args.onChange as ReturnType<typeof fn>;
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ cardNumber: "378282246310005" }));
  },
};

// The corner follows the detected network: the app's mark where it
// supplied one (here, only Visa's), the network's name where it didn't,
// and nothing, faded out, once the number no longer names a network.
async function expectNetworkMarks(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  const input = canvas.getByLabelText("Card number");
  const visaMark = () =>
    [...canvasElement.querySelectorAll("img")].find((img) => img.getAttribute("src") === demoAcceptanceMarks.visa);

  await userEvent.type(input, "4242");
  await waitFor(() => expect(visaMark()).toBeDefined());
  await waitFor(() => expect(visaMark()).toHaveStyle({ opacity: "1" }));
  expect(canvas.queryByText("Visa")).toBeNull();

  await userEvent.clear(input);
  await waitFor(() => expect(visaMark()).toHaveStyle({ opacity: "0" }));

  await userEvent.type(input, "5555");
  const name = await canvas.findByText("Mastercard");
  expect(visaMark()).toBeUndefined();
  await waitFor(() => expect(name).toHaveStyle({ opacity: "1" }));

  await userEvent.clear(input);
  await waitFor(() => expect(name).toHaveStyle({ opacity: "0" }));
}

export const NetworkMarksOverlay: Story = {
  tags: ["!dev"],
  args: { id: "story-network-marks-overlay", acceptanceMarks: { visa: demoAcceptanceMarks.visa } },
  play: ({ canvasElement }) => expectNetworkMarks(canvasElement),
};

export const NetworkMarksStacked: Story = {
  tags: ["!dev"],
  args: { id: "story-network-marks-stacked", layout: "stacked", acceptanceMarks: { visa: demoAcceptanceMarks.visa } },
  play: ({ canvasElement }) => expectNetworkMarks(canvasElement),
};

// Every network's name fits the mark's box, in both themes and both
// layouts, at the component's narrowest supported width: no word wider
// than the box, and no more lines than fit its height.
const NETWORK_NUMBERS = [
  "378282246310005",
  "30569309025904",
  "6011111111111117",
  "3530111333300000",
  "6700000000000000",
  "5555555555554444",
  "6200000000000005",
  "4242424242424242",
];

export const NetworkNamesFit: Story = {
  tags: ["!dev"],
  args: { id: "story-network-names-fit", acceptanceMarks: {} },
  render: (args) => (
    <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(4, 17.4375rem)" }}>
      {(["modern", "vintage"] as const).flatMap((theme) =>
        (["overlay", "stacked"] as const).flatMap((layout) =>
          NETWORK_NUMBERS.map((cardNumber) => (
            <IncrediCard
              key={`${theme}-${layout}-${cardNumber}`}
              {...cardProps(args)}
              id={`${args.id}-${theme}-${layout}-${cardNumber}`}
              theme={theme}
              layout={layout}
              defaultValue={{ cardholderName: "", cardNumber, expirationMonth: "", expirationYear: "", cvc: "" }}
            />
          )),
        ),
      )}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await document.fonts.ready;
    const names = ["American Express", "Diners Club", "Discover", "JCB", "Maestro", "Mastercard", "UnionPay", "Visa"];
    const overflowing: string[] = [];
    for (const name of names) {
      const elements = within(canvasElement).getAllByText(name);
      expect(elements).toHaveLength(4);
      for (const element of elements) {
        // The text's own box, not scrollWidth: the name sits against the
        // box's end edge, so a word too wide overflows the START edge,
        // which scrollWidth doesn't count.
        const range = document.createRange();
        range.selectNodeContents(element);
        const text = range.getBoundingClientRect();
        const box = element.getBoundingClientRect();
        if (text.left < box.left - 0.5 || text.right > box.right + 0.5 || text.top < box.top - 0.5) {
          const card = element.closest("fieldset")!.id;
          overflowing.push(`${name} in ${card}: text ${text.width.toFixed(1)}x${text.height.toFixed(1)}, box ${box.width.toFixed(1)}x${box.height.toFixed(1)}`);
        }
      }
    }
    expect(overflowing).toEqual([]);
  },
};
