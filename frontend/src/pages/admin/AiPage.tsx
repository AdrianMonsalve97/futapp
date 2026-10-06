import { useState } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { useSettings } from '../../context/SettingsContext';
import { api, errorMessage } from '../../services/api';
import { PageHeader } from '../../templates/PageHeader';
import { Alert } from '../../atoms/Alert';
import { Badge } from '../../atoms/Badge';
import { Button } from '../../atoms/Button';
import { Card, CardBody, CardTitle } from '../../atoms/Card';
import { EmptyState } from '../../atoms/EmptyState';
import { FormField } from '../../molecules/FormField';
import { Select } from '../../atoms/Select';
import { Spinner } from '../../atoms/Spinner';
import { RatingBadge } from '../../molecules/RatingBadge';
import { AiInsightsPanel } from '../../organisms/AiInsightsPanel';
import { FormationPitch, pitchGridClass, pitchSlotsFrom } from '../../organisms/FormationPitch';
import { ProbabilityBars } from '../../organisms/ProbabilityBars';
import { RatingTrendChart } from '../../organisms/RatingTrendChart';
import { StatCardsRow } from '../../organisms/StatCardsRow';
import { formatBadge, formationsFor, getFormat, rateLabel } from '../../data/formations';
import { formatDateTime, formatPercent, formatRating } from '../../utils/format';
import type {
  AiInsights,
  LineupSlot,
  LineupResponse,
  Match,
  ModelInfo,
  RecommendXiResponse,
} from '../../types/api';

type Busy = 'apply' | 'train' | null;

/**
 * Inteligencia artificial (SPEC §10.4 + §12.7.8): probabilidad del próximo
 * partido, XI recomendado aplicable al partido, conclusiones del modelo,
 * jugadores top y métricas con reentrenamiento — todo con el formato del partido.
 */
export function AiPage() {
  const insights = useFetch<AiInsights>('/api/ai/insights');
  const matches = useFetch<Match[]>('/api/matches');
  const { settings } = useSettings();

  const [targetId, setTargetId] = useState<number | null>(null);
  const [model, setModel] = useState<ModelInfo | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (insights.loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }
  if (insights.error || !insights.data) {
    return (
      <>
        <PageHeader title="Inteligencia artificial" subtitle="Pronósticos, XI sugerido y métricas del modelo" />
        <Alert tone="error" title="No se pudo cargar el análisis" onClose={insights.reload}>
          {insights.error ?? 'Sin datos disponibles.'}
        </Alert>
      </>
    );
  }

  const data = insights.data;
  const activeModel = model ?? data.model;
  const prediction = data.nextMatchPrediction;
  const matchList = matches.data ?? [];
  const selectedMatchId =
    targetId ??
    prediction?.matchId ??
    matchList.find((match) => match.status === 'programado')?.id ??
    matchList[0]?.id ??
    null;

  // §12.7.8 — la IA usa el formato del partido concreto (si no, el del equipo).
  const selectedMatch = matchList.find((match) => match.id === selectedMatchId) ?? null;
  const aiFormat = selectedMatch?.format ?? prediction?.format ?? data.format ?? settings.profile.format;
  const profile = getFormat(aiFormat);
  const formatOptions = formationsFor(aiFormat);

  const applyXi = async () => {
    if (selectedMatchId === null) {
      setError('No hay partido disponible para aplicar la alineación.');
      return;
    }
    setBusy('apply');
    setError(null);
    setNotice(null);
    try {
      const recommended = await api<RecommendXiResponse>('/api/ai/recommend-xi', {
        method: 'POST',
        json: { matchId: selectedMatchId, formation: data.recommendedXI.formation },
      });
      const slots = recommended.lineup.map((slot: LineupSlot) => ({
        slotIndex: slot.slotIndex,
        playerId: slot.playerId ?? null,
        x: slot.x,
        y: slot.y,
        role: slot.role,
        label: slot.label,
      }));
      await api<LineupResponse>(`/api/matches/${selectedMatchId}/lineup`, {
        method: 'PUT',
        json: { slots },
      });
      setNotice(`${recommended.explanation} La alineación quedó publicada en el partido.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const trainModel = async () => {
    setBusy('train');
    setError(null);
    setNotice(null);
    try {
      const trained = await api<ModelInfo>('/api/ai/model/train', { method: 'POST' });
      setModel(trained);
      setNotice(
        `Modelo reentrenado el ${formatDateTime(trained.trainedAt)} con ${trained.metrics.samples} muestras (MAE ${formatRating(trained.metrics.mae, 3)}).`,
      );
      insights.reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Inteligencia artificial"
        subtitle={`Pronósticos, XI sugerido y métricas del modelo lineal · ${profile.name} (${profile.matchMinutes}')`}
        actions={<Badge tone="primary">{formatBadge(aiFormat)}</Badge>}
      />

      <StatCardsRow
        tiles={[
          { label: 'Calificación del equipo', value: formatRating(data.teamRating, 2), icon: 'sparkles', tone: 'primary' },
          {
            label: 'Victoria próximo partido',
            value: prediction ? formatPercent(prediction.winProbability, 1) : '—',
            icon: 'trofeo',
            tone: 'success',
            hint: prediction
              ? `vs ${prediction.opponent} · ${formatBadge(prediction.format ?? aiFormat)}`
              : 'Sin partido programado',
          },
          { label: 'Error medio (MAE)', value: formatRating(activeModel.metrics.mae, 3), icon: 'chart', tone: 'info' },
          { label: 'Muestras de entrenamiento', value: activeModel.metrics.samples, icon: 'clipboard', tone: 'neutral' },
        ]}
        className="mb-4"
      />

      {error ? (
        <Alert tone="error" className="mb-4" onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}
      {notice ? (
        <Alert tone="success" className="mb-4" onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3 items-start">
        {/* Pronóstico del próximo partido */}
        <Card>
          <CardBody className="gap-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Próximo partido</CardTitle>
              <Badge tone="info" size="sm">{formatBadge(aiFormat)}</Badge>
            </div>
            {prediction ? (
              <>
                <p className="text-sm text-base-content/60">
                  {prediction.opponent} · {formatDateTime(prediction.kickOff)}
                </p>
                <ProbabilityBars
                  winProbability={prediction.winProbability}
                  drawProbability={prediction.drawProbability}
                  loseProbability={prediction.loseProbability}
                  projectedGoalsFor={prediction.projectedGoalsFor}
                  projectedGoalsAgainst={prediction.projectedGoalsAgainst}
                  teamRating={prediction.teamRating}
                  opponentRating={prediction.opponentRating}
                />
                <p className="text-xs text-base-content/50">
                  Calibrado para {profile.name}: ~{profile.ai.baselineFor.toFixed(1)} goles a favor y ~
                  {profile.ai.baselineAgainst.toFixed(1)} en contra por partido (tope{' '}
                  {profile.ai.xgClampMax}).
                </p>
              </>
            ) : (
              <EmptyState
                title="Sin próximo partido"
                message="Programá un partido para ver la probabilidad de resultado."
                icon="calendar"
              />
            )}
          </CardBody>
        </Card>

        {/* Forma reciente del equipo */}
        <Card>
          <CardBody className="gap-2">
            <CardTitle className="text-base">Forma del equipo</CardTitle>
            <RatingTrendChart
              title="Calificación promedio por partido"
              points={data.formTrend.map((item) => ({ label: item.opponent, value: item.rating }))}
            />
            {data.formTrend.length > 0 ? (
              <p className="text-xs text-base-content/50">
                Último resultado:{' '}
                {`${data.formTrend[data.formTrend.length - 1].opponent} · ${data.formTrend[data.formTrend.length - 1].result}`}
              </p>
            ) : null}
          </CardBody>
        </Card>

        {/* Conclusiones del modelo */}
        <Card>
          <CardBody className="gap-3">
            <CardTitle className="text-base">Conclusiones</CardTitle>
            <AiInsightsPanel insights={data.insights} />
          </CardBody>
        </Card>
      </div>

      {/* XI recomendado + aplicación al partido */}
      <Card className="mt-4">
        <CardBody className="gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">XI recomendado</CardTitle>
              <Badge tone="primary" size="sm">
                {data.recommendedXI.formation}
              </Badge>
              <Badge tone="info" size="sm">
                {formatBadge(aiFormat)}
              </Badge>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <FormField label="Partido destino" className="w-72">
                <Select
                  value={selectedMatchId !== null ? String(selectedMatchId) : ''}
                  onChange={(event) => setTargetId(Number(event.target.value))}
                  aria-label="Partido destino de la alineación"
                >
                  <option value="">— Sin partidos —</option>
                  {matchList.map((match) => (
                    <option key={match.id} value={match.id}>
                      {match.kickOff.slice(0, 10)} · vs {match.opponent} ({match.status}) ·{' '}
                      {formatBadge(match.format ?? settings.profile.format, match.minutes)}
                    </option>
                  ))}
                </Select>
              </FormField>
              <Button
                onClick={() => void applyXi()}
                loading={busy === 'apply'}
                disabled={selectedMatchId === null || matchList.length === 0}
              >
                Aplicar al partido
              </Button>
            </div>
          </div>

          {matches.error ? <Alert tone="error">{matches.error}</Alert> : null}

          <div className={`grid gap-4 ${pitchGridClass(aiFormat)} items-start`}>
            <FormationPitch
              slots={pitchSlotsFrom(data.recommendedXI.formation, data.recommendedXI.slots, aiFormat)}
              format={aiFormat}
            />
            <div className="space-y-3">
              <div className="rounded-xl border border-base-200 bg-base-100 p-4">
                <h3 className="font-semibold text-sm mb-1">Por qué esta alineación</h3>
                <p className="text-sm text-base-content/70">{data.recommendedXI.explanation}</p>
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-xs text-base-content/50">Formaciones de {profile.name}:</span>
                  {formatOptions.map((option) => (
                    <Badge
                      key={option.key}
                      size="sm"
                      outline
                      tone={option.key === data.recommendedXI.formation ? 'primary' : 'neutral'}
                    >
                      {option.key}
                    </Badge>
                  ))}
                </div>
              </div>
              <ul className="space-y-1.5">
                {data.recommendedXI.slots.map((slot) => (
                  <li key={slot.slotIndex} className="flex items-center gap-2 text-sm">
                    <span className="w-12 shrink-0 text-xs text-base-content/50 font-mono">{slot.label}</span>
                    <span className={`badge badge-xs ${slot.role === 'POR' ? 'badge-warning' : slot.role === 'DEF' ? 'badge-info' : slot.role === 'MED' ? 'badge-secondary' : 'badge-error'}`}>
                      {slot.role}
                    </span>
                    <span className={slot.playerId ? 'font-medium' : 'text-base-content/40'}>
                      {slot.playerId ? `${slot.shirtNumber ?? '—'} ${slot.playerName ?? ''}` : 'Vacante'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-4 mt-4 lg:grid-cols-2 items-start">
        {/* Top jugadores predichos */}
        <Card>
          <CardBody className="gap-3">
            <CardTitle className="text-base">Jugadores mejor valorados</CardTitle>
            {data.topPlayers.length === 0 ? (
              <EmptyState
                title="Sin predicciones"
                message="El modelo necesita estadísticas cargadas para predecir jugadores."
                icon="sparkles"
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-base-200">
                <table className="table table-sm">
                  <thead className="bg-base-200">
                    <tr>
                      <th>Jugador</th>
                      <th className="text-center">Predicho</th>
                      <th className="text-center">Promedio</th>
                      <th className="text-center">Diferencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topPlayers.map((item) => {
                      const delta = item.predictedRating - item.avgRating;
                      return (
                        <tr key={item.playerId} className="hover">
                          <td>
                            <span className="badge badge-neutral badge-sm font-bold mr-2">
                              {item.shirtNumber ?? '—'}
                            </span>
                            <span className="font-medium">{item.playerName}</span>
                          </td>
                          <td className="text-center">
                            <RatingBadge value={item.predictedRating} decimals={2} />
                          </td>
                          <td className="text-center tabular-nums">{formatRating(item.avgRating, 2)}</td>
                          <td
                            className={`text-center font-bold tabular-nums ${
                              delta >= 0 ? 'text-success' : 'text-error'
                            }`}
                          >
                            {delta >= 0 ? '+' : ''}
                            {formatRating(delta, 2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Métricas del modelo */}
        <Card>
          <CardBody className="gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Métricas del modelo</CardTitle>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void trainModel()}
                loading={busy === 'train'}
              >
                Reentrenar modelo
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="info" size="sm">
                {activeModel.model}
              </Badge>
              <span className="text-xs text-base-content/60">
                Entrenado el {formatDateTime(activeModel.trainedAt)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg bg-base-200 px-3 py-2">
                <p className="text-xs text-base-content/60">MAE</p>
                <p className="font-bold tabular-nums">{formatRating(activeModel.metrics.mae, 3)}</p>
              </div>
              <div className="rounded-lg bg-base-200 px-3 py-2">
                <p className="text-xs text-base-content/60">RMSE</p>
                <p className="font-bold tabular-nums">{formatRating(activeModel.metrics.rmse, 3)}</p>
              </div>
              <div className="rounded-lg bg-base-200 px-3 py-2">
                <p className="text-xs text-base-content/60">R²</p>
                <p className="font-bold tabular-nums">{formatRating(activeModel.metrics.r2, 3)}</p>
              </div>
              <div className="rounded-lg bg-base-200 px-3 py-2">
                <p className="text-xs text-base-content/60">Muestras</p>
                <p className="font-bold tabular-nums">{activeModel.metrics.samples}</p>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-base-content/60 mb-1">Features</p>
              <div className="flex flex-wrap gap-1.5">
                {activeModel.features.map((feature) => (
                  <Badge key={feature} tone="neutral" size="sm" outline>
                    {feature}
                  </Badge>
                ))}
              </div>
            </div>

            <p className="text-xs text-base-content/50">
              Regresión lineal con gradiente descendente: cada predicción es la suma ponderada de las
              features normalizadas {rateLabel(aiFormat)} ({profile.matchMinutes}' por partido completo).
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
