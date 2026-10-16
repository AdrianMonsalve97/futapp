import { useMatchCalendar } from "../../hooks/useMatchCalendar";
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
              <CardTitle className="text-base">Jugados</CardTitle>
              <MatchList
                matches={played}
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
    </>
  );
}
