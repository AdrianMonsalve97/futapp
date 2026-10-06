import { useEffect, useState } from 'react';
import { api, errorMessage } from '../services/api';
import { Alert } from '../atoms/Alert';
import { Button } from '../atoms/Button';
import { PositionBadge } from '../molecules/PositionBadge';
import { RatingBadge } from '../molecules/RatingBadge';
import type { MatchStat, PlayerListItem, StatsEntriesResponse } from '../types/api';

type NumericKey =
  | 'minutes'
  | 'goals'
  | 'assists'
  | 'shots'
  | 'shotsOnTarget'
  | 'passes'
  | 'passesCompleted'
  | 'tackles'
  | 'interceptions'
  | 'recoveries'
  | 'dribbles'
  | 'fouls'
  | 'yellowCards'
  | 'redCards'
  | 'rating';

interface StatRow {
  playerId: number;
  playerName: string;
  shirtNumber: number | null;
  position: PlayerListItem['player']['position'];
  minutes: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  passes: number;
  passesCompleted: number;
  tackles: number;
  interceptions: number;
  recoveries: number;
  dribbles: number;
  fouls: number;
  yellowCards: number;
  redCards: number;
  rating: number;
}

const FIELDS: { key: NumericKey; label: string; title: string; step?: number; max?: number }[] = [
  { key: 'minutes', label: 'Min', title: 'Minutos', max: 120 },
  { key: 'goals', label: 'G', title: 'Goles' },
  { key: 'assists', label: 'A', title: 'Asistencias' },
  { key: 'shots', label: 'Tir', title: 'Tiros' },
  { key: 'shotsOnTarget', label: 'TAP', title: 'Tiros a puerta' },
  { key: 'passes', label: 'Pas', title: 'Pases' },
  { key: 'passesCompleted', label: 'PC', title: 'Pases completados' },
  { key: 'tackles', label: 'Tck', title: 'Entradas' },
  { key: 'interceptions', label: 'Int', title: 'Intercepciones' },
  { key: 'recoveries', label: 'Rec', title: 'Recuperaciones' },
  { key: 'dribbles', label: 'Reg', title: 'Regates' },
  { key: 'fouls', label: 'Fal', title: 'Faltas' },
  { key: 'yellowCards', label: 'TA', title: 'Tarjetas amarillas', max: 2 },
  { key: 'redCards', label: 'TR', title: 'Tarjetas rojas', max: 1 },
  { key: 'rating', label: 'Calif', title: 'Calificación (1–10)', step: 0.1, max: 10 },
];

function emptyRow(item: PlayerListItem): StatRow {
  return {
    playerId: item.player.id,
    playerName: item.user.fullName,
    shirtNumber: item.player.shirtNumber,
    position: item.player.position,
    minutes: 0,
    goals: 0,
    assists: 0,
    shots: 0,
    shotsOnTarget: 0,
    passes: 0,
    passesCompleted: 0,
    tackles: 0,
    interceptions: 0,
    recoveries: 0,
    dribbles: 0,
    fouls: 0,
    yellowCards: 0,
    redCards: 0,
    rating: 6,
  };
}

function buildRows(players: PlayerListItem[], initial: MatchStat[] | null | undefined): StatRow[] {
  return players.map((item) => {
    const row = emptyRow(item);
    const stat = initial?.find((entry) => entry.playerId === row.playerId);
    if (!stat) return row;
    return {
      ...row,
      minutes: stat.minutes,
      goals: stat.goals,
      assists: stat.assists,
      shots: stat.shots,
      shotsOnTarget: stat.shotsOnTarget,
      passes: stat.passes,
      passesCompleted: stat.passesCompleted,
      tackles: stat.tackles,
      interceptions: stat.interceptions,
      recoveries: stat.recoveries,
      dribbles: stat.dribbles,
      fouls: stat.fouls,
      yellowCards: stat.yellowCards,
      redCards: stat.redCards,
      rating: stat.rating,
    };
  });
}

export interface StatsEntryFormProps {
  matchId: number;
  players: PlayerListItem[];
  /** Estadísticas existentes del partido (para pre-cargar). */
  initial?: MatchStat[] | null;
  /** §12.7.7 — duración del partido: los minutos no pueden superarlo. */
  maxMinutes?: number;
  onSaved?: (entries: MatchStat[]) => void;
}

/** Formulario editable de estadísticas por jugador → `POST /api/matches/:id/stats`. */
export function StatsEntryForm({ matchId, players, initial, maxMinutes = 90, onSaved }: StatsEntryFormProps) {
  const [rows, setRows] = useState<StatRow[]>(() => buildRows(players, initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setRows(buildRows(players, initial));
    setSaved(false);
  }, [players, initial]);

  const setField = (playerId: number, key: NumericKey, value: number) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.playerId !== playerId) return row;
        const next: StatRow = { ...row };
        next[key] = value;
        return next;
      }),
    );
    setSaved(false);
  };

  const save = async () => {
    const overLimit = rows.find((row) => row.minutes > maxMinutes);
    if (overLimit) {
      setError(
        `${overLimit.playerName}: los minutos no pueden superar los ${maxMinutes}' del partido.`,
      );
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const entries = rows.map((row) => {
        const base: MatchStat = {
          matchId,
          playerId: row.playerId,
          minutes: row.minutes,
          goals: row.goals,
          assists: row.assists,
          shots: row.shots,
          shotsOnTarget: row.shotsOnTarget,
          passes: row.passes,
          passesCompleted: row.passesCompleted,
          tackles: row.tackles,
          interceptions: row.interceptions,
          recoveries: row.recoveries,
          dribbles: row.dribbles,
          fouls: row.fouls,
          yellowCards: row.yellowCards,
          redCards: row.redCards,
          rating: row.rating,
        };
        return base;
      });
      const res = await api<StatsEntriesResponse>(`/api/matches/${matchId}/stats`, {
        method: 'POST',
        json: { entries },
      });
      setSaved(true);
      onSaved?.(res.entries);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (players.length === 0) {
    return <Alert tone="info">No hay jugadores en el plantel para cargar estadísticas.</Alert>;
  }

  return (
    <div className="space-y-3">
      {error ? <Alert tone="error" onClose={() => setError(null)}>{error}</Alert> : null}
      {saved ? <Alert tone="success">Estadísticas guardadas. El modelo de IA usa estos datos para entrenar.</Alert> : null}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-base-content/60">
          Editá los valores por jugador y guardá. Se actualiza todo el plantel en una sola operación.{' '}
          <span className="font-semibold text-base-content/80">Minutos: máx. {maxMinutes}'</span>
        </p>
        <Button onClick={() => void save()} loading={busy}>
          Guardar estadísticas
        </Button>
      </div>

      <div className="overflow-x-auto scroll-slim rounded-xl border border-base-200">
        <table className="table table-xs min-w-[1080px]">
          <thead className="bg-base-200 text-base-content/70">
            <tr>
              <th className="sticky left-0 bg-base-200 z-10 text-left">Jugador</th>
              {FIELDS.map((field) => (
                <th
                  key={field.key}
                  className="text-center"
                  title={field.key === 'minutes' ? `Minutos · máx. ${maxMinutes}'` : field.title}
                >
                  {field.key === 'minutes' ? `Min (máx. ${maxMinutes}')` : field.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.playerId} className="hover">
                <td className="sticky left-0 bg-base-100 z-10">
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <span className="font-bold tabular-nums text-base-content/60 w-5 text-right">
                      {row.shirtNumber ?? '—'}
                    </span>
                    <span className="font-medium">{row.playerName}</span>
                    <PositionBadge position={row.position} size="xs" />
                  </div>
                </td>
                {FIELDS.map((field) => (
                  <td key={field.key} className="text-center">
                    <input
                      type="number"
                      className="input input-bordered input-xs w-14 text-center px-1"
                      aria-label={`${row.playerName} · ${field.title}`}
                      title={field.key === 'minutes' ? `Minutos · máx. ${maxMinutes}'` : field.title}
                      min={field.key === 'rating' ? 1 : 0}
                      max={field.key === 'minutes' ? maxMinutes : field.max}
                      step={field.step ?? 1}
                      value={row[field.key]}
                      onChange={(event) => {
                        const raw = event.target.value;
                        const parsed = raw === '' ? 0 : Number(raw);
                        setField(row.playerId, field.key, Number.isNaN(parsed) ? 0 : parsed);
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-base-200/60">
            <tr>
              <td className="sticky left-0 bg-base-200 z-10 font-semibold">Promedio</td>
              <td colSpan={4} className="text-center">
                <RatingBadge
                  value={rows.length > 0 ? rows.reduce((acc, row) => acc + row.rating, 0) / rows.length : 0}
                  size="sm"
                />
              </td>
              <td colSpan={FIELDS.length - 4} className="text-center text-xs text-base-content/60">
                {rows.reduce((acc, row) => acc + row.goals, 0)} goles ·{' '}
                {rows.reduce((acc, row) => acc + row.assists, 0)} asistencias
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
