import { useMatchCalendar } from "../../hooks/useMatchCalendar";
import { useState } from "react";
import type { Match } from "../../types/api";
import { MatchResultDialog } from "../../organisms/MatchResultDialog";
import { useSettings } from "../../context/SettingsContext";
import { PageHeader } from "../../templates/PageHeader";
import { Alert } from "../../atoms/Alert";
import { Button } from "../../atoms/Button";
import { Card, CardBody, CardTitle } from "../../atoms/Card";
import { MatchList } from "../../organisms/MatchList";
import { UpcomingMatches } from "../../organisms/UpcomingMatches";
import { MatchFormModal } from "../../organisms/MatchFormModal";
import { SectionNavigation } from "../../molecules/SectionNavigation";

export function MatchesPage() {
  const [resultMatch, setResultMatch] = useState<Match | null>(null);
  const { settings } = useSettings();
  const {
    loading,
    error,
    reload,
    view,
    setView,
    modalOpen,
    editing,
    actionError,
    upcoming,
    played,
    archive,
    remove,
    clearError,
    create,
    edit,
    close,
  } = useMatchCalendar();

  return (
    <>
      <PageHeader
        title="Partidos"
        subtitle={`Fixture, resultados y preparación táctica · Formato global: ${settings.profile.name} (${settings.profile.matchMinutes}')`}
        actions={<Button onClick={create}>Nuevo partido</Button>}
      />

      {error && (
        <Alert tone="error" onClose={reload}>
          {error}
        </Alert>
      )}
      {actionError ? (
        <Alert tone="error" className="mb-4" onClose={clearError}>
          {actionError}
        </Alert>
      ) : null}

      <SectionNavigation
        label="Filtrar calendario"
        value={view}
        onChange={setView}
        items={[
          { key: "upcoming", label: "Próximas fechas", count: upcoming.length },
          { key: "played", label: "Resultados", count: played.length },
          { key: "archive", label: "Cancelados", count: archive.length },
        ]}
      />
      {view === "upcoming" &&
        played.some((match) => match.status === "programado") && (
          <Alert tone="info" className="mb-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <span>
                Hay partidos con su tiempo reglamentario cumplido. Confirma sus
                marcadores para actualizar la tabla.
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setView("played")}
              >
                Revisar resultados
              </Button>
            </div>
          </Alert>
        )}
      <div className="space-y-5">
        {view === "upcoming" && !error && (
          <UpcomingMatches
            matches={upcoming}
            mode="admin"
            isLoading={loading}
            detailHref={(match) => `/admin/partidos/${match.id}`}
            onEdit={edit}
            onDelete={remove}
            emptyTitle="Sin partidos programados"
            emptyMessage="Crea el primer partido con el botón “Nuevo partido”."
          />
        )}

        {view === "played" && (
          <Card>
            <CardBody className="gap-3">
              <CardTitle className="text-base">
                Resultados y partidos por cerrar
              </CardTitle>
              <MatchList
                matches={played}
                onResult={setResultMatch}
                mode="admin"
                detailHref={(match) => `/admin/partidos/${match.id}`}
                onEdit={edit}
                onDelete={remove}
                emptyTitle="Sin partidos jugados"
                emptyMessage="Todavía no se registraron resultados."
              />
            </CardBody>
          </Card>
        )}
        {view === "archive" && (
          <Card>
            <CardBody>
              <CardTitle>Partidos cancelados</CardTitle>
              <MatchList
                matches={archive}
                mode="admin"
                detailHref={(match) => `/admin/partidos/${match.id}`}
                onEdit={edit}
                onDelete={remove}
                emptyTitle="Sin partidos cancelados"
              />
            </CardBody>
          </Card>
        )}
      </div>

      <MatchFormModal
        open={modalOpen}
        onClose={close}
        match={editing}
        teamFormat={settings.profile.format}
        onSaved={reload}
      />
      {resultMatch && (
        <MatchResultDialog
          key={resultMatch.id}
          match={resultMatch}
          onClose={() => setResultMatch(null)}
          onSaved={() => {
            setResultMatch(null);
            setView("played");
            reload();
          }}
        />
      )}
    </>
  );
}
