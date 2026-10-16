import { pitchSlotsFrom } from "../../utils/lineup-slots";
import { MatchKickoffPanel } from "../../organisms/MatchKickoffPanel";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useFetch } from "../../hooks/useFetch";
import { useAuth } from "../../context/AuthContext";
import { useTeamFormat } from "../../context/SettingsContext";
import { MatchRulesNotice } from "../../molecules/MatchRulesNotice";
import { PageHeader } from "../../templates/PageHeader";
import { Alert } from "../../atoms/Alert";
import { Badge } from "../../atoms/Badge";
import { Card, CardBody, CardTitle } from "../../atoms/Card";
import { Icon } from "../../atoms/Icon";
import { Spinner } from "../../atoms/Spinner";

import { MatchLineupBoard } from "../../organisms/MatchLineupBoard";
import { StrategyList } from "../../organisms/StrategyList";
import { AttendancePanel } from "../../organisms/AttendancePanel";
import { RefereePaymentPanel } from "../../organisms/RefereePaymentPanel";
import { MatchBroadcast } from "../../organisms/MatchBroadcast";
import { SectionNavigation } from "../../molecules/SectionNavigation";
import { MyMatchPerformance } from "../../organisms/MyMatchPerformance";
import { MatchVenueMap } from "../../organisms/MatchVenueMap";
import { MatchMeta } from "../../molecules/MatchMeta";
import { StatusBadge } from "../../molecules/StatusBadge";
import { formatBadge } from "../../data/formations";
import type { MatchDetailResponse } from "../../types/api";

/** Detalle de partido (jugador): cabecera, XI en el pitch, estrategias y mis stats. */
export function MatchDetailPage() {
  const { id } = useParams();
  const [section, setSection] = useState<"partido" | "plan" | "rendimiento">(
    "partido",
  );
  const matchId = Number(id);
  const { player } = useAuth();
  const valid = Number.isFinite(matchId) && matchId > 0;
  const { data, loading, error, reload } = useFetch<MatchDetailResponse>(
    valid ? `/api/matches/${matchId}` : null,
  );
  /** §12.7.2 — aspecto del pitch y contador según el formato del partido. */
  const profile = useTeamFormat(data?.match.format);

  if (!valid) {
    return (
      <>
        <PageHeader title="Detalle del partido" />
        <Alert tone="error">Identificador de partido inválido.</Alert>
      </>
    );
  }
  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <>
        <PageHeader title="Detalle del partido" />
        <Alert
          tone="error"
          title="No se pudo cargar el partido"
          onClose={reload}
        >
          {error ?? "Sin datos disponibles."}
        </Alert>
      </>
    );
  }

  const { match, strategies, lineup, stats } = data;
  const myStat = player
    ? stats.find((entry) => entry.playerId === player.id)
    : undefined;
  const slots = pitchSlotsFrom(match.formation, lineup, profile.format).map(
    (slot) =>
      player && slot.playerId === player.id
        ? { ...slot, highlighted: true }
        : slot,
  );
  const filled = lineup.filter((slot) => slot.playerId).length;
  const matchMinutes = match.minutes ?? profile.matchMinutes;

  return (
    <>
      <PageHeader
        title={`${match.isHome ? "vs." : "en"} ${match.opponent}`}
        subtitle={match.competition}
        actions={
          <Link to="/jugador/partidos" className="btn btn-outline btn-sm">
            <Icon name="arrowLeft" size={14} />
            Volver
          </Link>
        }
      />

      <MatchKickoffPanel match={match} />
      <MatchRulesNotice match={match} />
      <SectionNavigation
        label="Explorar partido"
        value={section}
        onChange={setSection}
        items={[
          { key: "partido", label: "Voy al partido" },
          { key: "plan", label: "Alineación y plan" },
          { key: "rendimiento", label: "Mi actuación" },
        ]}
      />

      <Card className="mb-4">
        {!match.lineupPublishedAt && match.status !== "jugado" && (
          <p className="px-6 pt-5 text-sm text-base-content/60">
            El equipo técnico está preparando la alineación. Aparecerá aquí
            cuando se publique.
          </p>
        )}
        <CardBody className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <MatchMeta match={match} />
            <div className="flex items-center gap-2">
              <StatusBadge status={match.status} size="md" />
              {match.status === "jugado" &&
              match.goalsFor !== null &&
              match.goalsAgainst !== null ? (
                <span className="text-2xl font-bold tabular-nums">
                  {match.goalsFor} – {match.goalsAgainst}
                </span>
              ) : null}
            </div>
          </div>
          {match.notes ? (
            <p className="text-sm text-base-content/60">{match.notes}</p>
          ) : null}
        </CardBody>
      </Card>

      {section === "partido" &&
        ["programado", "pospuesto"].includes(match.status) && (
          <AttendancePanel
            matchId={matchId}
            tournamentId={match.tournamentId}
            onChanged={reload}
          />
        )}
      {section === "partido" && (
        <>
          <MatchVenueMap match={match} />
          <RefereePaymentPanel
            matchId={matchId}
            onChanged={reload}
            refreshKey={data}
          />
          <MatchBroadcast
            key={`${match.id}:${match.streamUrl}`}
            match={match}
          />
        </>
      )}
      {section === "rendimiento" && <MyMatchPerformance myStat={myStat} />}
      {section === "plan" && (
        <div className="match-plan-layout">
          <Card>
            <CardBody className="gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-base">Alineación</CardTitle>
                <div className="flex max-w-full flex-wrap items-center gap-2">
                  <Badge tone="info" size="sm">
                    {formatBadge(profile.format, matchMinutes)}
                  </Badge>
                  <Badge tone="neutral" size="sm">
                    {match.formation} · {filled}/{profile.playersOnPitch}
                  </Badge>
                </div>
              </div>
              <div className="match-tactical-board">
                <MatchLineupBoard
                  slots={slots}
                  format={profile.format}
                  tournamentId={match.tournamentId}
                />
              </div>
              {player ? (
                <p className="text-sm text-base-content/60 text-center">
                  {slots.some((slot) => slot.playerId === player.id)
                    ? "Tu posición está resaltada en amarillo."
                    : `No figuras en el ${profile.playersOnPitch} inicial de este partido.`}
                </p>
              ) : null}
            </CardBody>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardBody className="gap-2">
                <CardTitle className="text-base">
                  Estrategias del partido
                </CardTitle>
                <StrategyList strategies={strategies} />
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
