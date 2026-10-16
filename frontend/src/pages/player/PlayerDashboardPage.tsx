import { MatchDayHero } from "../../organisms/MatchDayHero";
import { ClubActionGrid } from "../../organisms/ClubActionGrid";
import { ClubHomeExtras } from "../../organisms/ClubHomeExtras";
import { ClubMatchStrip } from "../../organisms/ClubMatchStrip";
import { Link } from "react-router-dom";
import { useFetch } from "../../hooks/useFetch";
import { PageHeader } from "../../templates/PageHeader";
import { Alert } from "../../atoms/Alert";
import { Card, CardBody, CardTitle } from "../../atoms/Card";
import { EmptyState } from "../../atoms/EmptyState";
import { Icon } from "../../atoms/Icon";
import { Spinner } from "../../atoms/Spinner";
import { StatCardsRow } from "../../organisms/StatCardsRow";
import { RatingTrendChart } from "../../organisms/RatingTrendChart";
import { StatusBadge } from "../../molecules/StatusBadge";
import { Money } from "../../molecules/Money";
import { formatRating, pendingAmount } from "../../utils/format";
import type { DashboardPlayer, MeMatchesResponse } from "../../types/api";

/** Dashboard del jugador (SPEC §10.4). */
export function PlayerDashboardPage() {
  const { data, loading, error, reload } = useFetch<DashboardPlayer>(
    "/api/dashboard/player",
  );
  const matches = useFetch<MeMatchesResponse>("/api/me/matches");

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }
  if (error) {
    return (
      <>
        <PageHeader
          title="Mi centro de juego"
          subtitle="Resumen de tu estado en el equipo"
        />
        <Alert tone="error" title="No se pudo cargar tu panel" onClose={reload}>
          {error}
        </Alert>
      </>
    );
  }
  if (!data) {
    return (
      <>
        <PageHeader
          title="Mi centro de juego"
          subtitle="Resumen de tu estado en el equipo"
        />
        <EmptyState
          title="Sin información"
          message="No hay datos disponibles por el momento."
        />
      </>
    );
  }

  const {
    inscription,
    upcomingMatch,
    myStats,
    myRecentStats,
    mySanctions,
    uniforms,
    forecast,
  } = data;
  const activeSanctions = mySanctions.filter(
    (item) => item.status === "activa",
  );
  const pending = inscription
    ? pendingAmount(inscription.amount, inscription.paid)
    : 0;

  const opponents = new Map(
    (matches.data?.finished ?? []).map((match) => [match.id, match.opponent]),
  );
  const trendPoints = [...myRecentStats]
    .sort((a, b) => a.matchId - b.matchId)
    .slice(-5)
    .map((stat) => ({
      label: opponents.get(stat.matchId) ?? `#${stat.matchId}`,
      value: stat.rating,
    }));

  return (
    <>
      <PageHeader
        title="Mi centro de juego"
        subtitle="Resumen de tu estado en el equipo"
        actions={
          <Link to="/jugador/uniformes" className="btn btn-outline btn-sm">
            <Icon name="camiseta" size={16} />
            Pedir uniforme
          </Link>
        }
      />

      <MatchDayHero match={upcomingMatch} />
      <ClubMatchStrip
        match={upcomingMatch}
        matches={[
          ...(matches.data?.upcoming ?? []),
          ...(matches.data?.finished ?? []),
        ]}
        loading={matches.loading}
        error={matches.error}
        onRetry={matches.reload}
      />
      <ClubActionGrid />
      <StatCardsRow
        columns={3}
        tiles={[
          {
            label: "Inscripción",
            value: inscription ? (
              <StatusBadge status={inscription.status} size="md" />
            ) : (
              "Sin inscribir"
            ),
            icon: "dinero",
            tone: inscription?.status === "pagada" ? "success" : "warning",
            hint: !inscription ? (
              "El administrador debe generar tu inscripción."
            ) : pending > 0 ? (
              <>
                Falta <Money value={pending} />
              </>
            ) : (
              "Sin deuda pendiente"
            ),
          },
          {
            label: "Calificación promedio",
            value: formatRating(myStats.avgRating),
            icon: "chart",
            tone: "primary",
            hint: forecast
              ? `Pronóstico: ${formatRating(forecast.nextRating, 2)} (${forecast.trend})`
              : `${myStats.appearances} partidos jugados`,
          },
          {
            label: "Sanciones activas",
            value: activeSanctions.length,
            icon: "tarjeta",
            tone: activeSanctions.length > 0 ? "error" : "success",
            hint:
              activeSanctions.length > 0
                ? "Revisá el detalle"
                : "Todo en regla",
          },
        ]}
      />

      <div className="grid gap-4 mt-4 lg:grid-cols-2">
        <Card>
          <CardBody className="gap-2">
            <CardTitle className="text-base">Últimos 5 partidos</CardTitle>
            <RatingTrendChart points={trendPoints} />
          </CardBody>
        </Card>

        <Card>
          <CardBody className="gap-2">
            <CardTitle className="text-base">Uniformes</CardTitle>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="inline-flex items-center gap-2">
                <Icon name="camiseta" size={16} className="text-primary" />
                {uniforms.issued.length} en uso
              </span>
              <span className="inline-flex items-center gap-2">
                <Icon name="clipboard" size={16} className="text-primary" />
                {uniforms.pendingRequests} solicitudes pendientes
              </span>
            </div>
          </CardBody>
        </Card>
      </div>
      <ClubHomeExtras />
    </>
  );
}
