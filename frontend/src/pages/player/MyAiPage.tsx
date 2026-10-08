import { useEffect,useState } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { useTeamFormat } from '../../context/SettingsContext';
import { LeagueContextPanel } from '../../molecules/LeagueContextPanel';
import { PageHeader } from '../../templates/PageHeader';
import { Alert } from '../../atoms/Alert';
import { Card, CardBody, CardTitle } from '../../atoms/Card';
import { Spinner } from '../../atoms/Spinner';
import { AiPlayerCard } from '../../organisms/AiPlayerCard';
import { IndividualPreparation } from '../../organisms/IndividualPreparation';
import { RatingTrendChart } from '../../organisms/RatingTrendChart';
import { RateNote } from '../../molecules/RateNote';
import type { AiPlayerInsight,Match } from '../../types/api';

/** Mi IA (SPEC §10.4): forecast, fortalezas/debilidades, recomendación y tendencia. */
export function MyAiPage() {
  const [matchId,setMatchId]=useState('');
  const matches=useFetch<Match[]>('/api/matches');
  const { data, loading, error, reload } = useFetch<AiPlayerInsight>(`/api/me/ai${matchId?`?matchId=${matchId}`:''}`);
  useEffect(()=>{const timer=setInterval(reload,30000);return()=>clearInterval(timer);},[reload]);
  /** §12.7.9 — predicciones normalizadas "por partido" (salvo f11: "por 90'"). */
  const profile = useTeamFormat(data?.preparation.format);

  if (loading && !data) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }
  if (!data) {
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
        subtitle={`Tu rol, alineación y preparación · ${profile.name} (${data.preparation.minutes}')`}
      />
      <label className="grid gap-2 text-sm mb-5">Partido para mi preparación<select className="select select-bordered w-full" value={matchId} onChange={e=>setMatchId(e.target.value)}><option value="">Próximo partido vigente</option>{matches.data?.map(m=><option key={m.id} value={m.id}>{m.kickOff.slice(0,10)} · {m.opponent} · F{m.format} · {m.minutes} min</option>)}</select></label>

      <div className="mb-4"><LeagueContextPanel context={data.leagueContext} /></div>
      {error?<Alert tone="error" className="mb-4">{error}</Alert>:null}
      <div className="mb-5"><IndividualPreparation key={`${data.playerId}:${data.preparation.role}:${data.preparation.matchId}:${data.preparation.publishedAt}`} insight={data}/></div>
      <RateNote format={profile.format} minutes={data.preparation.minutes} className="mb-4" />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] items-start">
        <AiPlayerCard insight={data} showHistory={false} showPreparation={false}/>

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
