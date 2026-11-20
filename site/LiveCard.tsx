// Display-only cards: real IncrediCard instances that nobody can type into
// or tab into, but that still tilt and catch the light.
//
// Each card's wrapper keeps it out of reach three ways: `pointer-events:
// none` lets clicks and hover pass through, every focusable element inside
// gets `tabindex="-1"` (re-applied as the card adds fields), and
// `aria-hidden` takes it out of the accessibility tree. Not `inert`, which
// does all three at once: Safari doesn't draw the card's light inside an
// inert subtree until the pointer stops moving.
//
// With the pointer passing through, the card's tilt and light, which follow
// pointer events on the card itself, would never move. So a `PointerStage`
// (a section of the page) watches the pointer instead and replays it to each
// card inside it, scaled to the card. While the pointer is elsewhere, the
// stage plays a slow path of its own, so the cards keep moving. Under reduced
// motion it plays nothing; the component calms its own effects there too.
//
// On a phone the card follows touch signals rather than a pointer, so the
// path is replayed as a finger dragging across it, until the card can read
// the phone's own tilt and follows that instead (see motion.ts).

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { IncrediCard } from "../src";
import { useMotionMode } from "./motion";

const FOCUSABLE = "a[href], button, input, select, textarea, [tabindex], [contenteditable]";

// How long a card goes without the stage's pointer when it turns over: the
// card's 280ms flip, plus a little. See LiveCard's flip effect.
const FLIP_PAUSE_MS = 360;

type Point = { x: number; y: number } | null;
type Listener = (point: Point) => void;

const StageContext = createContext<((listener: Listener) => () => void) | null>(null);

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia(REDUCED_MOTION).matches);
  useEffect(() => {
    const query = window.matchMedia(REDUCED_MOTION);
    const update = () => setReduced(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

/** Whether the element is on screen, so off-screen motion can stop. */
export function useOnScreen(ref: React.RefObject<Element | null>, rootMargin = "0px") {
  const [onScreen, setOnScreen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { rootMargin });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, rootMargin]);
  return onScreen;
}

type StageProps = ComponentProps<"div"> & {
  /** Where the idle path starts, so neighboring stages don't move in step. */
  phase?: number;
  /** False holds the stage still, its cards at rest, until it's true. */
  active?: boolean;
};

export function PointerStage({ phase = 0, active = true, children, ...rest }: StageProps) {
  const ref = useRef<HTMLDivElement>(null);
  const listeners = useRef(new Set<Listener>());
  const [subscribe] = useState(() => (listener: Listener) => {
    listeners.current.add(listener);
    return () => listeners.current.delete(listener);
  });
  const reduced = usePrefersReducedMotion();
  const onScreen = useOnScreen(ref);

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced || !onScreen || !active) return;
    // Also published on the stage itself, as --stage-x and --stage-y (-0.5
    // to 0.5, unset at rest), so the page can move things with the same
    // signal the cards' light follows.
    const emit = (point: Point) => {
      listeners.current.forEach((listener) => listener(point));
      if (point) {
        el.style.setProperty("--stage-x", point.x.toFixed(4));
        el.style.setProperty("--stage-y", point.y.toFixed(4));
      } else {
        el.style.removeProperty("--stage-x");
        el.style.removeProperty("--stage-y");
      }
    };

    let pointerInside = false;
    let frame = 0;
    const idle = (time: number) => {
      const t = time / 1000 + phase;
      emit({ x: 0.34 * Math.sin(t * 0.45), y: 0.26 * Math.sin(t * 0.7 + 1) });
      frame = requestAnimationFrame(idle);
    };
    const startIdle = () => {
      if (!frame) frame = requestAnimationFrame(idle);
    };
    const stopIdle = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    const handleMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      pointerInside = true;
      stopIdle();
      const rect = el.getBoundingClientRect();
      emit({
        x: (event.clientX - rect.left) / rect.width - 0.5,
        y: (event.clientY - rect.top) / rect.height - 0.5,
      });
    };
    const handleLeave = () => {
      if (!pointerInside) return;
      pointerInside = false;
      startIdle();
    };

    el.addEventListener("pointermove", handleMove);
    el.addEventListener("pointerleave", handleLeave);
    startIdle();
    return () => {
      el.removeEventListener("pointermove", handleMove);
      el.removeEventListener("pointerleave", handleLeave);
      stopIdle();
      emit(null);
    };
  }, [reduced, onScreen, phase, active]);

  return (
    <StageContext.Provider value={subscribe}>
      <div ref={ref} {...rest}>
        {children}
      </div>
    </StageContext.Provider>
  );
}

// The replayed finger's pointer ID: any fixed number, so the card can match a
// press to its moves and its lift.
const TOUCH_POINTER_ID = 7171;

/** A replayed finger's event on the card, at its center unless placed. */
function touchEvent(type: string, el: HTMLElement, x?: number, y?: number) {
  const rect = el.getBoundingClientRect();
  return new PointerEvent(type, {
    pointerType: "touch",
    pointerId: TOUCH_POINTER_ID,
    isPrimary: true,
    clientX: x ?? rect.left + rect.width / 2,
    clientY: y ?? rect.top + rect.height / 2,
  });
}

// The effects that follow the phone's tilt, off for a card far from view.
const ASLEEP = { tilt: false, lightingEffects: false, holofoil: false };

type LiveCardProps = Omit<ComponentProps<typeof IncrediCard>, "ref"> & {
  className?: string;
  /** Written to the wrapper as `data-position`, for the page's own layout. */
  position?: string;
  /** How far toward the card's edges the stage's pointer reaches, 0 to 1. */
  reach?: number;
  children?: ReactNode;
};

export function LiveCard({ className, position, reach = 0.8, children, ...cardProps }: LiveCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const subscribe = useContext(StageContext);
  const mode = useMotionMode();
  // Every card follows the phone's tilt on its own, wherever it is on the
  // page, and each reading repaints it. A dozen cards at once made the ones
  // in view stutter, so a card more than half a screen away sets its
  // effects aside until it comes near. Its look at rest changes, but out of
  // sight.
  const near = useOnScreen(ref, "50% 0px");
  const asleep = mode === "tilt" && !near;
  // How the stage is reaching the card right now: a hovering mouse, a finger
  // pressed on it, or not at all.
  const contactRef = useRef<"mouse" | "touch" | null>(null);
  const pausedUntilRef = useRef(0);

  // The card's own pointer listeners sit on the face wrapper, the one element
  // in either layout carrying `data-face-layout`. Looked up each time, since a
  // theme change can replace it.
  const face = () => ref.current?.querySelector<HTMLElement>("[data-face-layout]") ?? null;
  const leave = () => {
    const el = face();
    if (contactRef.current === "mouse") el?.dispatchEvent(new PointerEvent("pointerleave", { pointerType: "mouse" }));
    if (contactRef.current === "touch") el?.dispatchEvent(touchEvent("pointerup", el));
    contactRef.current = null;
  };

  useEffect(() => {
    // With the phone's tilt live, the card follows the phone instead.
    if (!subscribe || mode === "tilt") return;
    const unsubscribe = subscribe((point) => {
      const el = face();
      if (!el) return;
      if (!point) {
        leave();
        return;
      }
      if (performance.now() < pausedUntilRef.current) return;
      const rect = el.getBoundingClientRect();
      const x = rect.left + rect.width * (0.5 + point.x * reach);
      const y = rect.top + rect.height * (0.5 + point.y * reach);
      if (mode === "pointer") {
        contactRef.current = "mouse";
        el.dispatchEvent(new PointerEvent("pointermove", { pointerType: "mouse", clientX: x, clientY: y }));
        return;
      }
      // On a touch device the card ignores a hovering pointer, so the path
      // arrives as a finger instead: pressed at the card's center, dragged
      // along the path, lifted when the stage stops. The card measures a drag
      // from where the press began, so from the center it lands where the
      // pointer would have.
      if (contactRef.current !== "touch") {
        contactRef.current = "touch";
        el.dispatchEvent(touchEvent("pointerdown", el));
      }
      el.dispatchEvent(touchEvent("pointermove", el, x, y));
    });
    return () => {
      unsubscribe();
      leave();
    };
    // `face` and `leave` read only refs, so they needn't be dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribe, reach, mode]);

  // While a pointer is driving the tilt, the card turns its flip animation
  // off so the two don't fight, and the stage's idle path never stops moving.
  // So when the side changes, the card goes without the stage's pointer for
  // the length of the flip: it eases flat and turns over, then picks the
  // pointer up again. Before paint, in the same commit as the new side:
  // after it, the turn would already have been drawn without its animation.
  const { side } = cardProps;
  const lastSideRef = useRef(side);
  useLayoutEffect(() => {
    if (side === lastSideRef.current) return;
    lastSideRef.current = side;
    pausedUntilRef.current = performance.now() + FLIP_PAUSE_MS;
    leave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side]);

  // Out of the tab order, including fields that appear later (the card
  // reveals the rest once the number is valid) and anything re-rendered.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const lockOut = () => {
      for (const node of el.querySelectorAll<HTMLElement>(FOCUSABLE)) {
        if (node.getAttribute("tabindex") !== "-1") node.setAttribute("tabindex", "-1");
      }
    };
    lockOut();
    const observer = new MutationObserver(lockOut);
    observer.observe(el, { subtree: true, childList: true, attributes: true, attributeFilter: ["tabindex"] });
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      data-position={position}
      aria-hidden="true"
      style={{ pointerEvents: "none" }}
    >
      {/* No flip control: nobody can press it here. The page turns the
          card with `side` instead. */}
      <IncrediCard autoComplete={false} {...cardProps} {...(asleep ? ASLEEP : {})} flippable={false} />
      {children}
    </div>
  );
}
