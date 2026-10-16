import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSquadFixture } from "../hooks/useSquadFixture";
import { pitchSlotsFrom } from "../utils/lineup-slots";
import { TacticalBoard } from "./TacticalBoard";
import { MatchCountdown } from "../molecules/MatchCountdown";
import { Alert } from "../atoms/Alert";
import { Spinner } from "../atoms/Spinner";
import { EmptyState } from "../atoms/EmptyState";

export function SquadTacticalOverview({
  tournamentId,
  onPlayerSelect,
}: {
  tournamentId: string;
  onPlayerSelect: (id: number) => void;
}) {
  const state = useSquadFixture(tournamentId),
    { user, player } = useAuth(),
    base = user?.role === "admin" ? "/admin" : "/jugador";
  if (state.matches.loading || state.detail.loading)
    return (
      <div className="text-center py-12">
        <Spinner />
      </div>
    );
  if (state.matches.error || state.detail.error)
    return (
      <Alert
        tone="error"
        onClose={() => {
          state.matches.reload();
          state.detail.reload();
        }}
      >
        {state.matches.error || state.detail.error}
      </Alert>
    );
  if (!state.next || !state.detail.data)
    return (
      <EmptyState
        title="El próximo sistema empieza con un partido"
        message="Cuando se programe el siguiente encuentro, aquí podrás ver su formación y sus jugadores."
        icon="futbol"
      />
    );
  const { match, lineup } = state.detail.data,
    slots = pitchSlotsFrom(match.formation, lineup, match.format).map(
      (slot) => ({ ...slot, highlighted: slot.playerId === player?.id }),
    );
  return (
    <section className="fc-lineup-workspace">
      <div className="fc-lineup-heading">
        <div>
          <p className="sport-eyebrow">SALA TÁCTICA · PRÓXIMO ENCUENTRO</p>
          <h2>vs. {match.opponent}</h2>
        </div>
        <Link
          className="btn btn-primary btn-sm"
          to={`${base}/partidos/${match.id}`}
        >
          {user?.role === "admin"
            ? "Editar el plan de partido"
            : "Abrir mi partido"}{" "}
          →
        </Link>
      </div>
      <TacticalBoard
        slots={slots}
        format={match.format}
        onPlayerSelect={onPlayerSelect}
      />
      <div className="fc-squad-context">
        <MatchCountdown match={match} />
        <p className="fc-console-help">
          {user?.role === "admin"
            ? "Borrador del entrenador. Revisa y publica el equipo desde la sala del partido."
            : match.lineupPublishedAt
              ? "Alineación publicada. Toca a un compañero para ver su rendimiento."
              : "El entrenador está preparando el equipo. Las posiciones se completarán cuando publique la alineación."}
        </p>
      </div>
    </section>
  );
}
