// The live cards above the three features, in the cobalt demo look. Each is
// a display-only card (see LiveCard) in a scene laid out at one fixed width
// and zoomed to its column, so the three line up and fit at any width.
//
// The page gives each one turn at a time (`act`, a number that changes for
// each new turn and is 0 between them), and each calls `onActDone` when its
// turn is over. A column starts as the page scrolls it into place (side by
// side, the three start one after another as the row rises; stacked, each
// as it reaches the middle) and keeps taking turns while it's on screen.
// Nothing runs off screen.
//
// Reveal: a turn types out the next of four networks' numbers; the details
// and the network's mark appear once the number is complete, then it holds.
// Stopped partway, it finishes the number.
// Depth: a turn floats it, tilted, with its foil catching a light that moves
// with it and a shine sweeping across. Between turns it rests.
// Processor: a turn lifts the puzzle piece holding the card's fields out of
// its socket and drops in the next, each in a different field style, then
// holds. A swap under way always finishes, so no piece is left in mid-air.
//
// With reduced motion, Reveal and Processor fade out, pause briefly and fade
// back in with the next network or piece, and Depth rests at its tilt with
// still foil.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { IncrediCardValue } from "../src";
import { demoAcceptanceMarks } from "../demo/acceptanceMarks";
import { SAMPLE_CARDS } from "../demo/sampleCards";
import { LiveCard, PointerStage, usePrefersReducedMotion } from "./LiveCard";
import { SAMPLE_VALUE } from "./useTypedValue";
import { cobaltTheme } from "./cobaltTheme";
import styles from "./featureDemos.module.scss";

// The scene's zoom, from its column's width: never larger than its own size,
// and smaller as the column narrows. Set before paint.
function useFitZoom() {
  const frameRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const frame = frameRef.current;
    const scene = sceneRef.current;
    if (!frame || !scene) return;
    const fit = () => {
      scene.style.zoom = String(Math.min(1, frame.clientWidth / scene.offsetWidth));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);
  return { frameRef, sceneRef };
}

// `running` false pauses every CSS animation in the scene, the card's own
// included, so nothing keeps the page busy while the column is idle.
// `clip` keeps what moves past the column's sides from widening the page.
function Scene({ children, running, clip = false }: { children: ReactNode; running: boolean; clip?: boolean }) {
  const { frameRef, sceneRef } = useFitZoom();
  return (
    <div ref={frameRef} className={`${styles.frame} ${clip ? styles.clip : ""}`}>
      <div ref={sceneRef} className={styles.scene} data-running={running ? "" : undefined}>
        {children}
      </div>
    </div>
  );
}

const cardProps = {
  theme: cobaltTheme,
  acceptanceMarks: demoAcceptanceMarks,
  lightingEffects: true,
} as const;

// --- Reveal ------------------------------------------------------------------

const REVEAL_NETWORKS = ["visa", "mastercard", "amex", "discover"].map(
  (network) => SAMPLE_CARDS.find((card) => card.network === network)!,
);

const TYPE_MS = 85;
const BEFORE_TYPING_MS = 600;
const HOLD_MS = 2600;

function revealValue(cardNumber: string, cvc = ""): IncrediCardValue {
  return { ...SAMPLE_VALUE, cardNumber, cvc };
}

// One network's turn. Mounted fresh for each, so the card starts empty and
// reveals its details again: the card keeps them revealed once shown.
// `typed` false shows the finished card. Otherwise it types while `running`,
// and stopped, shows the number finished.
function RevealTurn({
  card,
  typed,
  running,
  onDone,
}: {
  card: (typeof REVEAL_NETWORKS)[number];
  typed: boolean;
  running: boolean;
  onDone: () => void;
}) {
  const { cardNumber } = card;
  const [length, setLength] = useState(typed ? 0 : cardNumber.length);

  useEffect(() => {
    if (!typed || !running) return;
    let timer = 0;
    let count = 0;
    const step = () => {
      if (count < cardNumber.length) {
        count += 1;
        setLength(count);
        timer = window.setTimeout(step, TYPE_MS);
      } else {
        timer = window.setTimeout(onDone, HOLD_MS);
      }
    };
    timer = window.setTimeout(step, BEFORE_TYPING_MS);
    return () => window.clearTimeout(timer);
  }, [typed, running, cardNumber, onDone]);

  const shown = running ? length : cardNumber.length;
  return (
    <LiveCard
      id="feature-reveal"
      className={styles.card}
      {...cardProps}
      // The security code shows only on an American Express card's front.
      value={revealValue(cardNumber.slice(0, shown), card.cvc ?? "123")}
    />
  );
}

/** One turn for a demo: `act` changes for each new turn and is 0 between
 * them; the demo calls `onActDone` when the turn is over. */
export type DemoProps = { act: number; onActDone: () => void };

export function RevealDemo({ act, onActDone }: DemoProps) {
  const reduced = usePrefersReducedMotion();
  const [turn, setTurn] = useState(0);
  const [lastAct, setLastAct] = useState(act);
  // With reduced motion: "out" fades the card away, "in" brings the next
  // network's back after a short pause, "shown" holds it.
  const [fade, setFade] = useState<"shown" | "out" | "in">("shown");
  // The turn whose fade has finished, so its hold can end it.
  const [faded, setFaded] = useState(0);
  // Each new turn moves to the next network: typed from empty, or faded in.
  if (act !== lastAct) {
    setLastAct(act);
    if (act === 0) setFade("shown");
    else if (reduced) setFade("out");
    else setTurn((value) => value + 1);
  }
  const card = REVEAL_NETWORKS[turn % REVEAL_NETWORKS.length];
  const running = act !== 0;

  useEffect(() => {
    if (!reduced || act === 0 || fade !== "shown" || faded !== act) return;
    const timer = window.setTimeout(onActDone, HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [reduced, act, fade, faded, onActDone]);

  const handleFadeEnd = (event: React.AnimationEvent) => {
    // The card's own reveal animations bubble here too.
    if (event.target !== event.currentTarget) return;
    if (fade === "out") {
      setTurn((value) => value + 1);
      setFade("in");
    } else if (fade === "in") {
      setFaded(act);
      setFade("shown");
    }
  };

  return (
    <Scene running={running || fade !== "shown"}>
      <div
        className={fade === "out" ? styles.fadeOut : fade === "in" ? styles.fadeIn : undefined}
        onAnimationEnd={handleFadeEnd}
      >
        <RevealTurn key={turn} card={card} typed={!reduced && turn > 0} running={running} onDone={onActDone} />
      </div>
    </Scene>
  );
}

// --- Depth -------------------------------------------------------------------

// A turn's length: one sweep of the shine, with the float around it.
const DEPTH_ACT_MS = 4500;

export function DepthDemo({ act, onActDone }: DemoProps) {
  const running = act !== 0;
  useEffect(() => {
    if (act === 0) return;
    const timer = window.setTimeout(onActDone, DEPTH_ACT_MS);
    return () => window.clearTimeout(timer);
  }, [act, onActDone]);

  return (
    // The stage's own slow path (or the pointer, over it) moves the card
    // and its light together: the light through the card's own lighting,
    // the card through the stage's --stage-x and --stage-y. Between turns,
    // the stage holds still and the card eases back to rest.
    <PointerStage phase={2.4} active={running}>
      <Scene running={running}>
        <div className={styles.float}>
          <LiveCard
            id="feature-depth"
            className={styles.card}
            {...cardProps}
            holofoil
            reach={0.9}
            value={{ ...SAMPLE_VALUE, cvc: "" }}
          />
          {/* Remounted each turn, so every turn has its sweep. */}
          <div key={act} className={styles.shine} />
        </div>
      </Scene>
    </PointerStage>
  );
}

// --- Processor ---------------------------------------------------------------

const PIECE_STYLES = ["plain", "filled", "outlined"] as const;

// The piece's outline: a rectangle with a tab rising from its top edge and a
// notch cut into its right side, in a 100 by 60 box.
const PIECE_PATH =
  "M4 6 H58 C61 6 62 4.5 61 2.8 C59.6 0.3 61.6 -2.5 66 -2.5 C70.4 -2.5 72.4 0.3 71 2.8 C70 4.5 71 6 74 6 H96 " +
  "C98.2 6 100 7.8 100 10 V24 C100 26.5 98.6 27.2 97 26 C94.8 24.4 91.5 25.8 91.5 30 C91.5 34.2 94.8 35.6 97 34 " +
  "C98.6 32.8 100 33.5 100 36 V56 C100 58.2 98.2 60 96 60 H4 C1.8 60 0 58.2 0 56 V10 C0 7.8 1.8 6 4 6 Z";

function PieceShape({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 -3 100 63.5" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path d={PIECE_PATH} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Piece({ look }: { look: (typeof PIECE_STYLES)[number] }) {
  return (
    <div className={`${styles.piece} ${styles[look]}`}>
      <PieceShape className={styles.pieceGlass} />
      <div className={styles.pieceFields}>
        <span className={`${styles.pieceField} ${styles.pieceNumber}`}>4242 4242 4242 4242</span>
        <span className={`${styles.pieceField} ${styles.pieceExpiration}`}>08/29</span>
        <span className={`${styles.pieceField} ${styles.pieceName}`}>Alex Morgan</span>
      </div>
    </div>
  );
}

// How long the new piece holds in place before the turn is over.
const PIECE_HOLD_MS = 1800;

export function ProcessorDemo({ act, onActDone }: DemoProps) {
  const reduced = usePrefersReducedMotion();
  // "out": the piece lifts and leaves to the right; "in": the next arrives
  // from the left and drops in; "rest": it sits in the socket.
  const [phase, setPhase] = useState<"rest" | "out" | "in">("rest");
  const [turn, setTurn] = useState(0);
  const [lastAct, setLastAct] = useState(act);
  // The turn whose swap has finished, so its hold can end it.
  const [swapped, setSwapped] = useState(0);
  if (act !== lastAct) {
    setLastAct(act);
    if (act !== 0) setPhase("out");
  }
  const look = PIECE_STYLES[turn % PIECE_STYLES.length];

  useEffect(() => {
    if (act === 0 || phase !== "rest" || swapped !== act) return;
    const timer = window.setTimeout(onActDone, PIECE_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [act, phase, swapped, onActDone]);

  const handleEnd = (event: React.AnimationEvent) => {
    if (event.target !== event.currentTarget) return;
    if (phase === "out") {
      setTurn((value) => value + 1);
      setPhase("in");
    } else if (phase === "in") {
      setSwapped(act);
      setPhase("rest");
    }
  };

  // With reduced motion the piece fades out and the next fades in, in place.
  const motion =
    phase === "out"
      ? reduced
        ? styles.pieceFadeOut
        : styles.pieceOut
      : phase === "in"
        ? reduced
          ? styles.pieceFadeIn
          : styles.pieceIn
        : styles.pieceRest;

  return (
    // A swap under way finishes even once the turn is taken away.
    <Scene running={act !== 0 || phase !== "rest"} clip>
      <div className={styles.processor}>
        <LiveCard id="feature-processor" className={styles.card} {...cardProps} value={revealValue("")} />
        {/* Where the processor's fields go. */}
        <div className={styles.socket}>
          <PieceShape className={styles.socketShape} />
        </div>
        <div className={motion} onAnimationEnd={handleEnd}>
          <Piece look={look} />
        </div>
      </div>
    </Scene>
  );
}
