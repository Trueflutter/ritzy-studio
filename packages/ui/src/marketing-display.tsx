import type { HTMLAttributes, ReactNode } from "react";

import { cx } from "./utils";

type MarketingDisplayProps = HTMLAttributes<HTMLHeadingElement> & {
  as?: "h1" | "h2";
  children: ReactNode;
};

/**
 * Marketing display heading. Use only on routes covered by §17.3 (currently /login).
 * Renders Cormorant Light at the marketing display tier (clamp 56–96px) with the
 * tight tracking that lands the editorial-but-impactful feel without inheriting the
 * Aura template's aggressive Newsreader 400. Not for use inside the authenticated app.
 */
export function MarketingDisplay({
  as = "h1",
  children,
  className,
  ...props
}: MarketingDisplayProps) {
  const Element = as;
  return (
    <Element
      className={cx(
        "font-display font-light text-ink",
        "text-display-marketing leading-[0.94] tracking-[-0.035em]",
        "[overflow-wrap:anywhere]",
        className
      )}
      {...props}
    >
      {children}
    </Element>
  );
}

/**
 * Short ochre hairline rule used beneath marketing section eyebrows + hero headlines.
 * Aura template's recurring `w-12 h-px bg-[#9f7851]` motif, mapped to Ritzy accent.
 */
export function DecorativeRule({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cx("block h-px w-12 bg-[var(--rs-accent-deep)]", className)}
    />
  );
}

/**
 * Small uppercase eyebrow label used above marketing section headlines.
 * Sits in the muted ochre family — quieter than the body ink, more deliberate than caption.
 */
export function SectionEyebrow({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cx(
        "font-body text-caption font-semibold uppercase tracking-[0.18em] text-[var(--rs-accent-deep)]",
        className
      )}
    >
      {children}
    </p>
  );
}
