import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSquad } from "../hooks/useSquad";
import { PlayerPerformanceCard } from "../molecules/PlayerPerformanceCard";
import { SectionNavigation } from "../molecules/SectionNavigation";
import { PlayerPerformanceDetail } from "./PlayerPerformanceDetail";
import { Alert } from "../atoms/Alert";
import { EmptyState } from "../atoms/EmptyState";
import { Spinner } from "../atoms/Spinner";

export function SquadCollection() {
  const state = useSquad();
  const { user } = useAuth();
  const base = user?.role === "admin" ? "/admin" : "/jugador";
  return (
    <>
      <div className="sport-filter-bar">
        <label>
          Torneo
          <select
            className="select select-bordered"
            value={state.tournament}
            onChange={(e) => state.setTournament(e.target.value)}
          >
            <option value="">Todo el club</option>
            {state.tournaments.data?.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Buscar jugador
          <input
            className="input input-bordered"
            type="search"
            value={state.search}
            onChange={(e) => state.setSearch(e.target.value)}
            placeholder="Nombre o dorsal"
          />
        </label>
        <label>
          Ordenar
          <select
            className="select select-bordered"
            value={state.sort}
            onChange={(e) => state.setSort(e.target.value)}
          >
            <option value="number">Dorsal</option>
            <option value="rating">Media registrada</option>
            <option value="goals">Goles</option>
          </select>
        </label>
      </div>
      {!state.squad.loading &&
      state.squad.data?.length &&
      state.squad.data.every((member) => !member.stats.appearances) ? (
        <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 text-sm">
          <strong>La plantilla está lista para escribir su historia.</strong>
          <p className="mt-1 text-base-content/65">
            Todavía no hay actuaciones evaluadas en este filtro. Las cartas se
            alimentan con las estadísticas de los partidos jugados.
          </p>
          {user?.role === "admin" && (
            <Link className="link inline-block mt-2" to="/admin/partidos">
              Registrar rendimiento de un partido →
            </Link>
          )}
        </div>
      ) : null}
      <SectionNavigation
        label="Filtrar plantilla por posición"
        value={state.role}
        onChange={state.setRole}
        items={[
          { key: "TODOS", label: "Toda la plantilla" },
          { key: "POR", label: "Portería" },
          { key: "DEF", label: "Defensa" },
          { key: "MED", label: "Medio campo" },
          { key: "DEL", label: "Ataque" },
        ]}
      />
      {state.tournaments.error && (
        <Alert tone="error">{state.tournaments.error}</Alert>
      )}
      {state.squad.error && (
        <Alert tone="error" onClose={state.squad.reload}>
          {state.squad.error}
        </Alert>
      )}
      {state.squad.loading ? (
        <div className="py-12 text-center">
          <Spinner />
        </div>
      ) : (
        !state.squad.error && (
          <>
            <p className="sport-collection-caption">
              {state.filtered.length} jugadores · Selecciona una carta para ver
              su aportación y últimas actuaciones.
            </p>
            {state.filtered.length ? (
              <div className="fc-squad-grid">
                {state.filtered.map((member) => (
                  <PlayerPerformanceCard
                    key={member.playerId}
                    member={member}
                    onSelect={() => state.select(member.playerId)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No hay jugadores con este filtro"
                message="Prueba otra posición o torneo. La plantilla muestra integrantes activos y aprobados."
                icon="usuarios"
              />
            )}
          </>
        )
      )}
      {state.selected && (
        <PlayerPerformanceDetail
          member={state.selected}
          base={base}
          close={() => state.select(null)}
        />
      )}
    </>
  );
}
