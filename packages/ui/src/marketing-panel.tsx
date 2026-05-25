import type { HTMLAttributes, ReactNode } from "react";

import { cx } from "./utils";

export type MarketingPanelTone = "paper" | "subtle" | "ink";
export type MarketingPanelElevation = "flat" | "float";

type MarketingPanelProps = HTMLAttributes<HTMLElement> & {
  as?: "article" | "section" | "aside" | "div";
  tone?: MarketingPanelTone;
  elevation?: MarketingPanelElevation;
  children: ReactNode;
};

const toneClass: Record<MarketingPanelTone, string> = {
  paper: "bg-surface text-ink border-line",
  subtle: "bg-surface-subtle text-ink border-line",
  ink: "bg-surface-ink text-ink-on-dark border-transparent"
};

const elevationClass: Record<MarketingPanelElevation, string> = {
  flat: "",
  float: "shadow-marketing-float"
};

/**
 * Marketing-surface panel — the Ritzy translation of the Aura template's "premium-panel"
 * class. Hairline border, 4px corner (rounded-card), one optional float shadow.
 *
 * Differences vs Aura's premium-panel: no 20px radius, no inset white highlight, single
 * shadow tier instead of triple-drop. Matches §17.3 locked rules.
 */
export function MarketingPanel({
  as: Element = "div",
  tone = "paper",
  elevation = "flat",
  children,
  className,
  ...props
}: MarketingPanelProps) {
  return (
    <Element
      className={cx(
        "rounded-card border",
        toneClass[tone],
        elevationClass[elevation],
        className
      )}
      {...props}
    >
      {children}
    </Element>
  );
}
