// Inline SVG icons — Ritzy doesn't ship an icon library yet, and lucide-react
// would be a meaningful new dep just for this page. These are the
// minimum set the marketing landing needs, all 24×24, currentColor-based, so
// they inherit text color from the parent.

type IconProps = {
  className?: string;
  strokeWidth?: number;
};

const baseProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true
};

export function UploadIcon({ className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg className={className} width="24" height="24" strokeWidth={strokeWidth} {...baseProps}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

export function PlayIcon({ className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg className={className} width="24" height="24" strokeWidth={strokeWidth} {...baseProps}>
      <polygon points="6 4 20 12 6 20 6 4" />
    </svg>
  );
}

export function UsersIcon({ className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg className={className} width="24" height="24" strokeWidth={strokeWidth} {...baseProps}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function BadgeCheckIcon({ className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg className={className} width="24" height="24" strokeWidth={strokeWidth} {...baseProps}>
      <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

export function ShieldCheckIcon({ className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg className={className} width="24" height="24" strokeWidth={strokeWidth} {...baseProps}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

export function SparklesIcon({ className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg className={className} width="24" height="24" strokeWidth={strokeWidth} {...baseProps}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
    </svg>
  );
}

export function ArrowRightIcon({ className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg className={className} width="24" height="24" strokeWidth={strokeWidth} {...baseProps}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

export function CheckIcon({ className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg className={className} width="24" height="24" strokeWidth={strokeWidth} {...baseProps}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function CheckCircleIcon({ className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg className={className} width="24" height="24" strokeWidth={strokeWidth} {...baseProps}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

export function ChevronRightIcon({ className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg className={className} width="24" height="24" strokeWidth={strokeWidth} {...baseProps}>
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

export function ShoppingBagIcon({ className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg className={className} width="24" height="24" strokeWidth={strokeWidth} {...baseProps}>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

export function ScanSearchIcon({ className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg className={className} width="24" height="24" strokeWidth={strokeWidth} {...baseProps}>
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
      <circle cx="12" cy="12" r="3" />
      <line x1="15" y1="15" x2="17" y2="17" />
    </svg>
  );
}

export function PaletteIcon({ className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg className={className} width="24" height="24" strokeWidth={strokeWidth} {...baseProps}>
      <circle cx="13.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="10.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="6.5" cy="12.5" r="1" fill="currentColor" stroke="none" />
      <path d="M12 22a10 10 0 1 1 0-20c5 0 9.27 3.11 9.27 8a4 4 0 0 1-4 4h-1.93a2 2 0 0 0-1.41 3.41 2 2 0 0 1-1.41 3.41Z" />
    </svg>
  );
}

export function LayoutIcon({ className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg className={className} width="24" height="24" strokeWidth={strokeWidth} {...baseProps}>
      <rect x="3" y="3" width="18" height="18" rx="0" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  );
}

export function CrosshairIcon({ className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg className={className} width="24" height="24" strokeWidth={strokeWidth} {...baseProps}>
      <circle cx="12" cy="12" r="9" />
      <line x1="22" y1="12" x2="18" y2="12" />
      <line x1="6" y1="12" x2="2" y2="12" />
      <line x1="12" y1="6" x2="12" y2="2" />
      <line x1="12" y1="22" x2="12" y2="18" />
    </svg>
  );
}

export function BookmarkIcon({ className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg className={className} width="24" height="24" strokeWidth={strokeWidth} {...baseProps}>
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16Z" />
    </svg>
  );
}

export function BriefcaseIcon({ className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg className={className} width="24" height="24" strokeWidth={strokeWidth} {...baseProps}>
      <rect x="2" y="7" width="20" height="14" rx="0" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

export function HouseIcon({ className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg className={className} width="24" height="24" strokeWidth={strokeWidth} {...baseProps}>
      <path d="M3 9.5 12 2l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />
    </svg>
  );
}
