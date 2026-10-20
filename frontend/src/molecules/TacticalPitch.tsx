import { useId, type ReactNode } from "react";

/** Shared holographic stage: field coordinates remain the source of truth for every overlay. */
export function TacticalPitch({ children }: { children?: ReactNode }) {
  const id = `pitch-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg
      className="fc-pitch-lines"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#182250" stopOpacity=".72" />
          <stop offset="1" stopColor="#203b73" stopOpacity=".62" />
        </linearGradient>
        <linearGradient id={`${id}-beam`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#71d9ff" stopOpacity="0" />
          <stop offset=".5" stopColor="#71d9ff" stopOpacity=".55" />
          <stop offset="1" stopColor="#b397ff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}-bounds`}>
          <path d="M17 7H83L98 96H2Z" />
        </clipPath>
      </defs>
      <g className="fc-stage-ribbons" fill="none" stroke={`url(#${id}-beam)`}>
        <path
          d="M-12 2L28 27L72 8L112 32M-8 53L27 68L78 34L110 56"
          strokeWidth="1.6"
        />
        <path
          d="M-5 8L27 29L74 12L106 34M-8 75L40 90L105 55"
          strokeWidth=".3"
        />
      </g>
      <path className="fc-pitch-plinth" d="M2 96L4 100H96L98 96Z" />
      <path d="M17 7H83L98 96H2Z" fill={`url(#${id})`} />
      <g
        clipPath={`url(#${id}-bounds)`}
        className="fc-pitch-grid"
        fill="none"
        strokeWidth=".16"
      >
        <path d="M0 18H100M0 29H100M0 40H100M0 62H100M0 73H100M0 84H100M28 7L18 96M39 7L34 96M61 7L66 96M72 7L82 96" />
        <path className="fc-pitch-scan" d="M0 0H100" strokeWidth="1" />
      </g>
      <g className="fc-pitch-markings" fill="none" strokeWidth=".32">
        <path d="M17 7H83L98 96H2ZM9.5 51.5H90.5M38 7L36 19H64L62 7M33 96L35 80H65L67 96M43 7L42.5 12H57.5L57 7M40 96L40.8 89H59.2L60 96" />
        <ellipse cx="50" cy="51.5" rx="10.5" ry="8.5" />
        <path d="M42 19Q50 27 58 19M42 80Q50 72 58 80M46 7V4H54V7M43 96V99H57V96" />
      </g>
      <g className="fc-pitch-spots">
        <circle cx="50" cy="51.5" r=".5" />
        <circle cx="50" cy="15" r=".4" />
        <circle cx="50" cy="86" r=".4" />
      </g>
      <g className="fc-pitch-rails" fill="none" strokeWidth=".5">
        <path d="M16 10L3 91M84 10L97 91M10 97H33M67 97H90" />
      </g>
      {children}
    </svg>
  );
}
