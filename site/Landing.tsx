import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { IncrediCardSide, IncrediCardTheme, IncrediCardValue } from "../src";
import { detectCardNetwork, type CardNetwork } from "../src/cardNetworks";
import { demoAcceptanceMarks } from "../demo/acceptanceMarks";
import { SAMPLE_CARDS } from "../demo/sampleCards";
import { LiveCard, PointerStage, useOnScreen, usePrefersReducedMotion } from "./LiveCard";
import { SAMPLE_VALUE, useTypeOut, useTypedValue } from "./useTypedValue";
import { cobaltTheme } from "./cobaltTheme";
import { DepthDemo, ProcessorDemo, RevealDemo, type DemoProps } from "./FeatureDemos";
import styles from "./landing.module.scss";

const STORYBOOK = "/storybook/";
const DEMO_URL = `${STORYBOOK}?path=/story/incredicard--effects`;
const DOCS_URL = `${STORYBOOK}?path=/docs/incredicard-overview--docs`;
const GITHUB_URL = "https://github.com/mfight/IncrediCard";
const NPM_URL = "https://www.npmjs.com/package/incredicard";
const AUTHOR_URL = "https://markfight.com";

// The "Leave a tip" button's destination, a hosted donation page. Set
// to null, the whole support section leaves the page.
const DONATION_URL: string | null = "https://ko-fi.com/markfight";

const THEMES: { theme: IncrediCardTheme; name: string; note?: string; summary: string }[] = [
  {
    theme: "ribbons",
    name: "Ribbons",
    note: "(default)",
    summary: "Abstract holographic lines on a dark background.",
  },
  {
    theme: "vintage",
    name: "Vintage",
    summary: "Gold card with embossed lettering, inspired by classic plastic cards.",
  },
  {
    theme: "globe",
    name: "Globe",
    summary: "A holographic globe on a dark background.",
  },
  {
    theme: "glass",
    name: "Glass",
    summary: "A translucent finish that reveals the background, with light or dark text to suit.",
  },
];

const cardBase = {
  value: SAMPLE_VALUE,
  acceptanceMarks: demoAcceptanceMarks,
};

export function Landing() {
  return (
    <>
      <a className={styles.skipLink} href="#main">
        Skip to content
      </a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <a className={styles.brand} href="/">
            <CardIcon />
            IncrediCard
          </a>
          <nav aria-label="Site">
            <ul className={styles.nav}>
              <li>
                <a href="#features">Features</a>
              </li>
              <li>
                <a href={DOCS_URL}>Docs</a>
              </li>
              <li>
                <a href={GITHUB_URL}>
                  GitHub <ArrowIcon />
                </a>
              </li>
            </ul>
          </nav>
        </div>
      </header>
      <main id="main">
        <Hero />
        <Experience />
        <Themes />
        <RealFields />
        <Install />
        <Support />
      </main>
      <Footer />
    </>
  );
}

// --- Hero -----------------------------------------------------------------

const SLOTS = ["front", "right", "left"] as const;
type Slot = (typeof SLOTS)[number];

// The three most different themes: clear glass in front, then the vintage
// plastic and the engraved globe. Every few seconds each card moves one slot
// on. Ribbons sits this out; beside Globe it would read as the same dark card.
const START: IncrediCardTheme[] = ["glass", "vintage", "globe"];

// A different network on each, so the fan shows the card recognizing them:
// Visa on the glass, American Express on the vintage card (which has no
// back to turn to, its security code being printed on the front, so it
// skips the flip), Mastercard on the globe. Payment processors' published
// test numbers.
const HERO_VALUES: Record<string, IncrediCardValue> = {
  glass: SAMPLE_VALUE,
  vintage: { ...SAMPLE_VALUE, cardNumber: "378282246310005", cvc: "1234" },
  globe: { ...SAMPLE_VALUE, cardNumber: "5555555555554444" },
};

// Which hero cards turn over when they reach the front. The American Express
// card stays face-up, holding at the front for as long as the others take to
// turn over and back. It's never asked to turn at all: the card would ignore
// the request, but its tilt would still pause for a flip that never comes.
const HERO_TURNS: Record<string, boolean> = Object.fromEntries(
  Object.entries(HERO_VALUES).map(([theme, value]) => [theme, detectCardNetwork(value.cardNumber) !== "amex"]),
);

// The fan's rhythm. A card slides to the front (the slide's own CSS
// transition), turns to its back, holds there briefly, turns face-up again,
// then holds before the fan moves on. FLIP_MS is the card's own flip
// transition, so each hold starts once the turn has finished.
const SLIDE_MS = 1100;
const FLIP_MS = 280;
const HOLD_BACK_MS = 500;
const HOLD_FRONT_MS = 2000;
// How much the fan is scaled up on a screen with room for it: the 20rem cards
// show at 34rem, 160% of the component's usual 21.25rem, as the page's lead
// example.
const HERO_SCALE = 1.7;

function Hero() {
  const fanRef = useRef<HTMLDivElement>(null);
  const onScreen = useOnScreen(fanRef);
  const reduced = usePrefersReducedMotion();
  const [turn, setTurn] = useState(0);
  // The side the front card shows. The others always show their fronts.
  const [frontSide, setFrontSide] = useState<IncrediCardSide>("front");
  const stageRef = useRef<HTMLDivElement>(null);

  // The fan is laid out with the cards at the component's usual size, then
  // scaled as a whole: up to HERO_SCALE where there's room, and down as the
  // screen narrows, so all three cards stay in view. Scaling rather than
  // sizing the cards: the card caps its own width (and its text sizes) and
  // has a minimum width, which would run the fan off a phone. Set before
  // paint, so it never shows at the wrong size.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    const fan = fanRef.current;
    if (!stage || !fan) return;
    const fit = () =>
      stage.style.setProperty("--fan-fit", String(Math.min(HERO_SCALE, stage.clientWidth / fan.offsetWidth)));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!onScreen || reduced) return;
    let timer = 0;
    // From a card's arrival at the front (or the page's first frame, where
    // the first card is already there) to the next card's arrival.
    const arrive = () => {
      timer = window.setTimeout(() => {
        setFrontSide("back");
        timer = window.setTimeout(() => {
          setFrontSide("front");
          timer = window.setTimeout(() => {
            setTurn((value) => value + 1);
            arrive();
          }, FLIP_MS + HOLD_FRONT_MS);
        }, FLIP_MS + HOLD_BACK_MS);
      }, SLIDE_MS);
    };
    arrive();
    return () => {
      window.clearTimeout(timer);
      // Stopped mid-turn (scrolled away), the card lands face-up.
      setFrontSide("front");
    };
  }, [onScreen, reduced]);

  const slotOf = (index: number): Slot => SLOTS[(index + turn) % SLOTS.length];

  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      {/* The whole hero is the stage, so the fan follows the pointer
          anywhere over it, not just over the cards. */}
      <PointerStage className={styles.heroInner}>
        <h1 id="hero-title" className={styles.heroTitle}>
          Credit card entry that feels like a real card.
        </h1>
        <p className={styles.heroLede}>
          A customizable, dimensional credit card with accessible inputs, built for React.
        </p>
        <div className={styles.heroActions}>
          <a className={styles.primaryButton} href={DEMO_URL}>
            Try the demo
          </a>
          <a className={styles.secondaryLink} href={DOCS_URL}>
            View docs
          </a>
        </div>

        <div ref={stageRef} className={styles.fanStage}>
          <div ref={fanRef} className={styles.fan}>
            {START.map((theme, index) => (
              <LiveCard
                key={theme}
                id={`hero-${theme}`}
                className={styles.fanCard}
                position={slotOf(index)}
                side={slotOf(index) === "front" && HERO_TURNS[theme] ? frontSide : "front"}
                theme={theme}
                tilt
                lightingEffects
                holofoil
                reach={0.6}
                {...cardBase}
                value={HERO_VALUES[theme]}
              />
            ))}
          </div>
          <p className={styles.visuallyHidden}>
            Three of the four built-in themes fanned out: a Visa card in Glass, an American Express card
            in Vintage, and a Mastercard card in Globe.
          </p>
        </div>
      </PointerStage>
    </section>
  );
}

// --- The card experience --------------------------------------------------

function Experience() {
  const panelsRef = useRef<HTMLDivElement>(null);
  const onScreen = useOnScreen(panelsRef);
  const reduced = usePrefersReducedMotion();
  const floating = useTypedValue(SAMPLE_VALUE, onScreen && !reduced);
  const stacked = useTypedValue(SAMPLE_VALUE, onScreen && !reduced, 1800);

  return (
    <section id="features" className={styles.section} aria-labelledby="experience-title">
      <p className={styles.eyebrow}>Flexible layouts</p>
      <h2 id="experience-title" className={styles.sectionTitle}>
        One card. Two layouts.
      </h2>
      <p className={styles.sectionLede}>
        Enter details directly on the card or in a labeled form below it. Both layouts respond as you
        type, paste, or autofill.
      </p>

      <div ref={panelsRef} className={styles.panels}>
        <figure className={styles.panelFigure}>
          <PointerStage className={styles.panel} phase={1}>
            <LiveCard
              id="experience-floating"
              theme={cobaltTheme}
              className={styles.panelCard}
              layout="floating"
              tilt
              lightingEffects
              value={floating.value}
              side={floating.side}
              acceptanceMarks={demoAcceptanceMarks}
            />
          </PointerStage>
          <figcaption>
            <h3 className={styles.panelTitle}>Floating layout</h3>
            <p className={styles.panelText}>
              Enter details directly on the card. Flip to the back for the security code.
            </p>
          </figcaption>
        </figure>

        <figure className={styles.panelFigure}>
          <PointerStage className={`${styles.panel} ${styles.panelStacked}`} phase={3}>
            <LiveCard
              id="experience-stacked"
              theme={cobaltTheme}
              className={`${styles.panelCard} ${styles.panelCardStacked}`}
              layout="stacked"
              tilt
              lightingEffects
              value={stacked.value}
              side={stacked.side}
              acceptanceMarks={demoAcceptanceMarks}
            />
          </PointerStage>
          <figcaption>
            <h3 className={styles.panelTitle}>Stacked layout</h3>
            <p className={styles.panelText}>A live card preview above a familiar, fully labeled form.</p>
          </figcaption>
        </figure>
      </div>

      <FeatureList />
    </section>
  );
}

const FEATURES: { demo: (props: DemoProps) => React.ReactNode; title: string; text: string }[] = [
  {
    demo: RevealDemo,
    title: "Reveal details as needed",
    text: "Start with the card number. The remaining fields appear once it passes a format check.",
  },
  {
    demo: DepthDemo,
    title: "Add a little depth",
    text: "Bring the card to life with reflections, holographic foil, tilt, and zoom on focus. Every effect is optional and respects reduced motion.",
  },
  {
    demo: ProcessorDemo,
    title: "Bring your own processor",
    text: "Use your processor’s hosted fields for the number, expiration, and security code. IncrediCard coordinates the card, flip, and keyboard navigation around them.",
  },
];

// The middle of the screen, as an IntersectionObserver root margin: a
// column runs while it crosses the band through the viewport's center.
const CENTER_BAND = "-35% 0px -35% 0px";

// The features, each with its demo. A demo gets one turn at a time while its
// column crosses the middle of the screen. Where the columns share a row they
// all cross it together, so they take turns, first to last and around again;
// stacked, each runs on its own while it's centered. Reduced motion gives no
// turns: the demos show still examples.
function FeatureList() {
  const listRef = useRef<HTMLUListElement>(null);
  const reduced = usePrefersReducedMotion();
  const [centered, setCentered] = useState<boolean[]>(() => FEATURES.map(() => false));
  // Whose turn it is (-1: no one's) and a count that changes with each turn.
  const [turn, setTurn] = useState({ index: -1, token: 0 });
  const centeredRef = useRef(centered);

  useEffect(() => {
    centeredRef.current = centered;
  }, [centered]);

  useEffect(() => {
    const items = [...(listRef.current?.children ?? [])];
    const observer = new IntersectionObserver(
      (entries) =>
        setCentered((previous) => {
          const next = [...previous];
          for (const entry of entries) next[items.indexOf(entry.target)] = entry.isIntersecting;
          return next;
        }),
      { rootMargin: CENTER_BAND },
    );
    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);

  // A column reaching the middle with no one running, or the running one
  // leaving it, starts the first centered column's turn.
  const first = reduced ? -1 : centered.indexOf(true);
  const runningCentered = turn.index >= 0 && centered[turn.index] && !reduced;
  if (!runningCentered && first !== turn.index) {
    setTurn({ index: first, token: turn.token + 1 });
  }

  // When a turn ends, the next centered column after it goes, around again.
  const [onDone] = useState(() =>
    FEATURES.map((_, index) => () =>
      setTurn((current) => {
        if (current.index !== index) return current;
        const now = centeredRef.current;
        const order = FEATURES.map((__, step) => (index + 1 + step) % FEATURES.length);
        return { index: order.find((candidate) => now[candidate]) ?? -1, token: current.token + 1 };
      }),
    ),
  );

  return (
    <ul ref={listRef} className={styles.features}>
      {FEATURES.map(({ demo: Demo, title, text }, index) => (
        <li key={title} className={styles.feature}>
          <Demo act={turn.index === index ? turn.token : 0} onActDone={onDone[index]} />
          <h3 className={styles.featureTitle}>{title}</h3>
          <p className={styles.featureText}>{text}</p>
        </li>
      ))}
    </ul>
  );
}

// --- Themes ---------------------------------------------------------------

function Themes() {
  return (
    <section className={styles.themesBand} aria-labelledby="themes-title">
      <div className={styles.section}>
        <p className={styles.eyebrow}>Make it yours</p>
        <h2 id="themes-title" className={styles.sectionTitle}>
          Ready-made looks. Room to make your own.
        </h2>
        <p className={styles.sectionLede}>
          Choose from four built-in themes, customize an existing look, or create your own. Adjust
          colors, artwork, and typography to fit your brand.
        </p>
        <ul className={styles.themeGrid}>
          {THEMES.map((entry, index) => (
            <ThemeItem key={entry.theme} {...entry} index={index} />
          ))}
        </ul>
      </div>
    </section>
  );
}

// The sample details on another network's test number.
function sampleValue(network: CardNetwork): IncrediCardValue {
  const card = SAMPLE_CARDS.find((entry) => entry.network === network) ?? SAMPLE_CARDS[0];
  return { ...SAMPLE_VALUE, cardNumber: card.cardNumber, cvc: card.cvc ?? SAMPLE_VALUE.cvc };
}

// One theme's card, with a network picker and a Flip card button. The card
// itself stays display-only; those two are the controls. Picking a network
// types the details out again, turning over for the security code where
// the network prints it on the back, and ends face-up.
function ThemeItem({ theme, name, note, summary, index }: (typeof THEMES)[number] & { index: number }) {
  const [network, setNetwork] = useState<CardNetwork>("visa");
  const [side, setSide] = useState<IncrediCardSide>("front");
  const reduced = usePrefersReducedMotion();
  const { typed, start, finish } = useTypeOut();
  const value = useMemo(() => sampleValue(network), [network]);
  // American Express prints its code on the front and doesn't turn over.
  const turns = network !== "amex";
  const shownSide = typed?.side ?? side;

  const pickNetwork = (next: CardNetwork) => {
    setNetwork(next);
    setSide("front");
    // Reduced motion swaps the details in place: no typing, no turn.
    if (reduced) finish();
    else start(sampleValue(next));
  };

  // Mid-typing, the button finishes the details at once, then turns the
  // card from whichever side it's showing.
  const flip = () => {
    finish();
    setSide(shownSide === "front" ? "back" : "front");
  };

  return (
    <li className={styles.themeItem}>
      <PointerStage
        className={`${styles.themeStage} ${theme === "glass" ? styles.themeStageGlass : ""}`}
        phase={index * 1.7}
      >
        <LiveCard
          id={`theme-${theme}`}
          className={styles.themeCard}
          theme={theme}
          tilt
          lightingEffects
          holofoil
          {...cardBase}
          value={typed?.value ?? value}
          side={turns ? shownSide : "front"}
        />
      </PointerStage>
      <div className={styles.themeHeader}>
        <h3 className={styles.themeName}>
          {name}
          {note && <span className={styles.themeNote}> {note}</span>}
        </h3>
        <div className={styles.themeControls}>
          <span className={styles.networkPicker}>
            <select
              aria-label={`Card network: ${name}`}
              value={network}
              onChange={(event) => pickNetwork(event.target.value as CardNetwork)}
            >
              {SAMPLE_CARDS.map((card) => (
                <option key={card.network} value={card.network}>
                  {card.name}
                </option>
              ))}
            </select>
            <ChevronIcon />
          </span>
          <button
            type="button"
            className={`${styles.primaryButton} ${styles.quietButton} ${styles.smallButton}`}
            aria-pressed={turns && shownSide === "back"}
            disabled={!turns}
            onClick={flip}
          >
            <FlipIcon />
            Flip card<span className={styles.visuallyHidden}>: {name}</span>
          </button>
        </div>
      </div>
      <p className={styles.themeSummary}>{summary}</p>
    </li>
  );
}

// --- Real fields ----------------------------------------------------------

const FIELD_POINTS = [
  {
    title: "Keyboard and screen readers",
    text: "Labeled fields support assistive technology. Tab follows the form and flips the card when needed.",
  },
  {
    title: "Typing, paste, and autofill",
    text: "Enter details your way. The card stays in sync as you type, paste a number, or use browser autofill.",
  },
  {
    title: "Smart credit card number recognition",
    text: "Recognizes eight networks from the number prefix and applies their formatting rules. Display your own acceptance-mark assets or show the network name.",
  },
  {
    title: "Built-in or hosted fields",
    text: "Start with the included inputs or connect your processor’s hosted number, expiration, and security-code fields.",
  },
  {
    // The component replaces movement with a calmer signal rather than only
    // removing it (the processing loop becomes a slow pulse), so "calmer
    // alternatives", not "remove".
    title: "Motion that respects preferences",
    text: "Reduced-motion settings replace animated transitions and decorative movement with calmer alternatives while keeping the form fully usable.",
  },
  {
    title: "Self-contained for React",
    text: "Fields, styles, fonts, and default labels ship together. Replace the labels to suit your language or product.",
  },
];

function RealFields() {
  return (
    <section className={styles.section} aria-labelledby="fields-title">
      <div>
        <div>
          <p className={styles.eyebrow}>Accessible by design</p>
          <h2 id="fields-title" className={styles.sectionTitle}>
            {/* "A thoughtful" stays together, so a wrap falls after "card.". */}
            A familiar card. A{"\u00a0"}thoughtful form.
          </h2>
          <p className={styles.sectionLede}>
            Labeled inputs, keyboard navigation, and reduced-motion support come built in. Use
            IncrediCard’s own fields or connect your processor’s hosted fields.
          </p>
        </div>
        <ul className={styles.points}>
          {FIELD_POINTS.map(({ title, text }) => (
            <li key={title} className={styles.point}>
              <CheckIcon />
              <div>
                <h3 className={styles.pointTitle}>{title}</h3>
                <p className={styles.pointText}>{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// --- Install --------------------------------------------------------------

const USAGE = `import "incredicard/styles.css";
import { IncrediCard } from "incredicard";

export function PaymentForm() {
  return <IncrediCard id="payment" tilt lightingEffects />;
}`;

function Install() {
  return (
    <section className={styles.installBand} aria-labelledby="install-title">
      <div className={`${styles.section} ${styles.split}`}>
        <div>
          <p className={`${styles.eyebrow} ${styles.eyebrowOnDark}`}>Free and open</p>
          <h2 id="install-title" className={styles.sectionTitle}>
            Make it part of your checkout.
          </h2>
          <p className={styles.sectionLede}>
            Install from npm, import the stylesheet, and render your first card.
            <span aria-hidden="true">*</span> IncrediCard is Apache 2.0 licensed and ready to adapt.
          </p>
        </div>
        <div className={styles.code}>
          <pre>
            <code>
              <span className={styles.codePrompt} aria-hidden="true">
                ${" "}
              </span>
              npm install incredicard
            </code>
          </pre>
          <pre>
            <code>{USAGE}</code>
          </pre>
        </div>
        {/* Its own row across the band, starting under the text, so it can
            run on under the code samples. */}
        <div className={styles.installActions}>
          <a className={styles.primaryButton} href={DOCS_URL}>
            Read the docs
          </a>
          <a className={styles.secondaryLink} href={NPM_URL}>
            View on npm <ArrowIcon />
          </a>
          <a className={styles.secondaryLink} href={GITHUB_URL}>
            View on GitHub <ArrowIcon />
          </a>
        </div>
        {/* peerDependencies: react and react-dom ^19.2.0. */}
        <p className={styles.installFootnote}>
          {/* Set tight, the way fine print usually sets an asterisk note. */}
          <span aria-hidden="true">*</span>Requires React 19.2 or later
        </p>
      </div>
    </section>
  );
}

// --- Support --------------------------------------------------------------

// An optional thank-you, quieter than the demo and install calls to action:
// a lighter heading and an outlined button. Off the page until DONATION_URL
// is set.
function Support() {
  if (!DONATION_URL) return null;
  return (
    <section className={styles.supportBand} aria-labelledby="support-title">
      <div className={`${styles.section} ${styles.support}`}>
        <div>
          <p className={styles.eyebrow}>Support the project</p>
          <h2 id="support-title" className={styles.supportTitle}>
            Enjoying IncrediCard?
          </h2>
          <p className={styles.supportText}>
            If IncrediCard made your checkout a little better, a small tip is always appreciated.
          </p>
          <p className={styles.supportAside}>Sorry their payment form isn’t this nice.</p>
        </div>
        <a className={`${styles.primaryButton} ${styles.quietButton} ${styles.tipButton} ${styles.iconFirst}`} href={DONATION_URL}>
          <HeartIcon /> Leave a tip
        </a>
      </div>
    </section>
  );
}

// --- Footer ---------------------------------------------------------------

function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <p className={styles.footerNote}>
          <strong>IncrediCard handles card entry and format checks.</strong> Connect your payment
          processor for validation, tokenization, and submission, or use its hosted fields to collect
          card details. IncrediCard makes no PCI-compliance claim.
        </p>
        <ul className={styles.footerLinks}>
          <li>
            <a href={DOCS_URL}>Docs</a>
          </li>
          <li>
            <a href={DEMO_URL}>Demo</a>
          </li>
          <li>
            <a href={GITHUB_URL}>
              GitHub <ArrowIcon />
            </a>
          </li>
          <li>
            <a href={NPM_URL}>
              npm <ArrowIcon />
            </a>
          </li>
        </ul>
        <p className={styles.footerLegal}>
          Apache-2.0 licensed. Copyright 2026 <a href={AUTHOR_URL}>Mark Fight</a>. Card network marks shown here are the
          trademarks of their owners and appear for demonstration only.
        </p>
      </div>
    </footer>
  );
}

// --- Icons ----------------------------------------------------------------
// Decorative: each sits beside text that says the same thing.

function Icon({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function CardIcon() {
  return (
    <Icon className={styles.brandIcon}>
      <rect x="2.75" y="5.25" width="18.5" height="13.5" rx="2" />
      <path d="M2.75 9.5h18.5" />
    </Icon>
  );
}

function ArrowIcon() {
  return (
    <Icon className={styles.buttonIcon}>
      <path d="M7 17 17 7M9 7h8v8" />
    </Icon>
  );
}

function HeartIcon() {
  return (
    <Icon className={styles.buttonIcon}>
      <path d="m12 19.5-7.4-7.4a4.53 4.53 0 0 1 6.4-6.4l1 1 1-1a4.53 4.53 0 0 1 6.4 6.4z" />
    </Icon>
  );
}




function FlipIcon() {
  return (
    <Icon className={styles.buttonIcon}>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M19.5 4.5v4h-4" />
    </Icon>
  );
}

function ChevronIcon() {
  return (
    <Icon className={styles.chevronIcon}>
      <path d="m7 10 5 5 5-5" />
    </Icon>
  );
}

function CheckIcon() {
  return (
    <Icon className={styles.checkIcon}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Icon>
  );
}
