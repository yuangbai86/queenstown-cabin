import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 16): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
});

export const IconCheck = ({ size, ...p }: P) => (
  <svg {...base(size ?? 12)} strokeWidth={3} {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
export const IconSwap = ({ size, ...p }: P) => (
  <svg {...base(size ?? 20)} {...p}>
    <path d="M7 4L3 8l4 4" />
    <path d="M3 8h13" />
    <path d="M17 20l4-4-4-4" />
    <path d="M21 16H8" />
  </svg>
);
export const IconClose = ({ size, ...p }: P) => (
  <svg {...base(size ?? 18)} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const IconExternal = ({ size, ...p }: P) => (
  <svg {...base(size ?? 13)} {...p}>
    <path d="M14 4h6v6" />
    <path d="M20 4l-9 9" />
    <path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
  </svg>
);
export const IconInfo = ({ size, ...p }: P) => (
  <svg {...base(size ?? 16)} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
);
export const IconAlert = ({ size, ...p }: P) => (
  <svg {...base(size ?? 16)} {...p}>
    <path d="M12 3l9.5 16.5H2.5L12 3z" />
    <path d="M12 10v4M12 17h.01" />
  </svg>
);
export const IconFlask = ({ size, ...p }: P) => (
  <svg {...base(size ?? 14)} {...p}>
    <path d="M9 3h6M10 3v6L4.5 18.5A1.5 1.5 0 0 0 5.8 21h12.4a1.5 1.5 0 0 0 1.3-2.5L14 9V3" />
    <path d="M7 15h10" />
  </svg>
);
export const IconChevron = ({ size, ...p }: P) => (
  <svg {...base(size ?? 14)} {...p}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);
export const IconBack = ({ size, ...p }: P) => (
  <svg {...base(size ?? 16)} {...p}>
    <path d="M15 6l-6 6 6 6" />
  </svg>
);
export const IconDoc = ({ size, ...p }: P) => (
  <svg {...base(size ?? 14)} {...p}>
    <path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
    <path d="M14 3v5h5M9 13h6M9 17h6" />
  </svg>
);
export const IconSpark = ({ size, ...p }: P) => (
  <svg {...base(size ?? 14)} {...p}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" />
  </svg>
);
export const IconRule = ({ size, ...p }: P) => (
  <svg {...base(size ?? 14)} {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M7 9h10M7 13h6" />
  </svg>
);
