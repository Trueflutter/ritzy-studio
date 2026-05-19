"use client";

import { useEffect, useState } from "react";

import { cx } from "./utils";

type AnimatedStatusProps = {
  phases: string[];
  interval?: number;
  className?: string;
};

const FADE_MS = 480;

export function AnimatedStatus({ phases, interval = 2400, className }: AnimatedStatusProps) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (phases.length <= 1) {
      return;
    }

    const fadeOut = window.setTimeout(() => {
      setVisible(false);
    }, Math.max(interval - FADE_MS, FADE_MS));

    const advance = window.setTimeout(() => {
      setIndex((current) => (current + 1) % phases.length);
      setVisible(true);
    }, interval);

    return () => {
      window.clearTimeout(fadeOut);
      window.clearTimeout(advance);
    };
  }, [index, interval, phases.length]);

  const phrase = phases[index] ?? "";

  return (
    <p
      aria-live="polite"
      className={cx(
        "font-display text-display-xs font-light italic leading-snug text-ink transition-opacity ease-standard",
        className
      )}
      style={{
        transitionDuration: `${FADE_MS}ms`,
        opacity: visible ? 1 : 0
      }}
    >
      <span>{phrase}</span>
      <span aria-hidden className="ml-1 inline-flex">
        <span className="animated-status-dot" style={{ animationDelay: "0ms" }}>
          .
        </span>
        <span className="animated-status-dot" style={{ animationDelay: "180ms" }}>
          .
        </span>
        <span className="animated-status-dot" style={{ animationDelay: "360ms" }}>
          .
        </span>
      </span>
    </p>
  );
}
