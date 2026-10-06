import { formatPercent, formatRating } from '../utils/format';

export interface ProbabilityBarsProps {
  winProbability: number;
  drawProbability: number;
  loseProbability: number;
  opponent?: string;
  projectedGoalsFor?: number;
  projectedGoalsAgainst?: number;
  teamRating?: number;
  opponentRating?: number;
  className?: string;
}

interface BarRow {
  label: string;
  value: number;
  barClass: string;
  textClass: string;
}

/** Barras horizontales de probabilidad de resultado (victoria/empate/derrota). */
export function ProbabilityBars({
  winProbability,
  drawProbability,
  loseProbability,
  opponent,
  projectedGoalsFor,
  projectedGoalsAgainst,
  teamRating,
  opponentRating,
  className = '',
}: ProbabilityBarsProps) {
  const rows: BarRow[] = [
    { label: 'Victoria', value: winProbability, barClass: 'bg-success', textClass: 'text-success' },
    { label: 'Empate', value: drawProbability, barClass: 'bg-info', textClass: 'text-info' },
    { label: 'Derrota', value: loseProbability, barClass: 'bg-error', textClass: 'text-error' },
  ];

  return (
    <div className={`space-y-3 ${className}`.trim()}>
      {opponent ? (
        <p className="text-sm text-base-content/70">
          Pronóstico vs. <span className="font-semibold">{opponent}</span>
        </p>
      ) : null}

      {rows.map((row) => (
        <div key={row.label}>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="font-medium">{row.label}</span>
            <span className={`font-bold tabular-nums ${row.textClass}`}>{formatPercent(row.value, 1)}</span>
          </div>
          <div className="h-3 w-full rounded-full bg-base-200 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${row.barClass}`}
              style={{ width: `${Math.max(0, Math.min(100, row.value * 100))}%` }}
            />
          </div>
        </div>
      ))}

      <div className="grid grid-cols-2 gap-2 pt-1 text-sm">
        {projectedGoalsFor !== undefined && projectedGoalsAgainst !== undefined ? (
          <div className="rounded-lg bg-base-200 px-3 py-2">
            <p className="text-xs text-base-content/60">Goles proyectados</p>
            <p className="font-bold tabular-nums">
              {projectedGoalsFor.toFixed(1)} – {projectedGoalsAgainst.toFixed(1)}
            </p>
          </div>
        ) : null}
        {teamRating !== undefined && opponentRating !== undefined ? (
          <div className="rounded-lg bg-base-200 px-3 py-2">
            <p className="text-xs text-base-content/60">Calificación equipo</p>
            <p className="font-bold tabular-nums">
              {formatRating(teamRating, 2)} vs {formatRating(opponentRating, 2)}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
