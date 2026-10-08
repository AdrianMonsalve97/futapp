import { Alert } from '../atoms/Alert';
import { Badge } from '../atoms/Badge';
import { ProgressBar } from '../atoms/ProgressBar';
import { RatingTrendChart } from './RatingTrendChart';
import { RatingBadge } from '../molecules/RatingBadge';
import { PositionBadge } from '../molecules/PositionBadge';
import { Icon } from '../atoms/Icon';
import type { AiPlayerInsight } from '../types/api';
import { IndividualPreparation } from './IndividualPreparation';

const TREND: Record<'sube' | 'estable' | 'baja', { label: string; tone: 'success' | 'info' | 'error'; icon: 'arrowRight' }> = {
  sube: { label: 'Tendencia ascendente', tone: 'success', icon: 'arrowRight' },
  estable: { label: 'Tendencia estable', tone: 'info', icon: 'arrowRight' },
  baja: { label: 'Tendencia descendente', tone: 'error', icon: 'arrowRight' },
};

export interface AiPlayerCardProps {
  insight: AiPlayerInsight;
  /** Oculta la lista de fortalezas/debilidades (para vistas compactas). */
  compact?: boolean;
  /** Oculta el gráfico de historial (si la página lo muestra aparte). */
  showHistory?: boolean;
}

/** Tarjeta de IA individual: forecast, confianza, tendencia, fortalezas/debilidades. */
export function AiPlayerCard({ insight, compact = false, showHistory = true }: AiPlayerCardProps) {
  const trend = TREND[insight.forecast.trend] ?? TREND.estable;

  return (
    <div className="space-y-4">
      <div className="card bg-base-100 border border-base-200 shadow-sm">
        <div className="card-body p-4 gap-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary grid place-items-center">
                <Icon name="sparkles" size={22} />
              </div>
              <div>
                <p className="font-bold leading-tight">{insight.playerName}</p>
                <div className="flex items-center gap-2 mt-1">
                  <PositionBadge position={insight.position} size="xs" />
                  <Badge tone={trend.tone} size="xs">
                    {trend.label}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase text-base-content/50">{insight.forecast.history.length?'Próxima calificación':'Sin historial de rendimiento'}</p>
              <div className="flex items-center gap-2 justify-end mt-1">
                {insight.forecast.history.length?<RatingBadge value={insight.forecast.nextRating} size="lg" decimals={2} />:null}
                {!insight.forecast.history.length?<span className="text-sm font-semibold text-base-content/60">Registra tus primeros partidos</span>:null}
              </div>
            </div>
          </div>

          <ProgressBar
            value={Math.round(insight.forecast.confidence * 100)}
            tone="info"
            label={`Confianza del modelo: ${Math.round(insight.forecast.confidence * 100)}%`}
          />

          {showHistory ? (
            <RatingTrendChart
              title="Últimos partidos"
              points={insight.forecast.history.map((item) => ({
                label: item.opponent,
                value: item.rating,
              }))}
              className="mt-1"
            />
          ) : null}
        </div>
      </div>
      {compact ? null : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="card bg-base-100 border border-base-200 shadow-sm">
            <div className="card-body p-4 gap-2">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Badge tone="success" size="xs">Fortalezas</Badge>
              </h3>
              {insight.strengths.length === 0 ? (
                <p className="text-sm text-base-content/50">Sin fortalezas destacadas todavía.</p>
              ) : (
                <ul className="space-y-2">
                  {insight.strengths.map((item) => (
                    <li key={item.label} className="text-sm">
                      <span className="badge badge-success badge-xs mr-2 align-middle" />
                      <span className="font-medium">{item.label}</span>
                      <p className="text-base-content/60 text-xs mt-0.5">{item.detail}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="card bg-base-100 border border-base-200 shadow-sm">
            <div className="card-body p-4 gap-2">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Badge tone="warning" size="xs">A mejorar</Badge>
              </h3>
              {insight.weaknesses.length === 0 ? (
                <p className="text-sm text-base-content/50">Sin debilidades relevantes.</p>
              ) : (
                <ul className="space-y-2">
                  {insight.weaknesses.map((item) => (
                    <li key={item.label} className="text-sm">
                      <span className="badge badge-warning badge-xs mr-2 align-middle" />
                      <span className="font-medium">{item.label}</span>
                      <p className="text-base-content/60 text-xs mt-0.5">{item.detail}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      <Alert tone="info" title="Recomendación del modelo">
        {insight.recommendation}
      </Alert>
      {!compact?<IndividualPreparation key={`${insight.playerId}:${insight.preparation.matchId}:${insight.preparation.publishedAt}`} insight={insight}/>:null}
    </div>
  );
}
