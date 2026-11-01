"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { backgroundImageUrls } from "./backdropCopy";
import styles from "./IncrediCardBackdropCopy.module.scss";

/** What's behind a card on a refracting theme, for browsers that can't bend
 * the live page. */
export type IncrediCardGlassBackdrop = {
  /** The element whose background sits behind the card. */
  element: RefObject<HTMLElement | null>;
  /** That background, as a CSS `background` value. */
  background: string;
};

// Only Chromium can bend the live page through a backdrop filter (see the
// faces' `backdrop-filter` rules). Every browser can bend an element of its
// own, so where an app says what's behind the card, this draws a copy of it
// on the card and bends that. The stylesheet keeps it out of Chromium.
//
// Only a band around the edge shows, which is the only place the lens bends
// anything. Everywhere else the live page still shows through, so a copy that
// falls slightly out of line can't show across the card.
//
// The copy is lined up by measuring the app's element against the card:
// writing its position directly, not through React, since scrolling would
// otherwise re-render on every frame. It's measured against the face's flat
// wrapper, so tilting and flipping move the copy with the card rather than
// re-aligning it. In the narrow band, that slip reads as more bending.
//
// Until every image has loaded it renders nothing, leaving the plain glass.
export function IncrediCardBackdropCopy({ backdrop }: { backdrop: IncrediCardGlassBackdrop }) {
  const { element, background } = backdrop;
  const imageRef = useRef<HTMLSpanElement>(null);
  const [loaded, setLoaded] = useState<string | null>(null);
  const ready = loaded === background || backgroundImageUrls(background).length === 0;

  useEffect(() => {
    const urls = backgroundImageUrls(background);
    if (urls.length === 0) return undefined;
    let current = true;
    const loads = urls.map(
      (url) =>
        new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = resolve;
          image.onerror = reject;
          image.src = url;
        }),
    );
    Promise.all(loads).then(
      () => {
        if (current) setLoaded(background);
      },
      () => undefined,
    );
    return () => {
      current = false;
    };
  }, [background]);

  useEffect(() => {
    const image = imageRef.current;
    const target = element.current;
    const wrapper = image?.closest<HTMLElement>("[data-face-layout]");
    if (!ready || !image || !target || !wrapper) return undefined;

    function align() {
      const card = wrapper!.getBoundingClientRect();
      const page = target!.getBoundingClientRect();
      // The focus zoom scales the wrapper, and the copy inside it, but not
      // the page.
      const scale = card.width / wrapper!.offsetWidth || 1;
      image!.style.left = `${(page.left - card.left) / scale}px`;
      image!.style.top = `${(page.top - card.top) / scale}px`;
      image!.style.width = `${page.width / scale}px`;
      image!.style.height = `${page.height / scale}px`;
    }

    align();
    const observer = new ResizeObserver(align);
    observer.observe(wrapper);
    observer.observe(target);
    window.addEventListener("scroll", align, { capture: true, passive: true });
    window.addEventListener("resize", align);
    wrapper.addEventListener("transitionend", align);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", align, { capture: true });
      window.removeEventListener("resize", align);
      wrapper.removeEventListener("transitionend", align);
    };
  }, [element, ready]);

  if (!ready) return null;
  return (
    <span className={styles.backdropCopy} aria-hidden="true">
      <span className={styles.bent}>
        <span ref={imageRef} className={styles.image} style={{ background }} />
      </span>
      <span className={styles.tint} />
    </span>
  );
}
