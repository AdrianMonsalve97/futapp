import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSquadFixture } from "../hooks/useSquadFixture";
import { pitchSlotsFrom } from "../utils/lineup-slots";
import { TacticalBoard } from "./TacticalBoard";
import { TacticalBalance } from "../molecules/TacticalBalance";
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
      <div className="fc-tactical-workspace">
        <aside className="fc-tactical-console">
          <p className="sport-eyebrow">SISTEMA {match.formation}</p>
          <h3>{match.format} inicial</h3>
          <MatchCountdown match={match} />
          <TacticalBalance slots={slots} />
          <p className="fc-console-help">
            {user?.role === "admin"
              ? "Vista del borrador del entrenador. Los jugadores consultan únicamente la alineación publicada."
              : match.lineupPublishedAt
                ? "Esta es la alineación publicada para tu equipo."
                : "El entrenador aún está preparando la alineación. Las posiciones se completarán cuando publique el equipo."}
          </p>
        </aside>
        <TacticalBoard
          slots={slots}
          format={match.format}
          onPlayerSelect={onPlayerSelect}
        />
      </div>
    </section>
  );
}
