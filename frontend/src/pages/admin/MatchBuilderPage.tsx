import { MatchKickoffPanel } from "../../organisms/MatchKickoffPanel";
import { MatchResultDialog } from "../../organisms/MatchResultDialog";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useFetch } from "../../hooks/useFetch";
import { useTeamFormat } from "../../context/SettingsContext";
import { MatchRulesNotice } from "../../molecules/MatchRulesNotice";
import { SectionNavigation } from "../../molecules/SectionNavigation";
import { Button } from "../../atoms/Button";
import { PageHeader } from "../../templates/PageHeader";
import { Alert } from "../../atoms/Alert";
import { Card, CardBody, CardTitle } from "../../atoms/Card";
import { Spinner } from "../../atoms/Spinner";
import { LineupEditor } from "../../organisms/LineupEditor";
import { AttendancePanel } from "../../organisms/AttendancePanel";
import { RefereePaymentPanel } from "../../organisms/RefereePaymentPanel";
import { MatchBroadcast } from "../../organisms/MatchBroadcast";
import { MatchVenueMap } from "../../organisms/MatchVenueMap";
import { MatchFormModal } from "../../organisms/MatchFormModal";
import { MatchStrategyEditor } from "../../organisms/MatchStrategyEditor";
import { NotifyMatchButton } from "../../organisms/NotifyMatchButton";
import { StatsEntryForm } from "../../organisms/StatsEntryForm";
import type { MatchDetailResponse, PlayerListItem } from "../../types/api";

type Section = "partido" | "convocatoria" | "tactica" | "rendimiento";

export function MatchBuilderPage() {
  const { id } = useParams(),
    matchId = Number(id);
  const valid = Number.isSafeInteger(matchId) && matchId > 0;
  const detail = useFetch<MatchDetailResponse>(
    valid ? `/api/matches/${matchId}` : null,
  );
  const [section, setSection] = useState<Section>("tactica");
  const [editing, setEditing] = useState(false);
  const [closing, setClosing] = useState(false);
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
        title="Sala de partido"
        subtitle="Convocatoria, táctica y rendimiento del equipo"
        actions={
          <>
            {match.status !== "cancelado" && match.status !== "pospuesto" && (
              <Button size="sm" onClick={() => setClosing(true)}>
                {match.status === "jugado"
                  ? "Corregir resultado"
                  : "Finalizar partido"}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
            >
              Editar partido
            </Button>
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
      <MatchKickoffPanel match={match} />
      <SectionNavigation
        label="Gestionar partido"
        value={section}
        onChange={setSection}
        items={[
          { key: "partido", label: "Partido" },
          { key: "convocatoria", label: "Asistencia y arbitraje" },
          { key: "tactica", label: "Alineación y plan" },
          { key: "rendimiento", label: "Rendimiento" },
        ]}
      />
      {section === "partido" && (
        <>
          <MatchRulesNotice match={match} />
          <Card>
            <CardBody>
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
        <div className="space-y-5 match-tactics-page">
          <Card>
            <CardBody>
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
                  phaseFormations={match.phaseFormations}
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
      <MatchFormModal
        open={editing}
        onClose={() => setEditing(false)}
        match={match}
        teamFormat={profile.format}
        onSaved={detail.reload}
      />
      {closing && (
        <MatchResultDialog
          key={match.id}
          match={match}
          onClose={() => setClosing(false)}
          onSaved={() => {
            setClosing(false);
            detail.reload();
          }}
        />
      )}
    </>
  );
}
