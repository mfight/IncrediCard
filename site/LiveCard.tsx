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
export function useOnScreen(ref: React.RefObject<Element | null>) {
  const [onScreen, setOnScreen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return onScreen;
}

type StageProps = ComponentProps<"div"> & {
  /** Where the idle path starts, so neighboring stages don't move in step. */
  phase?: number;
};

export function PointerStage({ phase = 0, children, ...rest }: StageProps) {
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
    if (!el || reduced || !onScreen) return;
    const emit = (point: Point) => listeners.current.forEach((listener) => listener(point));

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
  }, [reduced, onScreen, phase]);

  return (
    <StageContext.Provider value={subscribe}>
      <div ref={ref} {...rest}>
        {children}
      </div>
    </StageContext.Provider>
  );
}

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
  const insideRef = useRef(false);
  const pausedUntilRef = useRef(0);

  // The card's own pointer listeners sit on the face wrapper, the one element
  // in either layout carrying `data-face-layout`. Looked up each time, since a
  // theme change can replace it.
  const face = () => ref.current?.querySelector<HTMLElement>("[data-face-layout]") ?? null;
  const leave = () => {
    if (insideRef.current) face()?.dispatchEvent(new PointerEvent("pointerleave", { pointerType: "mouse" }));
    insideRef.current = false;
  };

  useEffect(() => {
    if (!subscribe) return;
    return subscribe((point) => {
      const el = face();
      if (!el) return;
      if (!point) {
        leave();
        return;
      }
      if (performance.now() < pausedUntilRef.current) return;
      insideRef.current = true;
      const rect = el.getBoundingClientRect();
      el.dispatchEvent(
        new PointerEvent("pointermove", {
          pointerType: "mouse",
          clientX: rect.left + rect.width * (0.5 + point.x * reach),
          clientY: rect.top + rect.height * (0.5 + point.y * reach),
        }),
      );
    });
    // `face` and `leave` read only refs, so they needn't be dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribe, reach]);

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
      <IncrediCard autoComplete={false} {...cardProps} flippable={false} />
      {children}
    </div>
  );
}
