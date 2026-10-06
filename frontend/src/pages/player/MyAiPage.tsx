import { useFetch } from '../../hooks/useFetch';
import { useTeamFormat } from '../../context/SettingsContext';
import { PageHeader } from '../../templates/PageHeader';
import { Alert } from '../../atoms/Alert';
import { Card, CardBody, CardTitle } from '../../atoms/Card';
import { Spinner } from '../../atoms/Spinner';
import { AiPlayerCard } from '../../organisms/AiPlayerCard';
import { RatingTrendChart } from '../../organisms/RatingTrendChart';
import { RateNote } from '../../molecules/RateNote';
import type { AiPlayerInsight } from '../../types/api';

/** Mi IA (SPEC §10.4): forecast, fortalezas/debilidades, recomendación y tendencia. */
export function MyAiPage() {
  const { data, loading, error, reload } = useFetch<AiPlayerInsight>('/api/me/ai');
  /** §12.7.9 — predicciones normalizadas "por partido" (salvo f11: "por 90'"). */
  const profile = useTeamFormat();

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <>
        <PageHeader title="Mi rendimiento con IA" subtitle="Predicción de calificación y recomendaciones" />
        <Alert tone="error" title="No se pudo cargar el análisis" onClose={reload}>
          {error ?? 'Sin datos disponibles.'}
        </Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Mi rendimiento con IA"
        subtitle={`Modelo lineal entrenado con las estadísticas del plantel · ${profile.name} (${profile.matchMinutes}')`}
      />

      <RateNote format={profile.format} className="-mt-3 mb-4" />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] items-start">
        <AiPlayerCard insight={data} showHistory={false} />

        <Card>
          <CardBody className="gap-2">
            <CardTitle className="text-base">Tendencia de calificación</CardTitle>
            <RatingTrendChart
              title="Últimos 5 partidos"
              points={data.forecast.history.map((item) => ({
                label: item.opponent,
                value: item.rating,
              }))}
            />
            <p className="text-xs text-base-content/50">
              Confianza del pronóstico: {Math.round(data.forecast.confidence * 100)}% · tendencia:{' '}
              {data.forecast.trend}
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
