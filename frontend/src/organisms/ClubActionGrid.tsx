import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useFetch } from "../hooks/useFetch";
import { Icon } from "../atoms/Icon";
import type { IconName } from "../atoms/Icon";
import { formatMoney } from "../utils/format";
import type { QrPaymentView } from "../types/payments";

export function ClubActionGrid() {
  const { user } = useAuth(),
    admin = user?.role === "admin";
  const payments = useFetch<QrPaymentView>(
    admin ? null : "/api/me/payment-receipts",
  );
  const available =
    payments.data?.debts
      .filter((row) => !row.cancelled)
      .reduce(
        (sum, row) => sum + Math.max(0, row.outstanding - row.pending),
        0,
      ) ?? 0;
  const pending =
    payments.data?.receipts.filter((row) => row.status === "pendiente")
      .length ?? 0;
  const actions: {
    to: string;
    icon: IconName;
    kicker: string;
    title: string;
    description: string;
  }[] = admin
    ? [
        {
          to: "/admin/pagos-qr",
          icon: "dinero",
          kicker: "TESORERÍA",
          title: "Cada aporte cuenta",
          description: "Revisa los soportes y consulta todos los movimientos.",
        },
        {
          to: "/admin/plantilla?vista=management",
          icon: "usuarios",
          kicker: "EL PLANTEL",
          title: "Un equipo conectado",
          description:
            "Gestiona integrantes, invitaciones y solicitudes de ingreso.",
        },
        {
          to: "/admin/posiciones",
          icon: "trofeo",
          kicker: "LA COMPETICIÓN",
          title: "La liga, fecha a fecha",
          description:
            "Registra los resultados de la jornada y sigue la clasificación.",
        },
      ]
    : [
        {
          to: "/jugador/pagos",
          icon: "dinero",
          kicker: pending
            ? `${pending} SOPORTE${pending === 1 ? "" : "S"} EN REVISIÓN`
            : "TUS APORTES",
          title:
            available > 0
              ? `${formatMoney(available)} por pagar`
              : payments.loading
                ? "Tus pagos, en un lugar"
                : payments.error
                  ? "Consultar mis pagos"
                  : "Revisa tus pagos",
          description:
            "Inscripción, arbitraje y uniformes. Escanea, paga y adjunta el soporte.",
        },
        {
          to: "/jugador/torneos",
          icon: "trofeo",
          kicker: "PREPARA TU TEMPORADA",
          title: "Tu lugar en el torneo",
          description:
            "Consulta tu convocatoria, el reglamento y las fechas. El administrador confirma tu inscripción.",
        },
        {
          to: "/jugador/ia",
          icon: "sparkles",
          kicker: "TU SIGUIENTE NIVEL",
          title: "Haz que tu juego hable",
          description:
            "Descubre tu rol, el planteamiento y las claves para ayudar al equipo.",
        },
      ];
  return (
    <section className="club-action-grid" aria-label="Tu siguiente paso">
      {actions.map((action, index) => (
        <Link key={action.to} to={action.to} className="club-action-card">
          <div>
            <Icon name={action.icon} size={23} />
            <span>0{index + 1}</span>
          </div>
          <small>{action.kicker}</small>
          <h3>{action.title}</h3>
          <p>{action.description}</p>
          <span className="club-action-arrow">
            <Icon name="arrowRight" size={20} />
          </span>
        </Link>
      ))}
    </section>
  );
}
