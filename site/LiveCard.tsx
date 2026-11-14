// Display-only cards: real IncrediCard instances that nobody can type into
// or tab into, but that still tilt and catch the light.
//
// Each card sits in an `inert` wrapper, which takes it out of the tab order,
// out of the accessibility tree and out of reach of clicks. Inert also stops
// the pointer from reaching it, though, and the card's tilt and light follow
// pointer events on the card itself. So a `PointerStage` (a section of the
// page) watches the pointer instead and replays it to each card inside it,
// scaled to the card. While the pointer is elsewhere, the stage plays a slow
// path of its own, so the cards keep moving. Under reduced motion it plays
// nothing; the component calms its own effects there too.

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { IncrediCard } from "../src";

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

  useEffect(() => {
    if (!subscribe) return;
    let inside = false;
    return subscribe((point) => {
      // The card's own pointer listeners sit on the face wrapper, the one
      // element in either layout carrying `data-face-layout`. Looked up on
      // each event, since a theme change can replace it.
      const face = ref.current?.querySelector<HTMLElement>("[data-face-layout]");
      if (!face) return;
      if (!point) {
        if (inside) face.dispatchEvent(new PointerEvent("pointerleave", { pointerType: "mouse" }));
        inside = false;
        return;
      }
      inside = true;
      const rect = face.getBoundingClientRect();
      face.dispatchEvent(
        new PointerEvent("pointermove", {
          pointerType: "mouse",
          clientX: rect.left + rect.width * (0.5 + point.x * reach),
          clientY: rect.top + rect.height * (0.5 + point.y * reach),
        }),
      );
    });
  }, [subscribe, reach]);

  return (
    <div ref={ref} className={className} data-position={position} inert>
      <IncrediCard autoComplete={false} {...cardProps} />
      {children}
    </div>
  );
}
