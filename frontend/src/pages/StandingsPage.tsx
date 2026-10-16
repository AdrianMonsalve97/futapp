import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { useFetch } from "../hooks/useFetch";
import { api, errorMessage } from "../services/api";
import { Icon } from "../atoms/Icon";
import { Alert } from "../atoms/Alert";
import { Button } from "../atoms/Button";
import { EmptyState } from "../atoms/EmptyState";
import { Modal } from "../atoms/Modal";
import { Spinner } from "../atoms/Spinner";
import { StandingsTable } from "../organisms/StandingsTable";
import type { Tournament } from "../types/tournament";
import type {
  LeagueConfig,
  LeagueResult,
  LeagueView,
} from "../../../backend/src/domain/standings";

export function StandingsPage() {
  const { user } = useAuth(),
    admin = user?.role === "admin",
    base = admin ? "/admin" : "/jugador";
  const { settings } = useSettings(),
    [params, setParams] = useSearchParams();
  const tournaments = useFetch<Tournament[]>("/api/tournaments");
  const candidate =
    Number(params.get("torneo")) || settings.defaultTournamentId;
  const selected =
    tournaments.data?.find((row) => row.id === candidate) ??
    tournaments.data?.[0];
  const league = useFetch<LeagueView>(
    selected ? `/api/tournaments/${selected.id}/standings` : null,
  );
  const [draft, setDraft] = useState<LeagueConfig | null>(null),
    [team, setTeam] = useState(""),
    [round, setRound] = useState("all");
  const [editor, setEditor] = useState<LeagueResult | null>(null),
    [deleting, setDeleting] = useState<LeagueResult | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState("");
  useEffect(() => {
    setDraft(league.data ? structuredClone(league.data.config) : null);
  }, [league.data]);
  useEffect(() => {
    setError(null);
    setNotice("");
    setRound("all");
    setEditor(null);
    setDeleting(null);
  }, [selected?.id]);
  const save = async (next: LeagueConfig) => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    setNotice("");
    try {
      await api(`/api/tournaments/${selected.id}/standings`, {
        method: "PUT",
        json: next,
      });
      league.reload();
      setNotice("Resultados guardados. La tabla ya está actualizada.");
      setEditor(null);
      setDeleting(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const results = league.data?.results ?? [],
    rounds = [...new Set(results.map((row) => row.matchday))].sort(
      (a, b) => a - b,
    );
  const dirty =
    !!draft &&
    !!league.data &&
    JSON.stringify(draft) !== JSON.stringify(league.data.config);
  useEffect(() => {
    if (!selected || dirty || busy || editor || deleting) return;
    const refresh = () => {
      if (document.visibilityState === "visible") league.reload();
    };
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [selected?.id, dirty, busy, editor, deleting, league.reload]);
  const participants = [
    ...new Set([
      ...(draft?.teams ?? []),
      ...results.flatMap((row) => [row.home, row.away]),
    ]),
  ].filter((name) => name !== settings.teamName);
  const newResult = () => {
    if (participants.length < 2) {
      const configuration = document.getElementById('league-config') as HTMLDetailsElement | null;
      if (configuration) { configuration.open = true; configuration.scrollIntoView({ block: 'center' }); configuration.querySelector('input')?.focus({ preventScroll: true }); }
      setError('Añade al menos dos equipos participantes antes de registrar sus resultados.');
      return;
    }
    setEditor({
      id: crypto.randomUUID(),
      matchday: Math.max(1, ...rounds),
      home: participants[0] ?? "",
      away: participants[1] ?? "",
      homeGoals: null,
      awayGoals: null,
      status: "jugado",
    });
  };
  const editorSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (draft && editor)
      void save({
        ...draft,
        results: [
          ...draft.results.filter((row) => row.id !== editor.id),
          editor,
        ],
      });
  };
  return (
    <section className="club-standings">
      <div className="club-route-heading">
        <Icon name="trofeo" />
        <div>
          <small>LA LIGA · FECHA A FECHA</small>
          <h1>Vamos por el siguiente punto.</h1>
          <p>
            Resultados, jornadas y clasificación del torneo, en un mismo lugar.
          </p>
        </div>
      </div>
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
        <div className="club-league-controls">
          <label htmlFor="standings-tournament">
            Torneo
            <select
              id="standings-tournament"
              className="select select-bordered"
              value={selected.id}
              onChange={(e) => setParams({ torneo: e.target.value })}
            >
              {tournaments.data?.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name} · {row.season}
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
          {admin && (
            <Button
              size="sm"
              disabled={!draft || busy || league.loading}
              onClick={newResult}
            >
              <Icon name="plus" size={15} />
              Resultado de la jornada
            </Button>
          )}
        </div>
      )}
      {league.error && (
        <Alert tone="error" onClose={league.reload}>
          {league.error}
        </Alert>
      )}
      {selected && (
        <div className="flex flex-wrap gap-3 items-center mb-5">
          <Button
            size="sm"
            variant="ghost"
            disabled={league.loading || dirty || busy}
            onClick={league.reload}
          >
            <Icon name="refresh" size={14} />
            Actualizar tabla
          </Button>
          <span className="club-muted">
            Se actualiza cada minuto mientras la estás consultando.
          </span>
          {dirty && league.data && (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => setDraft(structuredClone(league.data!.config))}
            >
              Descartar cambios sin guardar
            </Button>
          )}
        </div>
      )}
      {error && (
        <Alert tone="error" onClose={() => setError(null)}>
          {error}{" "}
          <button className="link" onClick={league.reload}>
            Recargar clasificación
          </button>
        </Alert>
      )}
      {notice && (
        <Alert tone="success" onClose={() => setNotice("")}>
          {notice}
        </Alert>
      )}
      {league.loading && (
        <div className="py-6">
          <Spinner />
        </div>
      )}
      {league.data && selected && (
        <>
          <div className="club-league-summary">
            <div>
              <span className="club-eyebrow">
                {selected.leagueName} · {selected.season}
              </span>
              <h2>{selected.name}</h2>
              <p>
                Tabla provisional según los resultados registrados. Completa
                todas las fechas para reflejar la liga.
                <br />
                Los marcadores del club se sincronizan desde Partidos.
              </p>
            </div>
            <strong>
              {league.data.rows.find((row) => row.club)?.points ?? 0}
              <small>PUNTOS DEL CLUB</small>
            </strong>
          </div>
          {league.data.missingScores > 0 && (
            <Alert tone="warning">
              Hay {league.data.missingScores} partido(s) jugado(s) sin ambos
              marcadores. No sumarán puntos hasta completarlos en Partidos.
            </Alert>
          )}
          <StandingsTable league={league.data} />
          {admin && draft && (
            <details id="league-config" className="club-league-editor">
              <summary>Configurar equipos y puntuación</summary>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void save(draft);
                }}
                className="space-y-5"
              >
                <p className="club-muted">
                  Tu club y sus rivales aparecen automáticamente. Añade el resto
                  de participantes. Los cambios se aplican al guardar.
                </p>
                <div className="flex gap-3 flex-wrap">
                  <label className="flex-1">
                    Nombre del equipo
                    <input
                      className="input input-bordered"
                      maxLength={100}
                      value={team}
                      onChange={(e) => setTeam(e.target.value)}
                    />
                  </label>
                  <Button
                    className="self-end"
                    variant="outline"
                    disabled={!team.trim() || busy}
                    onClick={() => {
                      setDraft({
                        ...draft,
                        teams: [...draft.teams, team.trim()],
                      });
                      setTeam("");
                    }}
                  >
                    Añadir equipo
                  </Button>
                </div>
                <div className="club-team-chips">
                  {draft.teams.map((name, index) => (
                    <span key={`${name}-${index}`}>
                      {name}
                      <button
                        type="button"
                        aria-label={`Quitar ${name} de la lista de participantes`}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            teams: draft.teams.filter((_, i) => i !== index),
                          })
                        }
                      >
                        <Icon name="close" size={12} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="club-league-form-grid">
                  {(["win", "draw", "loss"] as const).map((key, index) => (
                    <label key={key}>
                      Puntos por {["victoria", "empate", "derrota"][index]}
                      <input
                        className="input input-bordered"
                        required
                        type="number"
                        min={0}
                        max={20}
                        value={draft.rules[key]}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            rules: {
                              ...draft.rules,
                              [key]: Number(e.target.value),
                            },
                          })
                        }
                      />
                    </label>
                  ))}
                  <label>
                    Orden de desempate
                    <select
                      className="select select-bordered"
                      value={draft.rules.tiebreak}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          rules: {
                            ...draft.rules,
                            tiebreak: e.target.value as "difference" | "goals",
                          },
                        })
                      }
                    >
                      <option value="difference">
                        Diferencia de gol → Goles a favor
                      </option>
                      <option value="goals">
                        Goles a favor → Diferencia de gol
                      </option>
                    </select>
                  </label>
                </div>
                <Button
                  type="submit"
                  loading={busy}
                  disabled={!dirty || league.loading}
                >
                  Guardar configuración
                </Button>
              </form>
            </details>
          )}
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
                Registrar resultado del club{" "}
                <Icon name="arrowRight" size={15} />
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
              .filter(
                (row) => round === "all" || String(row.matchday) === round,
              )
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
                                next[String(row.matchId)] = Number(
                                  e.target.value,
                                );
                              else delete next[String(row.matchId)];
                              setDraft({ ...draft, matchRounds: next });
                            }}
                          />
                        </label>
                      ) : (
                        <span className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() =>
                              setEditor({
                                id: row.id,
                                matchday: row.matchday,
                                home: row.home,
                                away: row.away,
                                homeGoals: row.homeGoals,
                                awayGoals: row.awayGoals,
                                status: row.status,
                              })
                            }
                          >
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={busy}
                            onClick={() => setDeleting(row)}
                          >
                            Eliminar
                          </Button>
                        </span>
                      ))}
                  </div>
                </article>
              ))}
          </div>
          {admin && dirty && draft && (
            <Button
              loading={busy}
              disabled={league.loading}
              onClick={() => void save(draft)}
            >
              Guardar cambios de la clasificación
            </Button>
          )}
        </>
      )}
      {editor && (
        <Modal
          open
          title="Resultado de la jornada"
          onClose={() => !busy && setEditor(null)}
          size="md"
          closeOnOutside={!busy}
        >
          <form onSubmit={editorSubmit} className="space-y-5">
            <p className="club-muted">
              Solo encuentros entre otros equipos. El resultado de tu club se
              registra en Partidos y se incorpora automáticamente.
            </p>
            {error && <Alert tone="error">{error}</Alert>}
            <div className="club-league-form-grid">
              <label>
                Jornada
                <input
                  required
                  className="input input-bordered w-full mt-2"
                  type="number"
                  min={1}
                  max={1000}
                  value={editor.matchday}
                  onChange={(e) =>
                    setEditor({ ...editor, matchday: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                Estado
                <select
                  className="select select-bordered w-full mt-2"
                  value={editor.status}
                  onChange={(e) =>
                    setEditor({
                      ...editor,
                      status: e.target.value as LeagueResult["status"],
                    })
                  }
                >
                  {["jugado", "programado", "pospuesto", "cancelado"].map(
                    (value) => (
                      <option key={value}>{value}</option>
                    ),
                  )}
                </select>
              </label>
              {(["home", "away"] as const).map((key, i) => (
                <label key={key}>
                  {i ? "Visitante" : "Local"}
                  <select
                    required
                    className="select select-bordered w-full mt-2"
                    value={editor[key]}
                    onChange={(e) =>
                      setEditor({ ...editor, [key]: e.target.value })
                    }
                  >
                    <option value="">Selecciona equipo</option>
                    {participants.map((name) => (
                      <option key={name}>{name}</option>
                    ))}
                  </select>
                </label>
              ))}
              {(["homeGoals", "awayGoals"] as const).map((key, i) => (
                <label key={key}>
                  Goles {i ? "visitante" : "local"}
                  <input
                    required={editor.status === "jugado"}
                    type="number"
                    min={0}
                    max={99}
                    className="input input-bordered w-full mt-2"
                    value={editor[key] ?? ""}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        [key]:
                          e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3">
              <Button
                disabled={busy}
                variant="ghost"
                onClick={() => setEditor(null)}
              >
                Cancelar
              </Button>
              <Button type="submit" loading={busy}>
                Guardar resultado
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {deleting && draft && (
        <Modal
          open
          title="Eliminar resultado"
          onClose={() => !busy && setDeleting(null)}
          size="sm"
          closeOnOutside={!busy}
        >
          <p className="text-sm leading-7">
            Se eliminará {deleting.home} vs {deleting.away} de la jornada{" "}
            {deleting.matchday}. La clasificación se recalculará.
          </p>
          {error && <Alert tone="error">{error}</Alert>}
          <div className="flex justify-end gap-3 mt-6">
            <Button
              disabled={busy}
              variant="ghost"
              onClick={() => setDeleting(null)}
            >
              Conservar
            </Button>
            <Button
              loading={busy}
              variant="danger"
              onClick={() =>
                void save({
                  ...draft,
                  results: draft.results.filter(
                    (row) => row.id !== deleting.id,
                  ),
                })
              }
            >
              Eliminar resultado
            </Button>
          </div>
        </Modal>
      )}
    </section>
  );
}
