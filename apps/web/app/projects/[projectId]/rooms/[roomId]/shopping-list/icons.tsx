import type { SVGProps } from "react";

export function LockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden
      fill="none"
      height="16"
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="miter"
      strokeWidth="1.25"
      viewBox="0 0 16 16"
      width="16"
      {...props}
    >
      <rect height="8" rx="0" width="11" x="2.5" y="6.5" />
      <path d="M5 6.5V4.25a3 3 0 0 1 6 0V6.5" />
    </svg>
  );
}

export function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden
      fill="none"
      height="14"
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="miter"
      strokeWidth="1.5"
      viewBox="0 0 14 14"
      width="14"
      {...props}
    >
      <path d="M2.5 7.5l3 3 6-7" />
    </svg>
  );
}

export function CloseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden
      fill="none"
      height="16"
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="miter"
      strokeWidth="1.25"
      viewBox="0 0 16 16"
      width="16"
      {...props}
    >
      <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
    </svg>
  );
}

export function ExpandIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden
      fill="none"
      height="16"
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="miter"
      strokeWidth="1.25"
      viewBox="0 0 16 16"
      width="16"
      {...props}
    >
      <path d="M6.25 3.25h-3v3M3.25 3.25l4 4M9.75 12.75h3v-3M12.75 12.75l-4-4" />
    </svg>
  );
}
