import { Fragment, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
// Imported from the index, not the component module: the index is where
// the compound namespace is composed, and it has to be.
import {
  IncrediCard,
  requestIncrediCardMotionAccess,
  type IncrediCardMotionAccess,
} from ".";
import { ForceReducedMotion } from "./reducedMotion";
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
  parameters: {
    layout: "centered",
  },
  argTypes: {
    fieldSize: {
      control: "select",
      options: ["sm", "md", "lg", "xl"],
    },
    theme: {
      control: "select",
      options: ["modern", "vintage"],
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
// what a plain `<IncrediCard id="..." />` renders.
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
// `detectCardNetwork`), passes `luhnCheck`, AND matches that network's
// declared `numberLength`, which is what the card requires before it
// will reveal.
//
// The length check rules out the commonly quoted Diners Club test number
// (30569309025904): it is 14 digits, but cardNetworks.ts declares Diners
// Club as 16, so it would never validate and the story would sit
// permanently unrevealed. 3600000000000008 is a 16-digit number under the
// settled `36` Diners prefix with a computed Luhn check digit.
//
// Amex is the one with visible structural differences to demonstrate:
// 4-6-5 number grouping (vs. every other network's 4-4-4-4), a 4-digit
// CVC, and that CVC printed on the FRONT of the card rather than the
// back. The rest share the neutral shape, so what they demonstrate is
// detection itself, and their acceptance mark.

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
      cardNumber: "3600000000000008",
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
// `IncrediCardTheme` header comment in IncrediCard.tsx. A filled value
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
    chipReflection: true,
  },
  render: (args) => <DeviceTiltDemo {...args} />,
};
