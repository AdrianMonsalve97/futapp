import type { RefereePaymentRow, RefereePaymentStatus } from "../types/referee";

const labels: Record<RefereePaymentStatus, string> = {
  sin_cobro: "Sin cobro",
  no_asiste: "Sin asistencia confirmada",
  pendiente: "Pendiente de pago",
  en_revision: "Soporte en revisión",
  a_tiempo: "Pago aprobado a tiempo · habilitado para titular",
  tardio: "Pago o aprobación tardíos · solo suplente",
};

export function refereePaymentLabel(
  row: RefereePaymentRow,
  attendanceOnlyUntil: string | null,
): string {
  if (attendanceOnlyUntil && row.starterEligible)
    return row.outstanding > 0
      ? `${row.pending > 0 ? "Soporte en revisión" : "Arbitraje pendiente"} · habilitado por excepción de hoy`
      : "Pago cubierto · habilitado hoy";
  return labels[row.status];
}
