import type { HTMLAttributes, ReactNode } from "react";

import { cx } from "./utils";

type CardProps = HTMLAttributes<HTMLElement> & {
  as?: "article" | "section" | "div";
  children: ReactNode;
};

export function Card({ as: Element = "article", children, className, ...props }: CardProps) {
  return (
    <Element
      className={cx(
        "border border-[var(--rs-border)] bg-[var(--rs-surface)] shadow-none",
        className
      )}
      {...props}
    >
      {children}
    </Element>
  );
}

export function Panel({ children, className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cx("border border-[var(--rs-border)] bg-[var(--rs-surface)]", className)}
      {...props}
    >
      {children}
    </section>
  );
}
