// Formateo en español: dinero, fechas ISO, calificaciones y utilidades varias.

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

const moneyFormatter = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const dateOnlyFmt = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
});
const dateTimeFmt = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric', month: 'long', year: 'numeric',
});
const dateShortOnlyFmt = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC',
});
const dateShortFmt = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit', month: '2-digit', year: 'numeric',
});
const timeFmt = new Intl.DateTimeFormat('es-CO', {
  hour: '2-digit', minute: '2-digit', hour12: false,
});
const weekdayOnlyFmt = new Intl.DateTimeFormat('es-CO', {
  weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
});
const weekdayFmt = new Intl.DateTimeFormat('es-CO', {
  weekday: 'long', day: 'numeric', month: 'long',
});
const weekdayShortOnlyFmt = new Intl.DateTimeFormat('es-CO', {
  weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
});
const weekdayShortFmt = new Intl.DateTimeFormat('es-CO', {
  weekday: 'short', day: 'numeric', month: 'short',
});

/** Convierte un string ISO a Date. `YYYY-MM-DD` se interpreta como medianoche UTC. */
export function parseIsoDate(value: string): Date | null {
  if (DATE_ONLY_RE.test(value)) return new Date(`${value}T00:00:00Z`);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** `$ 1.200.000` */
export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `$ ${moneyFormatter.format(value)}`;
}

/** 1200000 → `1.200.000` */
export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** `11 de octubre de 2026` */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = parseIsoDate(value);
  if (!date) return value;
  return DATE_ONLY_RE.test(value) ? dateOnlyFmt.format(date) : dateTimeFmt.format(date);
}

/** `11/10/2026` */
export function formatDateShort(value: string | null | undefined): string {
  if (!value) return '—';
  const date = parseIsoDate(value);
  if (!date) return value;
  return DATE_ONLY_RE.test(value) ? dateShortOnlyFmt.format(date) : dateShortFmt.format(date);
}

/** `15:00` (vacío si la fecha no tiene hora) */
export function formatTime(value: string | null | undefined): string {
  if (!value || DATE_ONLY_RE.test(value)) return '';
  const date = parseIsoDate(value);
  return date ? timeFmt.format(date) : '';
}

/** `11 de octubre de 2026 · 15:00` */
export function formatDateTime(value: string | null | undefined): string {
  const date = formatDate(value);
  const time = formatTime(value);
  return time ? `${date} · ${time}` : date;
}

/** Referee deadlines and receipt timestamps are displayed in the club's Colombian time zone. */
export function formatColombiaDateTime(value: string): string {
  return new Intl.DateTimeFormat('es-CO',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Bogota'}).format(new Date(value));
}

/** `sábado, 11 de octubre` */
export function formatWeekday(value: string | null | undefined): string {
  if (!value) return '—';
  const date = parseIsoDate(value);
  if (!date) return value;
  return DATE_ONLY_RE.test(value) ? weekdayOnlyFmt.format(date) : weekdayFmt.format(date);
}

/** `sáb, 11 oct` */
export function formatWeekdayShort(value: string | null | undefined): string {
  if (!value) return '—';
  const date = parseIsoDate(value);
  if (!date) return value;
  return DATE_ONLY_RE.test(value) ? weekdayShortOnlyFmt.format(date) : weekdayShortFmt.format(date);
}

/** Calificación 1–10 → `7.4` */
export function formatRating(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toFixed(decimals);
}

/** 0.63 → `63%` */
export function formatPercent(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${(value * 100).toFixed(decimals)}%`;
}

/** 1845 → `30 min` / `1.230 min` */
export function formatMinutes(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${formatNumber(value)} min`;
}

/** Edad a partir de `YYYY-MM-DD`, o `null` si no hay fecha. */
export function ageFrom(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const date = parseIsoDate(birthDate);
  if (!date) return null;
  const today = new Date();
  let age = today.getUTCFullYear() - date.getUTCFullYear();
  const month = today.getUTCMonth() - date.getUTCMonth();
  if (month < 0 || (month === 0 && today.getUTCDate() < date.getUTCDate())) age -= 1;
  return age;
}

/** `Carlos Duarte` → `CD` */
export function initials(fullName: string | null | undefined): string {
  if (!fullName) return '?';
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/** `Lucas Martínez` → `L. Martínez` (para etiquetas cortas del pitch). */
export function shortName(fullName: string | null | undefined, maxLength = 14): string {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const raw = parts.length > 1 ? `${parts[0][0]}. ${parts[parts.length - 1]}` : parts[0];
  return raw.length > maxLength ? `${raw.slice(0, maxLength - 1)}…` : raw;
}

/** `admin` → `Admin`; `tarjeta_amarilla` → `Tarjeta amarilla`. */
export function humanize(value: string | null | undefined): string {
  if (!value) return '—';
  const spaced = value.replace(/_/g, ' ').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Fecha local `YYYY-MM-DD` (para inputs `type="date"`). */
export function todayIso(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Saldo pendiente de una inscripción (nunca negativo). */
export function pendingAmount(amount: number, paid: number): number {
  return Math.max(0, Math.round((amount - paid) * 100) / 100);
}
