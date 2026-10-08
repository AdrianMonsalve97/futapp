import type { ReactNode } from 'react';

/** Catálogo de íconos SVG inline (sin librerías). */
export type IconName =
  | 'futbol'
  | 'tarjeta'
  | 'camiseta'
  | 'trofeo'
  | 'dorsal'
  | 'usuario'
  | 'usuarios'
  | 'dinero'
  | 'calendar'
  | 'chart'
  | 'menu'
  | 'logout'
  | 'search'
  | 'plus'
  | 'edit'
  | 'trash'
  | 'close'
  | 'check'
  | 'alert'
  | 'info'
  | 'shield'
  | 'clipboard'
  | 'sparkles'
  | 'arrowRight'
  | 'arrowLeft'
  | 'lock'
  | 'mail'
  | 'whistle'
  | 'refresh'
  | 'eye'
  | 'video'
  | 'settings';

const PATHS: Record<IconName, ReactNode> = {
  video: <><rect x="3" y="5" width="13" height="14" rx="2" /><path d="m16 9 5-3v12l-5-3zM8 9l4 3-4 3z" /></>,
  futbol: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.2l4 2.9-1.5 4.7h-5L8 10.1z" />
      <path d="M12 3v4.2M4.4 9.6l3.6.5M19.6 9.6L16 10.1M7.2 19.3l1.9-4M16.8 19.3l-1.9-4" />
    </>
  ),
  tarjeta: <rect x="6.5" y="3" width="11" height="18" rx="2" />,
  camiseta: <path d="M8.5 3l3.5 2 3.5-2 4 3-2 3-1.5-.9V21H8V8.1L6.5 9l-2-3z" />,
  trofeo: (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
      <path d="M8 5H5a3 3 0 0 0 3 3M16 5h3a3 3 0 0 1-3 3" />
      <path d="M12 13v4M9 20h6M10 16.5h4" />
    </>
  ),
  dorsal: <path d="M9.5 4L7.5 20M17 4l-2 16M4 9h16M3 15h16" />,
  usuario: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5c0-3.6 3.4-5.5 7.5-5.5s7.5 1.9 7.5 5.5" />
    </>
  ),
  usuarios: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.4 2.9-5.4 6.5-5.4s6.5 2 6.5 5.4" />
      <path d="M16.5 5.2a3.5 3.5 0 0 1 0 6.6M18 14.9c2.2.7 3.5 2.4 3.5 5.1" />
    </>
  ),
  dinero: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.8" />
      <path d="M6 12h.01M18 12h.01" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </>
  ),
  chart: <path d="M3 21h18M7 21v-8M12 21V5M17 21v-6" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  logout: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4.3-4.3" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  edit: <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />,
  trash: <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M4 12.5l5 5L20 6.5" />,
  alert: (
    <>
      <path d="M12 3.5l9 16H3z" />
      <path d="M12 10v4.5M12 17.5h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 7.8h.01" />
    </>
  ),
  shield: <path d="M12 3l8 3v6c0 5-3.5 8.2-8 9-4.5-.8-8-4-8-9V6z" />,
  clipboard: (
    <>
      <rect x="6" y="4.5" width="12" height="16.5" rx="2" />
      <path d="M9 4.5V3.5h6v1M9 10.5h6M9 14.5h4" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" />
      <path d="M18.5 15.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" />
    </>
  ),
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
  lock: (
    <>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7.5l9 6 9-6" />
    </>
  ),
  whistle: (
    <>
      <circle cx="8.5" cy="14.5" r="5" />
      <path d="M13.5 12.5H21l-2 4h-6.5M8.5 9.5V6h5" />
    </>
  ),
  refresh: <path d="M21 12a9 9 0 1 1-2.64-6.36M21 4v5h-5" />,
  eye: (
    <>
      <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .32 1.77l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-.97 1.47V21a2 2 0 1 1-4 0v-.11a1.6 1.6 0 0 0-1.05-1.46 1.6 1.6 0 0 0-1.77.32l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.6 1.6 0 0 0 .32-1.77 1.6 1.6 0 0 0-1.47-.97H3a2 2 0 1 1 0-4h.11a1.6 1.6 0 0 0 1.46-1.05 1.6 1.6 0 0 0-.32-1.77l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.6 1.6 0 0 0 1.77.32H9a1.6 1.6 0 0 0 .97-1.47V3a2 2 0 1 1 4 0v.11a1.6 1.6 0 0 0 .97 1.47 1.6 1.6 0 0 0 1.77-.32l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.6 1.6 0 0 0-.32 1.77V9a1.6 1.6 0 0 0 1.47.97H21a2 2 0 1 1 0 4h-.11a1.6 1.6 0 0 0-1.47.97z" />
    </>
  ),
};

export interface IconProps {
  name: IconName;
  /** Tamaño en px (se aplica a width/height). */
  size?: number;
  className?: string;
  strokeWidth?: number;
}

/** Ícono SVG inline, hereda `currentColor`. */
export function Icon({ name, size = 18, className = '', strokeWidth = 1.8 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
