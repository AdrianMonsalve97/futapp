import { useState } from "react";
import { useFetch } from "../../hooks/useFetch";
import { useSettings } from "../../context/SettingsContext";
import { api, errorMessage } from "../../services/api";
import { PageHeader } from "../../templates/PageHeader";
import { Alert } from "../../atoms/Alert";
import { Button } from "../../atoms/Button";
import { Card, CardBody, CardTitle } from "../../atoms/Card";
import { MatchList } from "../../organisms/MatchList";
import { MatchFormModal } from "../../organisms/MatchFormModal";
import { SectionNavigation } from "../../molecules/SectionNavigation";
import type { Match } from "../../types/api";

export function MatchesPage() {
  const { data, loading, error, reload } = useFetch<Match[]>("/api/matches");
  const { settings } = useSettings();
  const [view, setView] = useState<"upcoming" | "played" | "archive">(
    "upcoming",
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Match | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const remove = async (match: Match) => {
    setActionError(null);
    try {
      await api(`/api/matches/${match.id}`, { method: "DELETE" });
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  const matches = data ?? [];
  const upcoming = matches.filter(
    (item) => item.status === "programado" || item.status === "pospuesto",
  );
  const played = matches.filter((item) => item.status === "jugado");
  const archive = matches.filter((item) => item.status === "cancelado");

  return (
    <>
      <PageHeader
        title="Partidos"
        subtitle={`Fixture, resultados y preparación táctica · Formato global: ${settings.profile.name} (${settings.profile.matchMinutes}')`}
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            Nuevo partido
          </Button>
        }
      />

      {error && (
        <Alert tone="error" onClose={reload}>
          {error}
        </Alert>
      )}
      {actionError ? (
        <Alert
          tone="error"
          className="mb-4"
          onClose={() => setActionError(null)}
        >
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
        {view === "upcoming" && (
          <Card>
            <CardBody className="gap-3">
              <CardTitle className="text-base">La próxima batalla</CardTitle>
              <MatchList
                matches={upcoming}
                mode="admin"
                isLoading={loading}
                error={error}
                detailHref={(match) => `/admin/partidos/${match.id}`}
                onEdit={(match) => {
                  setEditing(match);
                  setModalOpen(true);
                }}
                onDelete={(match) => void remove(match)}
                emptyTitle="Sin partidos programados"
                emptyMessage="Creá el primer partido con el botón “Nuevo partido”."
              />
            </CardBody>
          </Card>
        )}

        {view === "played" && (
          <Card>
            <CardBody className="gap-3">
              <CardTitle className="text-base">Jugados</CardTitle>
              <MatchList
                matches={played}
                mode="admin"
                detailHref={(match) => `/admin/partidos/${match.id}`}
                onEdit={(match) => {
                  setEditing(match);
                  setModalOpen(true);
                }}
                onDelete={(match) => void remove(match)}
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
                onEdit={(match) => {
                  setEditing(match);
                  setModalOpen(true);
                }}
                onDelete={(match) => void remove(match)}
                emptyTitle="Sin partidos cancelados"
              />
            </CardBody>
          </Card>
        )}
      </div>

      <MatchFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        match={editing}
        teamFormat={settings.profile.format}
        onSaved={reload}
      />
    </>
  );
}
