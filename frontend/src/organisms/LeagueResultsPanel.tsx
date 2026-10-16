import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { Button } from "../atoms/Button";
import { EmptyState } from "../atoms/EmptyState";
import { Icon } from "../atoms/Icon";
import type { LeagueConfig, LeagueResult, LeagueView } from "../types/league";
interface LeagueResultsPanelProps {
  league: LeagueView;
  draft: LeagueConfig | null;
  busy: boolean;
  onDraftChange: (draft: LeagueConfig) => void;
  onEdit: (result: LeagueResult) => void;
  onDelete: (result: LeagueResult) => void;
}
export function LeagueResultsPanel({
  league,
  draft,
  busy,
  onDraftChange,
  onEdit,
  onDelete,
}: LeagueResultsPanelProps) {
  const { user } = useAuth(),
    { settings } = useSettings();
  const admin = user?.role === "admin",
    base = admin ? "/admin" : "/jugador";
  const [round, setRound] = useState("all");
  const results = league.results,
    rounds = [...new Set(results.map((result) => result.matchday))].sort(
      (a, b) => a - b,
    );
  return (
    <>
      <div className="club-league-controls mt-8">
        <label htmlFor="standings-round">
          Resultados por jornada
          <select
            id="standings-round"
            className="select select-bordered"
            value={round}
            onChange={(e) => setRound(e.target.value)}
          >
            <option value="all">Todas las jornadas</option>
            {rounds.map((value) => (
              <option key={value} value={value}>
                {value ? `Jornada ${value}` : "Jornada por asignar"}
              </option>
            ))}
          </select>
        </label>
        {admin && (
          <Link to="/admin/partidos" className="club-text-link">
            Registrar resultado del club <Icon name="arrowRight" size={15} />
          </Link>
        )}
      </div>
      {!results.length && (
        <EmptyState
          title="Todo por jugar"
          message="Cuando se registre un marcador, la clasificación sumará los puntos y goles correspondientes."
          icon="futbol"
        />
      )}
      <div className="club-result-list">
        {results
          .filter((row) => round === "all" || String(row.matchday) === round)
          .map((row) => (
            <article
              key={`${row.source}-${row.id}`}
              className="club-result-card"
            >
              <small>
                {row.matchday
                  ? `JORNADA ${row.matchday}`
                  : "JORNADA POR ASIGNAR"}{" "}
                · {row.status.toUpperCase()}
              </small>
              <div className="club-result-teams">
                <span>{row.home}</span>
                <strong>
                  {row.homeGoals ?? "–"} : {row.awayGoals ?? "–"}
                </strong>
                <span>{row.away}</span>
              </div>
              <div>
                {row.source === "club" ? (
                  <Link
                    className="club-text-link"
                    to={`${base}/partidos/${row.matchId}`}
                  >
                    Partido del club <Icon name="arrowRight" size={13} />
                  </Link>
                ) : (
                  <span className="club-muted">Encuentro de la liga</span>
                )}
                {admin &&
                  draft &&
                  (row.source === "club" ? (
                    <label className="text-xs">
                      Jornada
                      <input
                        aria-label={`Jornada del partido contra ${row.home === settings.teamName ? row.away : row.home}`}
                        type="number"
                        min={1}
                        max={1000}
                        className="input input-bordered input-sm w-20 ml-2"
                        value={draft.matchRounds[String(row.matchId)] ?? ""}
                        disabled={busy}
                        onChange={(e) => {
                          const next = { ...draft.matchRounds };
                          if (e.target.value)
                            next[String(row.matchId)] = Number(e.target.value);
                          else delete next[String(row.matchId)];
                          onDraftChange({ ...draft, matchRounds: next });
                        }}
                      />
                    </label>
                  ) : (
                    <span className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => onEdit(row)}
                      >
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={busy}
                        onClick={() => onDelete(row)}
                      >
                        Eliminar
                      </Button>
                    </span>
                  ))}
              </div>
            </article>
          ))}
      </div>
    </>
  );
}
