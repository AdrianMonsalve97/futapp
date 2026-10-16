import { useState } from "react";
import { SectionNavigation } from "../../molecules/SectionNavigation";
import { useFetch } from "../../hooks/useFetch";
import { PageHeader } from "../../templates/PageHeader";
import { Alert } from "../../atoms/Alert";
import { Spinner } from "../../atoms/Spinner";
import { Card, CardBody, CardTitle } from "../../atoms/Card";
import { MatchList } from "../../organisms/MatchList";
import { UpcomingMatches } from "../../organisms/UpcomingMatches";
import type { MeMatchesResponse } from "../../types/api";

/** Mis partidos (SPEC §10.4): próximos con formación/XI y jugados con resultado. */
export function MatchesPage() {
  const [view, setView] = useState<"upcoming" | "played">("upcoming");
  const { data, loading, error, reload } =
    useFetch<MeMatchesResponse>("/api/me/matches");

  return (
    <>
      <PageHeader
        title="Mis partidos"
        subtitle="Fixture del equipo y resultados"
      />

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <Alert
          tone="error"
          title="No se pudieron cargar los partidos"
          onClose={reload}
        >
          {error}
        </Alert>
      ) : (
        <div className="space-y-6">
          <SectionNavigation
            label="Filtrar mis partidos"
            value={view}
            onChange={setView}
            items={[
              {
                key: "upcoming",
                label: "Próximas fechas",
                count: data?.upcoming.length ?? 0,
              },
              {
                key: "played",
                label: "Resultados",
                count: data?.finished.length ?? 0,
              },
            ]}
          />
          {view === "upcoming" && (
            <UpcomingMatches
              matches={data?.upcoming ?? []}
              mode="player"
              detailHref={(match) => `/jugador/partidos/${match.id}`}
              emptyTitle="Sin próximos partidos"
              emptyMessage="Cuando se programe un encuentro vas a verlo aquí."
            />
          )}

          {view === "played" && (
            <Card>
              <CardBody className="gap-3">
                <CardTitle className="text-base">Partidos jugados</CardTitle>
                <MatchList
                  matches={data?.finished ?? []}
                  mode="player"
                  detailHref={(match) => `/jugador/partidos/${match.id}`}
                  emptyTitle="Sin partidos jugados"
                  emptyMessage="Todavía no se disputaron encuentros en la temporada."
                />
              </CardBody>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
