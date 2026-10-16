import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { useTournamentLeague } from "../hooks/useTournamentLeague";
import { Alert } from "../atoms/Alert";
import { Button } from "../atoms/Button";
import { Icon } from "../atoms/Icon";
import { Spinner } from "../atoms/Spinner";
import { LeagueSummary } from "../molecules/LeagueSummary";
import { StandingsTable } from "./StandingsTable";
import { LeagueConfigEditor } from "./LeagueConfigEditor";
import { LeagueResultDialog } from "./LeagueResultDialog";
import { LeagueResultsPanel } from "./LeagueResultsPanel";
import { LeagueRemovalDialog } from "./LeagueRemovalDialog";
import type { Tournament } from "../types/tournament";

export function TournamentStandings({
  tournament,
}: {
  tournament: Tournament;
}) {
  const { user } = useAuth(),
    { settings } = useSettings();
  const admin = user?.role === "admin";
  const state = useTournamentLeague(tournament.id, settings.teamName);
  const { league, draft, busy, dirty, error, notice, editor, deleting } = state;
  const closeEditor = () => {
    if (!busy) state.setEditor(null);
  };
  const closeRemoval = () => {
    if (!busy) state.setDeleting(null);
  };
  return (
    <>
      <div className="flex flex-wrap gap-3 items-center mb-5">
        <Button
          size="sm"
          variant="ghost"
          disabled={league.loading || dirty || busy}
          onClick={league.reload}
        >
          <Icon name="refresh" size={14} />
          Actualizar tabla
        </Button>
        <span className="club-muted">
          Se actualiza cada minuto mientras la estás consultando.
        </span>
        {admin && (
          <Button
            size="sm"
            disabled={!draft || busy || league.loading}
            onClick={state.createResult}
          >
            <Icon name="plus" size={15} />
            Resultado de la jornada
          </Button>
        )}
        {dirty && (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={state.discardChanges}
          >
            Descartar cambios sin guardar
          </Button>
        )}
      </div>
      {league.error && (
        <Alert tone="error" onClose={league.reload}>
          {league.error}
        </Alert>
      )}
      {error && (
        <Alert tone="error" onClose={() => state.setError(null)}>
          {error}{" "}
          <button className="link" onClick={state.reload}>
            Recargar clasificación
          </button>
        </Alert>
      )}
      {notice && (
        <Alert tone="success" onClose={() => state.setNotice("")}>
          {notice}
        </Alert>
      )}
      {league.loading && (
        <div className="py-6">
          <Spinner />
        </div>
      )}
      {league.data && (
        <>
          <LeagueSummary tournament={tournament} league={league.data} />
          {league.data.missingScores > 0 && (
            <Alert tone="warning">
              Hay {league.data.missingScores} partido(s) jugado(s) sin ambos
              marcadores. No sumarán puntos hasta completarlos en Partidos.
            </Alert>
          )}
          <StandingsTable league={league.data} />
          {admin && draft && (
            <LeagueConfigEditor
              draft={draft}
              busy={busy}
              loading={league.loading}
              canSave={dirty}
              setupRequest={state.teamSetupRequest}
              onChange={state.setDraft}
              onSave={state.save}
            />
          )}
          <LeagueResultsPanel
            league={league.data}
            draft={draft}
            busy={busy}
            onDraftChange={state.setDraft}
            onEdit={state.editResult}
            onDelete={state.setDeleting}
          />
          {admin && dirty && draft && (
            <Button
              loading={busy}
              disabled={league.loading}
              onClick={() => void state.save(draft)}
            >
              Guardar cambios de la clasificación
            </Button>
          )}
        </>
      )}
      {editor && (
        <LeagueResultDialog
          editor={editor}
          participants={state.participants}
          busy={busy}
          error={error}
          onChange={state.setEditor}
          onClose={closeEditor}
          onSubmit={state.saveResult}
        />
      )}
      {deleting && (
        <LeagueRemovalDialog
          result={deleting}
          busy={busy}
          error={error}
          onClose={closeRemoval}
          onConfirm={state.deleteResult}
        />
      )}
    </>
  );
}
