import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { useFetch } from "../hooks/useFetch";
import { Alert } from "../atoms/Alert";
import { EmptyState } from "../atoms/EmptyState";
import { Icon } from "../atoms/Icon";
import { Spinner } from "../atoms/Spinner";
import { ClubPageIntro } from "../molecules/ClubPageIntro";
import { TournamentStandings } from "../organisms/TournamentStandings";
import type { Tournament } from "../types/tournament";

export function StandingsPage() {
  const { user } = useAuth(),
    { settings } = useSettings();
  const [params, setParams] = useSearchParams();
  const tournaments = useFetch<Tournament[]>("/api/tournaments");
  const admin = user?.role === "admin",
    base = admin ? "/admin" : "/jugador";
  const candidate =
    Number(params.get("torneo")) || settings.defaultTournamentId;
  const selected =
    tournaments.data?.find((tournament) => tournament.id === candidate) ??
    tournaments.data?.[0];
  return (
    <section className="club-standings">
      <ClubPageIntro
        icon="trofeo"
        eyebrow="LA LIGA · FECHA A FECHA"
        title="Vamos por el siguiente punto."
      >
        Resultados, jornadas y clasificación del torneo, en un mismo lugar.
      </ClubPageIntro>
      {tournaments.error && (
        <Alert tone="error" onClose={tournaments.reload}>
          {tournaments.error}
        </Alert>
      )}
      {tournaments.loading && <Spinner />}
      {tournaments.data?.length === 0 && (
        <EmptyState
          title="La competición está por comenzar"
          message={
            admin
              ? "Crea un torneo para preparar su clasificación."
              : "Aquí aparecerán las ligas que publique el administrador."
          }
          icon="trofeo"
        />
      )}
      {selected && (
        <>
          <div className="club-league-controls">
            <label htmlFor="standings-tournament">
              Torneo
              <select
                id="standings-tournament"
                className="select select-bordered"
                value={selected.id}
                onChange={(event) => setParams({ torneo: event.target.value })}
              >
                {tournaments.data?.map((tournament) => (
                  <option key={tournament.id} value={tournament.id}>
                    {tournament.name} · {tournament.season}
                  </option>
                ))}
              </select>
            </label>
            <Link
              className="btn btn-outline btn-sm"
              to={`${base}/torneos/${selected.id}`}
            >
              Ver normativa <Icon name="arrowRight" size={15} />
            </Link>
          </div>
          <TournamentStandings key={selected.id} tournament={selected} />
        </>
      )}
    </section>
  );
}
