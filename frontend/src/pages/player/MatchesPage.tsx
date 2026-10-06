import { useFetch } from '../../hooks/useFetch';
import { PageHeader } from '../../templates/PageHeader';
import { Alert } from '../../atoms/Alert';
import { Spinner } from '../../atoms/Spinner';
import { Card, CardBody, CardTitle } from '../../atoms/Card';
import { MatchList } from '../../organisms/MatchList';
import type { MeMatchesResponse } from '../../types/api';

/** Mis partidos (SPEC §10.4): próximos con formación/XI y jugados con resultado. */
export function MatchesPage() {
  const { data, loading, error, reload } = useFetch<MeMatchesResponse>('/api/me/matches');

  return (
    <>
      <PageHeader title="Mis partidos" subtitle="Fixture del equipo y resultados" />

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <Alert tone="error" title="No se pudieron cargar los partidos" onClose={reload}>
          {error}
        </Alert>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardBody className="gap-3">
              <CardTitle className="text-base">Próximos partidos</CardTitle>
              <MatchList
                matches={data?.upcoming ?? []}
                mode="player"
                detailHref={(match) => `/jugador/partidos/${match.id}`}
                emptyTitle="Sin próximos partidos"
                emptyMessage="Cuando se programe un encuentro vas a verlo acá con tu formación."
              />
            </CardBody>
          </Card>

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
        </div>
      )}
    </>
  );
}
