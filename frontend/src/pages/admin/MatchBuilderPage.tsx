import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useFetch } from "../../hooks/useFetch";
import { useTeamFormat } from "../../context/SettingsContext";
import { MatchRulesNotice } from "../../molecules/MatchRulesNotice";
import { SectionNavigation } from "../../molecules/SectionNavigation";
import { MatchMeta } from "../../molecules/MatchMeta";
import { PageHeader } from "../../templates/PageHeader";
import { Alert } from "../../atoms/Alert";
import { Card, CardBody, CardTitle } from "../../atoms/Card";
import { Spinner } from "../../atoms/Spinner";
import { LineupEditor } from "../../organisms/LineupEditor";
import { AttendancePanel } from "../../organisms/AttendancePanel";
import { RefereePaymentPanel } from "../../organisms/RefereePaymentPanel";
import { MatchBroadcast } from "../../organisms/MatchBroadcast";
import { MatchVenueMap } from "../../organisms/MatchVenueMap";
import { MatchDataEditor } from "../../organisms/MatchDataEditor";
import { MatchStrategyEditor } from "../../organisms/MatchStrategyEditor";
import { NotifyMatchButton } from "../../organisms/NotifyMatchButton";
import { StatsEntryForm } from "../../organisms/StatsEntryForm";
import type { MatchDetailResponse, PlayerListItem } from "../../types/api";

type Section = "partido" | "convocatoria" | "tactica" | "rendimiento" | "datos";

export function MatchBuilderPage() {
  const { id } = useParams(),
    matchId = Number(id);
  const valid = Number.isSafeInteger(matchId) && matchId > 0;
  const detail = useFetch<MatchDetailResponse>(
    valid ? `/api/matches/${matchId}` : null,
  );
  const [section, setSection] = useState<Section>("partido");
  const players = useFetch<PlayerListItem[]>(
    section === "tactica" || section === "rendimiento" ? "/api/players" : null,
  );
  const match = detail.data?.match;
  const profile = useTeamFormat(match?.format);
  if (!valid)
    return <Alert tone="error">Identificador de partido inválido.</Alert>;
  if (detail.loading && !detail.data)
    return (
      <div className="py-20 text-center">
        <Spinner size="lg" />
      </div>
    );
  if (detail.error || !match || !detail.data)
    return (
      <Alert tone="error" onClose={detail.reload}>
        {detail.error ?? "No se encontró el partido."}
      </Alert>
    );
  return (
    <>
      <PageHeader
        title={`${match.isHome ? "vs." : "en"} ${match.opponent}`}
        subtitle={`${match.competition} · ${profile.name} · ${match.minutes} minutos`}
        actions={
          <>
            <Link className="btn btn-outline btn-sm" to="/admin/partidos">
              ← Calendario
            </Link>
            {match.tournamentId && (
              <Link
                className="btn btn-outline btn-sm"
                to={`/admin/posiciones?torneo=${match.tournamentId}`}
              >
                Clasificación →
              </Link>
            )}
          </>
        }
      />
      <MatchRulesNotice match={match} />
      <SectionNavigation
        label="Gestionar partido"
        value={section}
        onChange={setSection}
        items={[
          { key: "partido", label: "Partido" },
          { key: "convocatoria", label: "Asistencia y arbitraje" },
          { key: "tactica", label: "Alineación y plan" },
          { key: "rendimiento", label: "Rendimiento" },
          { key: "datos", label: "Editar partido" },
        ]}
      />
      {section === "partido" && (
        <>
          <Card>
            <CardBody>
              <MatchMeta match={match} />
              {match.status === "jugado" &&
                match.goalsFor !== null &&
                match.goalsAgainst !== null && (
                  <p className="text-5xl font-black tabular-nums">
                    {match.goalsFor} – {match.goalsAgainst}
                  </p>
                )}
              {match.notes && (
                <p className="text-sm text-base-content/70">{match.notes}</p>
              )}
              <p className="text-sm text-base-content/60">
                {detail.data.lineup.filter((slot) => slot.playerId).length}/
                {profile.playersOnPitch} posiciones asignadas ·{" "}
                {match.lineupPublishedAt
                  ? "Alineación publicada"
                  : "Alineación sin publicar"}
              </p>
            </CardBody>
          </Card>
          <MatchVenueMap match={match} />
          {match.status === "programado" && (
            <NotifyMatchButton matchId={match.id} />
          )}
          <MatchBroadcast
            key={`${match.id}:${match.streamUrl}`}
            match={match}
            admin
            onSaved={detail.reload}
          />
        </>
      )}
      {section === "convocatoria" && (
        <>
          {["programado", "pospuesto"].includes(match.status) && (
            <AttendancePanel
              matchId={matchId}
              tournamentId={match.tournamentId}
              onChanged={detail.reload}
            />
          )}
          <RefereePaymentPanel
            matchId={matchId}
            admin
            refreshKey={detail.data}
          />
        </>
      )}
      {section === "tactica" && (
        <div className="space-y-5">
          <Card>
            <CardBody>
              <CardTitle>
                {profile.playersOnPitch} inicial · {match.formation}
              </CardTitle>
              {players.error ? (
                <Alert tone="error" onClose={players.reload}>
                  {players.error}
                </Alert>
              ) : players.loading ? (
                <Spinner />
              ) : (
                <LineupEditor
                  matchId={matchId}
                  formation={match.formation}
                  lineup={detail.data.lineup}
                  players={players.data ?? []}
                  format={profile.format}
                  allowedFormations={match.tournamentRules?.allowedFormations}
                  publishedAt={match.lineupPublishedAt}
                  onChanged={detail.reload}
                />
              )}
            </CardBody>
          </Card>
          <MatchStrategyEditor
            matchId={matchId}
            strategies={detail.data.strategies}
            onChanged={detail.reload}
          />
        </div>
      )}
      {section === "rendimiento" && (
        <Card>
          <CardBody>
            <CardTitle>Lo que pasó en el campo</CardTitle>
            <p className="text-sm text-base-content/60">
              Registra los datos reales del encuentro. Aparecerán en las cartas
              de la plantilla cuando el partido esté marcado como jugado.
            </p>
            {players.error ? (
              <Alert tone="error" onClose={players.reload}>
                {players.error}
              </Alert>
            ) : players.loading ? (
              <Spinner />
            ) : (
              <StatsEntryForm
                matchId={matchId}
                players={players.data ?? []}
                initial={detail.data.stats}
                maxMinutes={match.minutes}
                onSaved={detail.reload}
              />
            )}
          </CardBody>
        </Card>
      )}
      {section === "datos" && (
        <MatchDataEditor match={match} onSaved={detail.reload} />
      )}
    </>
  );
}
