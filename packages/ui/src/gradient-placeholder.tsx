import type { HTMLAttributes, ReactNode } from "react";

import { cx } from "./utils";

type GradientPlaceholderProps = HTMLAttributes<HTMLDivElement> & {
  /** Optional italic caption rendered over the gradient (the honest "no image yet" note). */
  caption?: ReactNode;
  captionClassName?: string;
};

/**
 * Honest empty-image surface. When a project has no render, a product image cannot be
 * retrieved, or an optional photo slot is empty, we never show a broken image — we show
 * this warm bone→brass gradient with an optional italic explanation. Maps to the
 * `--rs-empty-grad-*` tokens.
 */
export function GradientPlaceholder({
  caption,
  captionClassName,
  className,
  children,
  ...props
}: GradientPlaceholderProps) {
  return (
    <div
      className={cx(
        "flex flex-col items-center justify-center gap-2 text-center",
        className
      )}
      style={{
        backgroundImage:
          "linear-gradient(180deg, var(--rs-empty-grad-from) 0%, var(--rs-empty-grad-to) 100%)"
      }}
      {...props}
    >
      {caption ? (
        <p
          className={cx(
            "font-display font-light italic text-[var(--rs-accent-deep)]",
            captionClassName
          )}
        >
          {caption}
        </p>
      ) : null}
      {children}
    </div>
  );
}
