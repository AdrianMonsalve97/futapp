import { useId, type ReactNode } from "react";

/** The same perspective and markings for formations, coaching and animated plays. */
export function TacticalPitch({ children }: { children?: ReactNode }) {
  const gradient = `pitch-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const clip = `${gradient}-bounds`;
  return (
    <svg
      className="fc-pitch-lines"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#123c32" />
          <stop offset="1" stopColor="#245e46" />
        </linearGradient>
        <clipPath id={clip}>
          <path d="M17 7H83L98 96H2Z" />
        </clipPath>
      </defs>
      <path d="M17 7H83L98 96H2Z" fill={`url(#${gradient})`} />
      <g clipPath={`url(#${clip})`} fill="#b1dfa4" opacity=".07">
        {[7, 29, 51, 73, 95].map((y) => (
          <rect key={y} x="0" y={y} width="100" height="11" />
        ))}
      </g>
      <g fill="none" stroke="#d5ecdc" strokeOpacity=".42" strokeWidth=".32">
        <path d="M17 7H83L98 96H2ZM9.5 51.5H90.5M38 7L36 19H64L62 7M33 96L35 80H65L67 96M43 7L42.5 12H57.5L57 7M40 96L40.8 89H59.2L60 96" />
        <ellipse cx="50" cy="51.5" rx="10.5" ry="8.5" />
        <path d="M42 19Q50 27 58 19M42 80Q50 72 58 80" />
        <path d="M46 7V4H54V7M43 96V99H57V96" />
      </g>
      <g fill="#d7ebd9" opacity=".6">
        <circle cx="50" cy="51.5" r=".5" />
        <circle cx="50" cy="15" r=".4" />
        <circle cx="50" cy="86" r=".4" />
      </g>
      <g stroke="#d0f4e9" strokeOpacity=".025" strokeWidth="6">
        <path d="M16 18H84M14 31H86M11 44H89M9 57H91M6 70H94M4 83H96" />
      </g>
      {children}
    </svg>
  );
}
