import { useId, type ReactNode } from "react";

/** The same perspective and markings for formations, coaching and animated plays. */
export function TacticalPitch({ children }: { children?: ReactNode }) {
  const gradient = `pitch-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg
      className="fc-pitch-lines"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#142535" />
          <stop offset="1" stopColor="#23414b" />
        </linearGradient>
      </defs>
      <path d="M17 7H83L98 96H2Z" fill={`url(#${gradient})`} />
      <g fill="none" stroke="#c0e0e1" strokeOpacity=".26" strokeWidth=".32">
        <path d="M17 7H83L98 96H2ZM9.5 51.5H90.5M38 7L36 19H64L62 7M33 96L35 80H65L67 96M43 7L42.5 12H57.5L57 7M40 96L40.8 89H59.2L60 96" />
        <ellipse cx="50" cy="51.5" rx="10.5" ry="8.5" />
        <path d="M46 7V4H54V7M43 96V99H57V96" />
      </g>
      <g stroke="#d0f4e9" strokeOpacity=".025" strokeWidth="6">
        <path d="M16 18H84M14 31H86M11 44H89M9 57H91M6 70H94M4 83H96" />
      </g>
      {children}
    </svg>
  );
}
