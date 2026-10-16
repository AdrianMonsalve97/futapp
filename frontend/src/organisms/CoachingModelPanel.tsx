import { Button } from "../atoms/Button";
import { Card, CardBody, CardTitle } from "../atoms/Card";
import { RatingTrendChart } from "./RatingTrendChart";
import { ProbabilityBars } from "./ProbabilityBars";
import { AiInsightsPanel } from "./AiInsightsPanel";
import { formatDateTime, formatRating } from "../utils/format";
import type { AiInsights } from "../types/api";
export function CoachingModelPanel({
  insights,
  busy,
  onTrain,
}: {
  insights: AiInsights;
  busy: string | null;
  onTrain: () => void;
}) {
  const prediction = insights.nextMatchPrediction;
  return (
    <div className="grid gap-4 lg:grid-cols-2 mt-4">
      <Card>
        <CardBody>
          <CardTitle className="text-base">Forma del equipo</CardTitle>
          <RatingTrendChart
            title="Rating promedio por partido"
            points={insights.formTrend.map((f) => ({
              label: f.opponent,
              value: f.rating,
            }))}
          />
          <AiInsightsPanel insights={insights.insights} />
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <CardTitle className="text-base">
            Próximo partido programado
          </CardTitle>
          {prediction ? (
            <>
              <p>
                {prediction.opponent} · F{prediction.format} ·{" "}
                {formatDateTime(prediction.kickOff)}
              </p>
              <ProbabilityBars {...prediction} />
            </>
          ) : (
            <p>Sin próximo partido.</p>
          )}
          <h3 className="font-semibold">Modelo de rendimiento</h3>
          <p className="text-sm">
            {insights.model.metrics.samples} muestras · MAE de entrenamiento{" "}
            {formatRating(insights.model.metrics.mae, 3)}
          </p>
          {insights.model.validation ? (
            <p className="text-sm">
              Evaluación en partidos posteriores:{" "}
              {insights.model.validation.samples} muestras · MAE{" "}
              {formatRating(insights.model.validation.mae, 3)} · RMSE{" "}
              {formatRating(insights.model.validation.rmse, 3)}
            </p>
          ) : null}
          <Button
            size="sm"
            disabled={busy !== null}
            loading={busy === "train"}
            onClick={() => onTrain()}
          >
            Reentrenar modelo
          </Button>
          <h3 className="font-semibold">Jugadores mejor valorados</h3>
          {insights.topPlayers.map((p) => (
            <p className="text-sm" key={p.playerId}>
              {p.playerName} · previsto {formatRating(p.predictedRating, 2)} ·
              promedio {formatRating(p.avgRating, 2)}
            </p>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
