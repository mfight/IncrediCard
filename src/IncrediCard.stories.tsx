import { Fragment, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
// Imported from the index, not the component module: the index is where
// the compound namespace is composed, and it has to be.
import {
  IncrediCard,
  extendIncrediCardTheme,
  requestIncrediCardMotionAccess,
  type IncrediCardHostedFields,
  type IncrediCardMotionAccess,
} from ".";
import { demoAcceptanceMarks } from "../demo/acceptanceMarks";
import {
  EMPTY_MOCK_REPORT,
  MockHostedField,
  type MockHostedFieldHandle,
  type MockHostedFieldKind,
} from "../demo/hostedFields/MockHostedField";
import { engravedCardTheme } from "../demo/themes/engravedCard";
import { tumblingBlocksTheme } from "../demo/themes/tumblingBlocks";
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
    holofoil: {
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
      options: ["floating", "stacked"],
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

// A filled card: real digits and letters show each theme's type better than
// placeholders do. 4242424242424242 is a widely published Visa test number,
// valid enough to pass the Luhn and length checks without anyone's actual
// card.
const FILLED = {
  cardholderName: "Alex Rivera",
  cardNumber: "4242424242424242",
  expirationMonth: "12",
  expirationYear: "29",
  cvc: "123",
};

const LAYOUTS = [
  { layout: "stacked", caption: "Stacked" },
  { layout: "floating", caption: "Floating" },
] as const;

// Each theme's story: the same card in both layouts, side by side. "stacked"
// is a purely decorative card (IncrediCardFace) above a normal, fully labeled
// field list; "floating", the default, puts the real fields on the card itself
// (IncrediCardEmbeddedFace), where a physical card's printed text sits. Only
// where the fields live differs: validation and network detection are the
// same in both.
function BothLayouts(args: IncrediCardStoryArgs) {
  return (
    <div className={themedStyles.examples}>
      {LAYOUTS.map(({ layout, caption }) => (
        <figure key={layout} className={themedStyles.example}>
          <figcaption className={themedStyles.exampleCaption}>{caption}</figcaption>
          <IncrediCard {...cardProps(args)} id={`${args.id}-${layout}`} layout={layout} />
        </figure>
      ))}
    </div>
  );
}

// The story shows both layouts, so a layout control would do nothing.
const bothLayouts = {
  render: (args) => <BothLayouts {...args} />,
  argTypes: { layout: { table: { disable: true } } },
} satisfies Story;

// The default theme: a dark card printed with fine twisting lines, which the
// foil lights. Move the pointer across the card to light the band and the fan
// separately.
export const Ribbons: Story = {
  ...bothLayouts,
  args: { id: "story-ribbons", theme: "ribbons", holofoil: true, defaultValue: FILLED },
};

// OCR-A (the name) and OCR-B (the number, expiration and CVC) on an
// aged-ivory face, with an embossed text-shadow standing in for a real card's
// raised plastic; see the "vintage" theme in themes.ts. The fonts apply to the
// real on-card fields as well as the stacked card's decorative mirror. It has
// no foil, so there's no `holofoil` control.
export const Vintage: Story = {
  ...bothLayouts,
  argTypes: { ...bothLayouts.argTypes, holofoil: { table: { disable: true } } },
  args: { id: "story-vintage", theme: "vintage", defaultValue: FILLED },
};

// The "ribbons" card and type, printed with an engraved globe (see the "globe"
// theme in themes.ts and its art in lineArt.ts). Move the pointer across the
// card to light the land and the sphere's rings separately.
export const Globe: Story = {
  ...bothLayouts,
  args: { id: "story-globe", theme: "globe", holofoil: true, defaultValue: FILLED },
};

// The page behind the card shows through, so this story gives it pages worth
// seeing: light text on a dark page with hard edges for the frost and
// refraction to act on, and dark text on a bright one. Move the pointer across
// the card for the highlight. Refraction shows in Chromium; Safari gets the
// same glass without it. The demo's marks are white, so the dark-text cards
// leave them out to show the network's name, which follows the text.
function GlassTones({
  Layouts = BothLayouts,
  ...args
}: IncrediCardStoryArgs & { Layouts?: (args: IncrediCardStoryArgs) => React.ReactNode }) {
  return (
    <div className={themedStyles.tones}>
      <div className={`${themedStyles.glassBackdrop} ${themedStyles.onDark}`}>
        <Layouts {...args} id={`${args.id}-light`} textTone="light" />
      </div>
      <div className={themedStyles.brightBackdrop}>
        <Layouts {...args} id={`${args.id}-dark`} textTone="dark" acceptanceMarks={{}} />
      </div>
    </div>
  );
}

export const Glass: Story = {
  render: (args) => <GlassTones {...args} />,
  argTypes: { ...bothLayouts.argTypes, textTone: { table: { disable: true } } },
  args: { id: "story-glass", theme: "glass", defaultValue: FILLED },
};

// theme="glass" stories below that need a page behind one card.
const onGlassBackdrop: Decorator = (Story) => (
  <div className={themedStyles.glassBackdrop}>
    <Story />
  </div>
);

// Told what's behind it, so browsers that can't bend the live page bend a copy
// at the rim. Chromium looks the same as the Glass story; open this in Safari
// to see the difference.
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
  name: "Glass With a Known Backdrop",
  render: (args) => <KnownBackdropDemo {...args} />,
  args: {
    id: "story-glass-known",
    theme: "glass",
    layout: "floating",
    defaultValue: FILLED,
    tilt: true,
    chipReflection: true,
  },
};

// An app's own themes, each one fixed look made with `extendIncrediCardTheme`,
// one for each kind of thing a theme can change:
// - Customize Colors: the "ribbons" card in a different material.
// - Customize Art: an issuer's own artwork, from "vintage", so it has no foil,
//   and `holofoil` does nothing on it (demo/themes/engravedCard.ts). The
//   demo's marks are white, for dark cards; an app would pass dark ones here,
//   and without any, the network's name prints in the theme's dark text.
// - Customize Holofoil: line art of its own, passed as files, which the foil
//   prints and lights (demo/themes/tumblingBlocks.ts).
const forestTheme = extendIncrediCardTheme("ribbons", {
  face: {
    background: "linear-gradient(135deg, #0b3b3c, #14532d)",
    linesOpacity: 0.16,
  },
});

const CUSTOM_THEMES = [
  { key: "colors", caption: "Customize Colors", theme: forestTheme, cardNumber: "4242424242424242", cvc: "123" },
  {
    key: "art",
    caption: "Customize Art",
    theme: engravedCardTheme,
    cardNumber: "378282246310005",
    cvc: "1234",
    acceptanceMarks: undefined,
  },
  { key: "holofoil", caption: "Customize Holofoil", theme: tumblingBlocksTheme, cardNumber: "5555555555554444", cvc: "123" },
];

export const CustomThemes: Story = {
  render: (args) => (
    <div className={themedStyles.examples}>
      {CUSTOM_THEMES.map(({ key, caption, theme, cardNumber, cvc, ...rest }) => (
        <figure key={key} className={themedStyles.example}>
          <figcaption className={themedStyles.exampleCaption}>{caption}</figcaption>
          <IncrediCard
            {...cardProps(args)}
            id={`${args.id}-${key}`}
            theme={theme}
            defaultValue={{ ...FILLED, cardNumber, cvc }}
            {...rest}
          />
        </figure>
      ))}
    </div>
  ),
  argTypes: { theme: { table: { disable: true } } },
  args: { id: "story-custom-themes", layout: "floating", holofoil: true },
  play: async ({ canvasElement }) => {
    // The card's root, which takes its id and carries the theme.
    const root = (key: string) => canvasElement.querySelector<HTMLElement>(`#story-custom-themes-${key}`)!;
    for (const key of ["colors", "art", "holofoil"]) {
      await expect(root(key).hasAttribute("data-theme")).toBe(false);
    }
    await expect(getComputedStyle(root("colors")).getPropertyValue("--incredicard-face-background")).toContain(
      "linear-gradient",
    );
    // Its own masks, by whatever URL the bundler gave them.
    const blocksMask = getComputedStyle(root("holofoil")).getPropertyValue("--incredicard-lines-mask-a");
    const blocksArt = tumblingBlocksTheme.lineArt;
    await expect(typeof blocksArt === "object" && blocksMask.includes(blocksArt.maskA)).toBe(true);
    // The engraved card has no foil, so `holofoil` adds no glare to it.
    const masked = [...root("art").querySelectorAll("*")].filter((el) => getComputedStyle(el).maskImage !== "none");
    await expect(masked).toEqual([]);
  },
};

// Every supported network, in alphabetical order, with the app's acceptance
// mark on the left and, on the right, what an app that supplies no mark gets:
// the network's name in text. Each number detects as the network it claims
// (per `detectCardNetwork`), passes `luhnCheck`, AND has one of that
// network's lengths, which is what the card requires before it will reveal.
//
// Amex has the most structural differences: 4-6-5 number grouping, a 4-digit
// CVC, and that CVC printed on the FRONT of the card rather than the back.
// Its name, the longest, wraps onto two lines. Diners Club's 14-digit number
// groups 4-6-4. The rest share the neutral shape, so what they show is
// detection itself.
const NETWORKS = [
  { name: "American Express", cardNumber: "378282246310005", cvc: "1234" },
  { name: "Diners Club", cardNumber: "30569309025904" },
  { name: "Discover", cardNumber: "6011111111111117" },
  { name: "JCB", cardNumber: "3530111333300000" },
  { name: "Maestro", cardNumber: "6700000000000000" },
  { name: "Mastercard", cardNumber: "5555555555554444" },
  { name: "UnionPay", cardNumber: "6200000000000005" },
  { name: "Visa", cardNumber: "4242424242424242" },
];

export const Networks: Story = {
  render: (args) => (
    <div className={themedStyles.pairGrid}>
      {NETWORKS.flatMap(({ name, cardNumber, cvc = "123" }, index) =>
        [
          { key: "mark", caption: name, marks: args.acceptanceMarks },
          { key: "name", caption: `${name}, without a mark`, marks: {} },
        ].map(({ key, caption, marks }) => (
          <figure key={`${name}-${key}`} className={themedStyles.example}>
            <figcaption className={themedStyles.exampleCaption}>{caption}</figcaption>
            <IncrediCard
              {...cardProps(args)}
              id={`${args.id}-${index}-${key}`}
              acceptanceMarks={marks}
              defaultValue={{ ...FILLED, cardNumber, cvc }}
            />
          </figure>
        )),
      )}
    </div>
  ),
  args: { id: "story-networks" },
};

// A card whose number, expiration and security code are a payment
// processor's own fields, each in a frame from another origin, so the card
// data never touches this page. The processor here is a mock
// (demo/hostedFields), a sandboxed frame that checks and reports the way a
// real one does; MockHostedField is the shape of a wrapper an app would
// write around Stripe Elements or Braintree's Hosted Fields. IncrediCard
// hands each field its label, placeholder and the theme's text styling, and
// places it where its own field would go.
function HostedFieldsCard(args: IncrediCardStoryArgs) {
  const [cardNumber, setCardNumber] = useState(EMPTY_MOCK_REPORT);
  const [expiration, setExpiration] = useState(EMPTY_MOCK_REPORT);
  const [cvc, setCvc] = useState(EMPTY_MOCK_REPORT);
  const cardNumberRef = useRef<MockHostedFieldHandle>(null);
  const expirationRef = useRef<MockHostedFieldHandle>(null);
  const cvcRef = useRef<MockHostedFieldHandle>(null);
  const hostedFields: IncrediCardHostedFields = {
    cardNumber: {
      ...cardNumber,
      render: (context) => (
        <MockHostedField ref={cardNumberRef} kind="cardNumber" context={context} onChange={setCardNumber} />
      ),
      focus: () => cardNumberRef.current?.focus(),
    },
    expiration: {
      ...expiration,
      render: (context) => (
        <MockHostedField ref={expirationRef} kind="expiration" context={context} onChange={setExpiration} />
      ),
      focus: () => expirationRef.current?.focus(),
    },
    cvc: {
      ...cvc,
      render: (context) => (
        <MockHostedField
          ref={cvcRef}
          kind="cvc"
          context={context}
          cvcLength={cardNumber.network === "amex" ? 4 : 3}
          onChange={setCvc}
        />
      ),
      focus: () => cvcRef.current?.focus(),
    },
    network: cardNumber.network ?? null,
    last4: cardNumber.last4,
  };
  return <IncrediCard {...cardProps(args)} hostedFields={hostedFields} />;
}

function HostedFieldsBothLayouts(args: IncrediCardStoryArgs) {
  return (
    <div className={themedStyles.examples}>
      {LAYOUTS.map(({ layout, caption }) => (
        <figure key={layout} className={themedStyles.example}>
          <figcaption className={themedStyles.exampleCaption}>{caption}</figcaption>
          <HostedFieldsCard {...args} id={`${args.id}-${layout}`} layout={layout} />
        </figure>
      ))}
    </div>
  );
}

export const HostedFields: Story = {
  render: (args) => <HostedFieldsBothLayouts {...args} />,
  argTypes: bothLayouts.argTypes,
  args: { id: "story-hosted", holofoil: true },
};

// The hard case for styling a field IncrediCard can't reach: clear glass,
// whose text color depends on the page behind it. The processor is handed
// the right color for each `textTone`.
export const HostedFieldsGlass: Story = {
  name: "Hosted Fields on Glass",
  render: (args) => <GlassTones {...args} Layouts={HostedFieldsBothLayouts} />,
  argTypes: { ...bothLayouts.argTypes, textTone: { table: { disable: true } } },
  args: { id: "story-hosted-glass", theme: "glass" },
};

export const Disabled: Story = {
  args: { id: "story-disabled", layout: "stacked", disabled: true, defaultValue: FILLED },
};

// Visual-only busy state for a submission the application owns (see the
// `processing` doc comment in IncrediCard.tsx); this component has no
// submission flow of its own to pause.
export const Processing: Story = {
  decorators: [withReducedMotion],
  args: { id: "story-processing", processing: true, defaultValue: FILLED },
};

// Every other story renders the "stacked" layout at its narrowest supported
// width, since Storybook's `layout: "centered"` parameter doesn't stretch its
// subject wide enough to reach the row-layout switch. This story is wide
// enough (`themedStyles.wideWrapper`, 720px) to cross the `@container
// (min-width: 640px)` threshold and show the card and field column side by
// side.
export const SideBySide: Story = {
  args: { id: "story-side-by-side", layout: "stacked", defaultValue: FILLED },
  render: (args) => (
    <div className={themedStyles.wideWrapper}>
      <IncrediCard {...cardProps(args)} />
    </div>
  ),
};

// The copy's wiring, on both faces: lined up with the app's element, hidden
// in Chromium, which bends the live page, and carrying the card's own filter.
export const GlassBackdropCopyWiring: Story = {
  tags: ["!dev"],
  render: (args) => <OnKnownBackdrop {...args} />,
  args: { id: "story-glass-copy", theme: "glass", layout: "floating", defaultValue: FILLED },
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
  args: { id: "story-ribbons-copy", theme: "ribbons", layout: "floating", defaultValue: FILLED },
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
  args: { id: "story-glass-wiring", theme: "glass", layout: "floating", defaultValue: FILLED },
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
  args: { id: "story-no-backdrop", theme: "ribbons", layout: "floating" },
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
  args: { layout: "floating", defaultValue: FILLED },
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
    holofoil: true,
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
// `holofoil` and `tilt` both track the pointer, so with both on it can
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
    prop: "holofoil",
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
    holofoil: true,
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
          On a phone or tablet, <code>holofoil</code>, <code>tilt</code> and{" "}
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
    holofoil: true,
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
// Floating pins the card to the page's top-left corner, where an unfitted
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

  // Floating, at the corner: only the width and height limit it.
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

export const ZoomFitFloating: Story = {
  tags: ["!dev"],
  parameters: { layout: "fullscreen" },
  args: { ...zoomFitArgs, id: "story-zoom-fit-floating" },
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
    // "floating": the input itself is the number row.
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

export const LongNumberFloating: Story = {
  tags: ["!dev"],
  args: { id: "story-long-number-floating" },
  render: narrowest,
  play: ({ canvasElement }) => expectLongNumber(canvasElement),
};

export const LongNumberFloatingVintage: Story = {
  tags: ["!dev"],
  args: { id: "story-long-number-floating-vintage", theme: "vintage" },
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

export const NetworkMarksFloating: Story = {
  tags: ["!dev"],
  args: { id: "story-network-marks-floating", acceptanceMarks: { visa: demoAcceptanceMarks.visa } },
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
      {(["ribbons", "vintage"] as const).flatMap((theme) =>
        (["floating", "stacked"] as const).flatMap((layout) =>
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

// A network's name in text sits on the cardholder name's baseline, in both
// fonts and both layouts, at the narrowest and the full card width. Each
// baseline is found directly: an empty inline-block at the end of a line sits
// on it, and the floating name, an input, centers its line in its content
// box. Within 1.5px, since the browser rounds each line to the pixel grid on
// its own.
function baselineOf(element: HTMLElement) {
  if (element instanceof HTMLInputElement) {
    const style = getComputedStyle(element);
    const context = document.createElement("canvas").getContext("2d")!;
    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const metrics = context.measureText(element.value);
    const box = element.getBoundingClientRect();
    const top = box.top + parseFloat(style.borderTopWidth) + parseFloat(style.paddingTop);
    const height = parseFloat(style.height) - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) -
      (style.boxSizing === "border-box" ? parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth) : 0);
    const content = metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent;
    return top + (height - content) / 2 + metrics.fontBoundingBoxAscent;
  }
  const text = [...element.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).pop()!;
  const host = document.createElement("span");
  const probe = document.createElement("span");
  probe.style.cssText = "display: inline-block; width: 0; height: 0";
  element.insertBefore(host, text);
  host.append(text, probe);
  const baseline = probe.getBoundingClientRect().top;
  host.replaceWith(...host.childNodes);
  probe.remove();
  return baseline;
}

export const NetworkNameOnNameBaseline: Story = {
  tags: ["!dev"],
  args: { id: "story-network-baseline", acceptanceMarks: {} },
  render: (args) => (
    <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(4, auto)", alignItems: "start" }}>
      {(["ribbons", "vintage"] as const).flatMap((theme) =>
        (["floating", "stacked"] as const).flatMap((layout) =>
          (["17.4375rem", "21.25rem"] as const).map((width) => (
            <div key={`${theme}-${layout}-${width}`} style={{ width }}>
              <IncrediCard
                {...cardProps(args)}
                id={`${args.id}-${theme}-${layout}-${width.replace(".", "_")}`}
                theme={theme}
                layout={layout}
                defaultValue={{ ...FILLED, cardNumber: "378282246310005", cvc: "1234" }}
              />
            </div>
          )),
        ),
      )}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await document.fonts.ready;
    const off: string[] = [];
    for (const card of canvasElement.querySelectorAll<HTMLElement>("fieldset")) {
      const face = card.querySelector<HTMLElement>("[data-face-layout]")!;
      const name =
        face.querySelector<HTMLInputElement>('input[autocomplete="cc-name"]') ??
        [...face.querySelectorAll<HTMLElement>("span")].find(
          (span) => span.textContent === "ALEX RIVERA" && span.children.length === 0,
        )!;
      const network = [...face.querySelectorAll<HTMLElement>("span")].find(
        (span) => span.textContent === "American Express",
      )!;
      const gap = baselineOf(network) - baselineOf(name);
      if (Math.abs(gap) > 1.5) off.push(`${card.id}: ${gap.toFixed(2)}px`);
    }
    expect(off).toEqual([]);
  },
};


// The hosted-field tests below drive the mock processor the only way the page
// outside its frame can: by message. They can't press keys inside the frame,
// so they focus and fill it as a processor's own API would, and check what
// IncrediCard does with what the frame reports. Tab between frames, which
// only a real keyboard can press, is checked by hand in the browser.
function hostedFrame(canvasElement: HTMLElement, kind: MockHostedFieldKind) {
  const frame = canvasElement.querySelector<HTMLIFrameElement>(`iframe[data-mock-hosted-field="${kind}"]`);
  if (!frame) throw new Error(`No ${kind} frame yet`);
  return frame;
}

// The slot's bordered box, which carries `data-focused`.
function hostedBox(canvasElement: HTMLElement, kind: MockHostedFieldKind) {
  return hostedFrame(canvasElement, kind).parentElement!.parentElement!;
}

// Retried until `done`, since a message sent before the frame's page has
// loaded is lost. Replacing the value is the same every time, so a repeat
// changes nothing.
async function fillHosted(canvasElement: HTMLElement, kind: MockHostedFieldKind, text: string, done: () => void) {
  await waitFor(() => {
    hostedFrame(canvasElement, kind).contentWindow!.postMessage({ type: "type", text }, "*");
    done();
  });
}

async function focusHosted(canvasElement: HTMLElement, kind: MockHostedFieldKind) {
  await waitFor(() => {
    const frame = hostedFrame(canvasElement, kind);
    frame.focus();
    frame.contentWindow!.postMessage({ type: "focus" }, "*");
    expect(hostedBox(canvasElement, kind)).toHaveAttribute("data-focused");
  });
}

const flippedFace = (canvasElement: HTMLElement) => canvasElement.querySelector("[data-flipped]");

// Floating: the reveal, the flip to a hosted security code from Tab in the
// name field, a guard handing Shift+Tab back across the card, an error from
// the processor shown only after the field is left, completion from the
// processor's flags, and no card data in IncrediCard's own value.
export const HostedFieldsFloatingFlow: Story = {
  tags: ["!dev"],
  render: (args) => <HostedFieldsCard {...args} />,
  args: { id: "story-hosted-floating-flow", layout: "floating", onChange: fn(), onCompletionChange: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const onChange = args.onChange as ReturnType<typeof fn>;
    const onCompletionChange = args.onCompletionChange as ReturnType<typeof fn>;

    await fillHosted(canvasElement, "cardNumber", "4242424242424242", () =>
      expect(canvas.getByLabelText("Name on card")).toBeInTheDocument(),
    );
    const name = canvas.getByLabelText<HTMLInputElement>("Name on card");
    await userEvent.type(name, "Alex Rivera");
    expect(onChange).toHaveBeenLastCalledWith({
      cardholderName: "Alex Rivera",
      cardNumber: "",
      expirationMonth: "",
      expirationYear: "",
      cvc: "",
    });

    // Name is third in this layout's order and the security code last, on
    // the back: Tab turns the card over and lands in the processor's field.
    await userEvent.keyboard("{Tab}");
    await waitFor(() => expect(flippedFace(canvasElement)).not.toBeNull());
    await waitFor(() => expect(hostedBox(canvasElement, "cvc")).toHaveAttribute("data-focused"));

    // Shift+Tab out of the frame lands on the guard before it, which hands
    // focus back to the name field, on the front.
    const guardBefore = hostedFrame(canvasElement, "cvc").parentElement!.previousElementSibling as HTMLElement;
    guardBefore.focus();
    await waitFor(() => expect(name).toHaveFocus());
    expect(flippedFace(canvasElement)).toBeNull();

    // An invalid number: the processor's message, but only once the field
    // has been left.
    await focusHosted(canvasElement, "cardNumber");
    hostedFrame(canvasElement, "cardNumber").contentWindow!.postMessage({ type: "type", text: "4242424242424241" }, "*");
    // Nothing shows the report while the field has focus, so there's nothing
    // to wait for: give it time to arrive, then check it changed nothing.
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(canvas.queryByText("Your card number is invalid.", { selector: "p:not([id])" })).toBeNull();
    expect(hostedBox(canvasElement, "cardNumber").parentElement).not.toHaveAttribute("data-invalid");
    name.focus();
    await waitFor(() =>
      expect(canvas.getByText("Your card number is invalid.", { selector: "p:not([id])" })).toBeInTheDocument(),
    );

    await fillHosted(canvasElement, "cardNumber", "4242424242424242", () =>
      expect(canvas.queryByText("Your card number is invalid.", { selector: "p:not([id])" })).toBeNull(),
    );
    await fillHosted(canvasElement, "expiration", "1249", () =>
      expect(onCompletionChange).toHaveBeenLastCalledWith(false),
    );
    await fillHosted(canvasElement, "cvc", "123", () => expect(onCompletionChange).toHaveBeenLastCalledWith(true));
  },
};

// Stacked: focusing a hosted security code shows the back and focusing the
// number shows the front, the flip control lands in the processor's field,
// and the decorative face shows the last four digits and nothing else.
export const HostedFieldsStackedFlow: Story = {
  tags: ["!dev"],
  render: (args) => <HostedFieldsCard {...args} />,
  args: { id: "story-hosted-stacked-flow", layout: "stacked" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await fillHosted(canvasElement, "cardNumber", "5555555555554444", () =>
      expect(canvas.getByLabelText("Name on card")).toBeInTheDocument(),
    );
    const face = canvasElement.querySelector<HTMLElement>("[data-face-layout]")!;
    await waitFor(() => expect(face.textContent).toContain("•••• •••• •••• 4444"));
    expect(face.textContent).not.toContain("5555");

    await focusHosted(canvasElement, "cvc");
    await waitFor(() => expect(flippedFace(canvasElement)).not.toBeNull());
    await focusHosted(canvasElement, "cardNumber");
    await waitFor(() => expect(flippedFace(canvasElement)).toBeNull());

    await userEvent.click(canvas.getByRole("button", { name: "Show back of card" }));
    await waitFor(() => expect(hostedBox(canvasElement, "cvc")).toHaveAttribute("data-focused"));
    expect(flippedFace(canvasElement)).not.toBeNull();
  },
};

// Amex from the processor's network: the hosted security code moves to the
// front, where it's reachable, and there's no flip control.
export const HostedFieldsAmex: Story = {
  tags: ["!dev"],
  render: (args) => <HostedFieldsCard {...args} />,
  args: { id: "story-hosted-amex", layout: "floating" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await fillHosted(canvasElement, "cardNumber", "378282246310005", () =>
      expect(canvas.getByLabelText("Name on card")).toBeInTheDocument(),
    );
    expect(canvas.queryByRole("button", { name: "Show back of card" })).toBeNull();
    // Measured as a password field, like IncrediCard's own: the system font.
    const cvcProbe = hostedBox(canvasElement, "cvc").querySelector<HTMLInputElement>("input[aria-hidden]")!;
    expect(cvcProbe.type).toBe("password");
    expect(getComputedStyle(cvcProbe).fontFamily).toMatch(/^system-ui/);
    const cvc = hostedFrame(canvasElement, "cvc");
    expect(cvc.closest("[inert]")).toBeNull();
    await focusHosted(canvasElement, "cvc");
    expect(flippedFace(canvasElement)).toBeNull();
  },
};

// An empty security code on a floating card shows its placeholder in the
// signature panel's own gray, on every theme, not the face's placeholder,
// which is a translucent white on most themes and vanishes on the light
// panel. A hosted security code is handed the same color through its slot.
export const CvcPlaceholderOnPanel: Story = {
  tags: ["!dev"],
  render: (args) => (
    <div className={themedStyles.examples}>
      {(Object.keys(INCREDICARD_THEMES) as Array<keyof typeof INCREDICARD_THEMES>).map((theme) => (
        <IncrediCard
          {...cardProps(args)}
          key={theme}
          id={`${args.id}-${theme}`}
          theme={theme}
          layout="floating"
          defaultValue={{ ...FILLED, cvc: "" }}
        />
      ))}
    </div>
  ),
  args: { id: "story-cvc-placeholder" },
  play: async ({ canvasElement }) => {
    const fields = [...canvasElement.querySelectorAll<HTMLInputElement>('input[autocomplete="cc-csc"]')];
    expect(fields.length).toBe(Object.keys(INCREDICARD_THEMES).length);
    for (const field of fields) {
      expect(field.value).toBe("");
      expect(getComputedStyle(field, "::placeholder").color).toBe("rgb(107, 114, 128)");
    }
  },
};
