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

// A piece: the processor's fields on glass. The glass (and the slot under
// it) fades away once the piece is placed, so its fields sit on the card as
// if they were the card's own.
function Piece({ look }: { look: (typeof PIECE_STYLES)[number] }) {
  return (
    <div className={`${styles.piece} ${styles[look]}`}>
      <div className={styles.pieceGlass} />
      <div className={styles.pieceFields}>
        <span className={`${styles.pieceField} ${styles.pieceNumber}`}>4242 4242 4242 4242</span>
        <span className={`${styles.pieceField} ${styles.pieceExpiration}`}>08/29</span>
        <span className={`${styles.pieceField} ${styles.pieceName}`}>Alex Morgan</span>
      </div>
    </div>
  );
}

// The card under the piece shows no fields of its own: the piece's are its.
const NO_PLACEHOLDERS = {
  cardNumberPlaceholder: "",
  cardholderNamePlaceholder: "",
  expirationPlaceholder: "",
  cvcPlaceholder: "",
};

// A turn, step by step:
//   "merged": the piece sits on the card, its glass and slot gone;
//   "unmerge": the slot and glass fade back in;
//   "out": the piece lifts and leaves to the right (with reduced motion,
//     fades out where it is, then "gap", a short pause);
//   "in": the next arrives from the left and drops into the slot (with
//     reduced motion, fades in where it is);
//   "merge": the slot and glass fade away again;
// then it holds before the turn is over.
type PiecePhase = "merged" | "unmerge" | "out" | "gap" | "in" | "merge";

const PIECE_MS = {
  beforeTurn: 250,
  glass: 350,
  move: 1100,
  fade: 350,
  gap: 150,
  hold: 1800,
};

export function ProcessorDemo({ act, onActDone }: DemoProps) {
  const reduced = usePrefersReducedMotion();
  const [phase, setPhase] = useState<PiecePhase>("merged");
  const [turn, setTurn] = useState(0);
  // The turn whose swap has begun, so each turn swaps once.
  const [started, setStarted] = useState(0);
  const look = PIECE_STYLES[turn % PIECE_STYLES.length];

  // A new turn starts its swap once the piece is settled.
  useEffect(() => {
    if (act === 0 || started === act || phase !== "merged") return;
    const timer = window.setTimeout(() => {
      setStarted(act);
      setPhase("unmerge");
    }, PIECE_MS.beforeTurn);
    return () => window.clearTimeout(timer);
  }, [act, started, phase]);

  // Each step leads to the next. A swap under way finishes even once the
  // turn is taken away, so no piece is left in mid-air.
  useEffect(() => {
    const steps: Partial<Record<PiecePhase, [PiecePhase, number]>> = {
      unmerge: ["out", PIECE_MS.glass],
      out: reduced ? ["gap", PIECE_MS.fade] : ["in", PIECE_MS.move],
      gap: ["in", PIECE_MS.gap],
      in: ["merge", reduced ? PIECE_MS.fade : PIECE_MS.move],
      merge: ["merged", PIECE_MS.glass],
    };
    const step = steps[phase];
    if (!step) return;
    const [next, duration] = step;
    const timer = window.setTimeout(() => {
      if (next === "in") setTurn((value) => value + 1);
      setPhase(next);
    }, duration);
    return () => window.clearTimeout(timer);
  }, [phase, reduced]);

  // Settled after its swap, the piece holds, and the turn is over.
  useEffect(() => {
    if (act === 0 || phase !== "merged" || started !== act) return;
    const timer = window.setTimeout(onActDone, PIECE_MS.hold);
    return () => window.clearTimeout(timer);
  }, [act, phase, started, onActDone]);

  const timing = {
    "--piece-glass": `${PIECE_MS.glass}ms`,
    "--piece-move": `${PIECE_MS.move}ms`,
    "--piece-fade": `${PIECE_MS.fade}ms`,
  } as React.CSSProperties;

  return (
    <Scene running={act !== 0 || phase !== "merged"} clip>
      <div className={styles.processor} data-phase={phase} data-reduced={reduced ? "" : undefined} style={timing}>
        <LiveCard
          id="feature-processor"
          className={styles.card}
          {...cardProps}
          labels={NO_PLACEHOLDERS}
          value={revealValue("")}
        />
        {/* Where the processor's fields go. */}
        <div className={styles.socket} />
        <div className={styles.pieceMotion}>
          <Piece look={look} />
        </div>
      </div>
    </Scene>
  );
}
