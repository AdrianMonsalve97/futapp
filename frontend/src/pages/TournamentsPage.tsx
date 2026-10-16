import { Link } from "react-router-dom";
import { useTournamentWorkspace } from "../hooks/useTournamentWorkspace";
import { PageHeader } from "../templates/PageHeader";
import { Alert } from "../atoms/Alert";
import { Button } from "../atoms/Button";
import { EmptyState } from "../atoms/EmptyState";
import { Spinner } from "../atoms/Spinner";
import { TournamentBanner } from "../molecules/TournamentBanner";
import { SectionNavigation } from "../molecules/SectionNavigation";
import { TournamentPhoto } from "../organisms/TournamentPhoto";
import { TournamentRoster } from "../organisms/TournamentRoster";
import { TournamentEditor } from "../organisms/TournamentEditor";
import { TournamentCatalog } from "../organisms/TournamentCatalog";
import { TournamentRulesPanel } from "../organisms/TournamentRulesPanel";
import { TournamentDocumentsPanel } from "../organisms/TournamentDocumentsPanel";

export function TournamentsPage() {
  const {
    id,
    admin,
    base,
    list,
    detail,
    row,
    editor,
    setEditor,
    section,
    setSection,
    uploadBusy,
    error,
    settings,
    upload,
    makeDefault,
    saveEditor,
  } = useTournamentWorkspace();
  return (
    <>
      <PageHeader
        title={row?.name ?? "Torneos y normativa"}
        subtitle="La liga, sus reglas y la preparación del equipo en un mismo lugar"
        actions={
          admin ? (
            <Button
              onClick={() => setEditor({ current: id && row ? row : null })}
            >
              {id && row ? "Editar torneo" : "Nuevo torneo"}
            </Button>
          ) : undefined
        }
      />
      {error ? (
        <Alert tone="error" className="mb-4">
          {error}
        </Alert>
      ) : null}
      {id ? (
        <>
          <Link to={base} className="link text-sm inline-block mb-4">
            ← Todos los torneos
          </Link>
          {detail.loading && !row ? <Spinner /> : null}
          {detail.error ? <Alert tone="error">{detail.error}</Alert> : null}
          {row ? (
            <div className="space-y-4">
              <TournamentBanner row={row} />
              <div className="club-tournament-actions">
                <Link
                  className="btn btn-primary"
                  to={`/${admin ? "admin" : "jugador"}/posiciones?torneo=${row.id}`}
                >
                  Tabla de posiciones y resultados →
                </Link>
                <Link
                  className="btn btn-outline"
                  to={`/${admin ? "admin" : "jugador"}/partidos`}
                >
                  Calendario del equipo →
                </Link>
              </div>
              <SectionNavigation
                label="Explorar torneo"
                value={section}
                onChange={setSection}
                items={[
                  { key: "rules", label: "Normativa y documentos" },
                  { key: "roster", label: "Jugadores inscritos" },
                  { key: "photo", label: "Afiche del torneo" },
                ]}
              />
              <Link
                className="btn btn-outline btn-sm"
                to={`/${admin ? "admin" : "jugador"}/plantilla?torneo=${row.id}`}
              >
                Cartas y rendimiento de esta plantilla →
              </Link>
              {section === "roster" && (
                <TournamentRoster key={row.id} tournament={row} admin={admin} />
              )}
              {section === "photo" && (
                <TournamentPhoto
                  tournament={row}
                  admin={admin}
                  onSaved={() => {
                    detail.reload();
                    list.reload();
                  }}
                />
              )}
              {section === "rules" && (
                <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-4 items-start">
                  <TournamentRulesPanel
                    row={row}
                    admin={admin}
                    isDefault={settings.defaultTournamentId === row.id}
                    onMakeDefault={makeDefault}
                  />
                  <TournamentDocumentsPanel
                    row={row}
                    admin={admin}
                    uploadBusy={uploadBusy}
                    onUpload={upload}
                  />
                </div>
              )}
            </div>
          ) : null}
        </>
      ) : (
        <>
          {list.loading ? <Spinner /> : null}
          {list.error ? <Alert tone="error">{list.error}</Alert> : null}
          {!list.loading && !list.error && !list.data?.length ? (
            <EmptyState
              icon="clipboard"
              title="La próxima liga empieza aquí"
              message={
                admin
                  ? "Crea el torneo, confirma sus reglas y carga el reglamento para compartirlo con el equipo."
                  : "Los torneos publicados por la administración aparecerán aquí."
              }
            />
          ) : null}
          <TournamentCatalog
            items={list.data ?? []}
            base={base}
            defaultTournamentId={settings.defaultTournamentId}
          />
        </>
      )}
      {editor ? (
        <TournamentEditor
          current={editor.current}
          close={() => setEditor(null)}
          saved={saveEditor}
        />
      ) : null}
    </>
  );
}
