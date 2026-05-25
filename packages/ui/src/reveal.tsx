"use client";

import type { HTMLAttributes, ReactNode } from "react";

import { useRevealOnScroll } from "./use-reveal-on-scroll";
import { cx } from "./utils";

type RevealProps = HTMLAttributes<HTMLDivElement> & {
  as?: "div" | "section" | "article" | "header" | "footer" | "aside";
  delay?: 0 | 100 | 200 | 300 | 500 | 700;
  children: ReactNode;
};

const delayClass: Record<NonNullable<RevealProps["delay"]>, string> = {
  0: "",
  100: "[transition-delay:100ms]",
  200: "[transition-delay:200ms]",
  300: "[transition-delay:300ms]",
  500: "[transition-delay:500ms]",
  700: "[transition-delay:700ms]"
};

/**
 * Wraps children with the [data-reveal] attribute that the globals.css reveal CSS
 * watches. Uses IntersectionObserver via useRevealOnScroll to flip [data-revealed]
 * the first time the wrapper scrolls into view.
 *
 * Only use on marketing routes (§17.3). Reduced-motion users see content instantly.
 */
export function Reveal({
  as = "div",
  delay = 0,
  children,
  className,
  ...props
}: RevealProps) {
  const Element = as as "div";
  const { ref } = useRevealOnScroll<HTMLDivElement>();

  return (
    <Element
      ref={ref}
      data-reveal=""
      className={cx(delayClass[delay], className)}
      {...props}
    >
      {children}
    </Element>
  );
}
