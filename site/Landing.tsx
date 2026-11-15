import { useEffect, useRef, useState } from "react";
import type { IncrediCardSide, IncrediCardTheme } from "../src";
import { demoAcceptanceMarks } from "../demo/acceptanceMarks";
import { LiveCard, PointerStage, useOnScreen, usePrefersReducedMotion } from "./LiveCard";
import { SAMPLE_VALUE, useTypedValue } from "./useTypedValue";
import styles from "./landing.module.scss";

const STORYBOOK = "/storybook/";
const DEMO_URL = `${STORYBOOK}?path=/story/incredicard--effects`;
const DOCS_URL = `${STORYBOOK}?path=/docs/incredicard-overview--docs`;
const GITHUB_URL = "https://github.com/mfight/IncrediCard";
const NPM_URL = "https://www.npmjs.com/package/incredicard";

const THEMES: { theme: IncrediCardTheme; name: string; summary: string }[] = [
  {
    theme: "ribbons",
    name: "Ribbons",
    summary: "A dark card printed with fine, twisting lines. The default.",
  },
  {
    theme: "vintage",
    name: "Vintage",
    summary: "Embossed plastic, set in OCR-A and OCR-B, the way cards used to be.",
  },
  {
    theme: "globe",
    name: "Globe",
    summary: "The dark card again, engraved with a globe instead of ribbons.",
  },
  {
    theme: "glass",
    name: "Glass",
    summary: "Mostly clear glass that shows the page behind it, with light or dark text to suit.",
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

const ROTATE_MS = 5000;

function Hero() {
  const fanRef = useRef<HTMLDivElement>(null);
  const onScreen = useOnScreen(fanRef);
  const reduced = usePrefersReducedMotion();
  const [turn, setTurn] = useState(0);
  // The side the front card shows. The others always show their fronts, so
  // a card leaving the front turns face-up as it goes.
  const [frontSide, setFrontSide] = useState<IncrediCardSide>("front");
  // Off for good once the visitor flips the card themselves, so the page
  // never turns it against them.
  const [autoFlip, setAutoFlip] = useState(true);
  // Bumped by the Flip card button, which restarts the rotation timer: a
  // visitor who just turned the card gets a full interval to look at it.
  const [rotationStart, setRotationStart] = useState(0);

  useEffect(() => {
    if (!onScreen || reduced) return;
    const timer = window.setInterval(() => {
      setTurn((value) => value + 1);
      setFrontSide("front");
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [onScreen, reduced, rotationStart]);

  // Every other turn, the front card shows its back for a while before the
  // fan moves on.
  useEffect(() => {
    if (!onScreen || reduced || !autoFlip || turn % 2 === 0) return;
    const toBack = window.setTimeout(() => setFrontSide("back"), 1200);
    const toFront = window.setTimeout(() => setFrontSide("front"), 3700);
    return () => {
      window.clearTimeout(toBack);
      window.clearTimeout(toFront);
    };
  }, [turn, onScreen, reduced, autoFlip]);

  const flipFrontCard = () => {
    setAutoFlip(false);
    setFrontSide((side) => (side === "front" ? "back" : "front"));
    setRotationStart((value) => value + 1);
  };

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
          A React payment form with a dimensional card that updates as you type.
        </p>
        <div className={styles.heroActions}>
          <a className={styles.primaryButton} href={DEMO_URL}>
            Try the demo <ArrowIcon />
          </a>
          <a className={styles.secondaryLink} href={DOCS_URL}>
            View docs
          </a>
        </div>

        <div className={styles.fanStage}>
          <div ref={fanRef} className={styles.fan}>
            {START.map((theme, index) => (
              <LiveCard
                key={theme}
                id={`hero-${theme}`}
                className={styles.fanCard}
                position={slotOf(index)}
                side={slotOf(index) === "front" ? frontSide : "front"}
                theme={theme}
                tilt
                chipReflection
                holofoil
                reach={0.6}
                {...cardBase}
              />
            ))}
          </div>
          <div className={styles.fanFooter}>
            <p className={styles.fanCaption}>
              Three of four built-in themes
              <span className={styles.visuallyHidden}>
                : Glass, Vintage and Globe, fanned out above, each showing the same sample card.
              </span>
            </p>
            <button
              type="button"
              className={styles.flipButton}
              aria-pressed={frontSide === "back"}
              onClick={flipFrontCard}
            >
              <FlipIcon />
              Flip card
            </button>
          </div>
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
      <p className={styles.eyebrow}>The card experience</p>
      <h2 id="experience-title" className={styles.sectionTitle}>
        One card. Two ways to enter it.
      </h2>
      <p className={styles.sectionLede}>
        Put the fields right on the card or use a familiar form underneath. In either layout, the card
        responds as you type, paste, or autofill.
      </p>

      <div ref={panelsRef} className={styles.panels}>
        <figure className={styles.panelFigure}>
          <PointerStage className={`${styles.panel} ${styles.panelNeutral}`} phase={1}>
            <LiveCard
              id="experience-floating"
              className={styles.panelCard}
              layout="floating"
              tilt
              chipReflection
              value={floating.value}
              side={floating.side}
              acceptanceMarks={demoAcceptanceMarks}
            />
          </PointerStage>
          <figcaption>
            <h3 className={styles.panelTitle}>Fields on the card</h3>
            <p className={styles.panelText}>
              In the floating layout, the card face holds the actual inputs. Flip to the back when it’s
              time to enter the security code.
            </p>
          </figcaption>
        </figure>

        <figure className={styles.panelFigure}>
          <PointerStage className={`${styles.panel} ${styles.panelBlue}`} phase={3}>
            <LiveCard
              id="experience-stacked"
              className={`${styles.panelCard} ${styles.panelCardStacked}`}
              layout="stacked"
              tilt
              chipReflection
              value={stacked.value}
              side={stacked.side}
              acceptanceMarks={demoAcceptanceMarks}
            />
          </PointerStage>
          <figcaption>
            <h3 className={styles.panelTitle}>Fields below the card</h3>
            <p className={styles.panelText}>
              In the stacked layout, a live visual preview sits above a conventional form with visible
              labels.
            </p>
          </figcaption>
        </figure>
      </div>

      <ul className={styles.features}>
        <li className={styles.feature}>
          <RevealIcon />
          <h3 className={styles.featureTitle}>Reveal fields as needed</h3>
          <p className={styles.featureText}>
            Only the number shows at first. The expiration, name and security code appear once it’s a
            valid number, so the form is never longer than it needs to be.
          </p>
        </li>
        <li className={styles.feature}>
          <DepthIcon />
          <h3 className={styles.featureTitle}>Add a sense of depth</h3>
          <p className={styles.featureText}>
            A chip that catches the light, a holographic foil, tilt toward the pointer or the phone, and
            zoom on focus. Each is optional, and each respects reduced motion.
          </p>
        </li>
        <li className={styles.feature}>
          <ProcessorIcon />
          <h3 className={styles.featureTitle}>Bring your own processor</h3>
          <p className={styles.featureText}>
            Your payment processor’s hosted fields can take the number, expiration and security code,
            so card data never touches your page. The card, flip and Tab order work around them.
          </p>
        </li>
      </ul>
    </section>
  );
}

// --- Themes ---------------------------------------------------------------

function Themes() {
  return (
    <section className={styles.themesBand} aria-labelledby="themes-title">
      <div className={styles.section}>
        <p className={styles.eyebrow}>Themes</p>
        <h2 id="themes-title" className={styles.sectionTitle}>
          Four looks, or your own.
        </h2>
        <p className={styles.sectionLede}>
          Pick a built-in theme with one prop, or start from one with <code>extendIncrediCardTheme</code>{" "}
          and change its colors, artwork and type.
        </p>
        <ul className={styles.themeGrid}>
          {THEMES.map(({ theme, name, summary }, index) => (
            <li key={theme} className={styles.themeItem}>
              <PointerStage
                className={`${styles.themeStage} ${theme === "glass" ? styles.themeStageGlass : ""}`}
                phase={index * 1.7}
              >
                <LiveCard
                  id={`theme-${theme}`}
                  className={styles.themeCard}
                  theme={theme}
                  tilt
                  chipReflection
                  holofoil
                  {...cardBase}
                />
              </PointerStage>
              <h3 className={styles.themeName}>
                {name} <code className={styles.themeProp}>{`theme="${theme}"`}</code>
              </h3>
              <p className={styles.themeSummary}>{summary}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// --- Real fields ----------------------------------------------------------

const FIELD_POINTS = [
  {
    title: "Labeled, ordinary inputs",
    text: "Name, number, expiration and security code are real form fields with labels, autocomplete values and error messages.",
  },
  {
    title: "Keyboard and screen readers",
    text: "Tab moves through the fields and flips the card when the next one is on the back. The card’s decoration stays out of the way of assistive technology.",
  },
  {
    title: "Paste and autofill",
    text: "Pasting a number or accepting the browser’s saved card fills the card the same way typing does.",
  },
  {
    title: "Eight networks",
    text: "Visa, Mastercard, American Express, Discover, Diners Club, JCB, Maestro and UnionPay, each with its own grouping, length and security-code rules.",
  },
  {
    title: "Reduced motion",
    text: "Under reduced motion, every effect keeps its state and loses only its movement.",
  },
  {
    title: "Nothing but React",
    text: "Styles, fonts and English strings ship with it, and every string can be replaced.",
  },
];

function RealFields() {
  return (
    <section className={styles.section} aria-labelledby="fields-title">
      <div className={styles.split}>
        <div>
          <p className={styles.eyebrow}>Underneath</p>
          <h2 id="fields-title" className={styles.sectionTitle}>
            The card is just a picture of real fields.
          </h2>
          <p className={styles.sectionLede}>
            Everything a person can type into is a standard, accessible input. The card mirrors those
            fields; it never replaces them.
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
  return <IncrediCard id="payment" tilt chipReflection />;
}`;

function Install() {
  return (
    <section className={styles.installBand} aria-labelledby="install-title">
      <div className={`${styles.section} ${styles.split}`}>
        <div>
          <p className={`${styles.eyebrow} ${styles.eyebrowOnDark}`}>Get started</p>
          <h2 id="install-title" className={styles.sectionTitle}>
            Install it from npm.
          </h2>
          <p className={styles.sectionLede}>
            Import the stylesheet once, then render the component. It needs React 19.2 or later.
          </p>
          <div className={styles.installActions}>
            <a className={styles.primaryButton} href={DOCS_URL}>
              Read the docs
            </a>
            <a className={styles.secondaryLink} href={NPM_URL}>
              View on npm <ArrowIcon />
            </a>
          </div>
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
          <strong>IncrediCard is not a payment integration.</strong> It checks the format of what’s typed.
          It has no payment processor, no tokenization and no submission flow, and it makes no
          PCI-compliance claim. Pair it with your processor’s own validation, or let your processor’s
          hosted fields take the card data.
        </p>
        <ul className={styles.footerLinks}>
          <li>
            <a href={DOCS_URL}>Docs</a>
          </li>
          <li>
            <a href={DEMO_URL}>Demo</a>
          </li>
          <li>
            <a href={GITHUB_URL}>GitHub</a>
          </li>
          <li>
            <a href={NPM_URL}>npm</a>
          </li>
        </ul>
        <p className={styles.footerLegal}>
          Apache-2.0 licensed. Copyright 2026 Mark Fight. Card network marks shown here are the
          trademarks of their owners and appear for demonstration only.
        </p>
      </div>
    </footer>
  );
}

// --- Icons ----------------------------------------------------------------
// Decorative: each sits beside text that says the same thing.

function Icon({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      className={className ?? styles.icon}
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
    <Icon className={styles.arrowIcon}>
      <path d="M7 17 17 7M9 7h8v8" />
    </Icon>
  );
}

function RevealIcon() {
  return (
    <Icon>
      <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
      <path d="M8 12h8" />
    </Icon>
  );
}

function DepthIcon() {
  return (
    <Icon>
      <path d="M10 4.5 11.6 9a1.5 1.5 0 0 0 .9.9L17 11.5l-4.5 1.6a1.5 1.5 0 0 0-.9.9L10 18.5 8.4 14a1.5 1.5 0 0 0-.9-.9L3 11.5l4.5-1.6a1.5 1.5 0 0 0 .9-.9z" />
      <path d="M18 3v4M16 5h4M18.5 15.5v3M17 17h3" />
    </Icon>
  );
}

function ProcessorIcon() {
  return (
    <Icon>
      <path d="M12 3.5 5 6v5.5c0 4.3 2.9 7.6 7 9 4.1-1.4 7-4.7 7-9V6z" />
    </Icon>
  );
}

function FlipIcon() {
  return (
    <Icon className={styles.flipIcon}>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M19.5 4.5v4h-4" />
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
