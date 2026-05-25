"use client";

import { useEffect, useRef, useState } from "react";

type RevealOptions = {
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
};

/**
 * IntersectionObserver-based reveal hook. Flips a [data-revealed] attribute on
 * the target element once it scrolls into view; the CSS in globals.css handles
 * the fade-up. Respects prefers-reduced-motion (CSS resets the transform).
 *
 * Usage:
 *   const { ref } = useRevealOnScroll();
 *   return <section ref={ref} data-reveal>...</section>;
 */
export function useRevealOnScroll<T extends HTMLElement = HTMLElement>({
  threshold = 0.15,
  rootMargin = "0px 0px -10% 0px",
  once = true
}: RevealOptions = {}) {
  const ref = useRef<T | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      node.setAttribute("data-revealed", "true");
      setRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            node.setAttribute("data-revealed", "true");
            setRevealed(true);
            if (once) observer.disconnect();
          } else if (!once) {
            node.removeAttribute("data-revealed");
            setRevealed(false);
          }
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  return { ref, revealed };
}
