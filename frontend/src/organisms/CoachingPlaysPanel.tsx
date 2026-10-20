import { TacticalPlayPicker } from "../molecules/TacticalPlayPicker";
import { TacticalPlayDetails } from "../molecules/TacticalPlayDetails";
import { Alert } from "../atoms/Alert";
import { Button } from "../atoms/Button";
import { Card, CardBody, CardTitle } from "../atoms/Card";
import { TacticalPlayboard } from "./TacticalPlayboard";
import { formatDateTime } from "../utils/format";
import type {
  TacticalPlan,
  TacticalPlay,
  CoachingResearch,
} from "../types/tactics";
export function CoachingPlaysPanel({
  plan,
  activePlay,
  research,
  busy,
  editable,
  onSelect,
  onResearch,
  onSave,
}: {
  plan: TacticalPlan;
  activePlay: TacticalPlay | undefined;
  research: CoachingResearch | null;
  busy: string | null;
  editable: boolean;
  onSelect: (id: string) => void;
  onResearch: () => void;
  onSave: (play: TacticalPlay) => void;
}) {
  return (
    <Card className="mb-4">
      <CardBody className="gap-4">
        <div className="flex flex-wrap justify-between gap-3">
          <div>
            <CardTitle>Jugar con una idea</CardTitle>
            <p className="text-sm text-base-content/60">
              Jugadas adaptadas al {plan.match.format} inicial y a sus
              posiciones.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => onResearch()}
            disabled={busy !== null}
            loading={busy === "research"}
          >
            Consultar recursos en internet
          </Button>
        </div>
        <TacticalPlayPicker
          plays={plan.plays}
          selectedId={activePlay?.id}
          onSelect={onSelect}
        />
        {activePlay ? (
          <div className="space-y-5">
            <TacticalPlayboard
              key={`${plan.match.id}:${plan.recommendation.formation}:${activePlay.id}`}
              play={activePlay}
              slots={plan.recommendation.lineup}
              format={plan.match.format}
              formation={plan.recommendation.formation}
              phaseFormations={plan.recommendation.phaseFormations}
            />
            <div className="space-y-3">
              <TacticalPlayDetails play={activePlay} />
              <div>
                {plan.mode === "match" && (
                  <Button
                    size="sm"
                    onClick={() => onSave(activePlay)}
                    disabled={!editable || busy !== null}
                    loading={busy === activePlay.id}
                  >
                    Guardar jugada en el partido
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : null}
        <div className="rounded-xl bg-primary/10 p-4">
          <h3 className="font-semibold">Rotación durante el partido</h3>
          <p className="text-sm mt-1">{plan.rotation}</p>
        </div>
        {research && research.style === plan.style ? (
          <div className="space-y-2 border-t border-base-200 pt-4">
            <h3 className="font-semibold">Recursos del FIFA Training Centre</h3>
            <p className="text-sm">
              {research.query} · consulta {formatDateTime(research.checkedAt)}
            </p>
            {research.status !== "consultado" ? (
              <Alert tone="info">
                {research.status === "parcial"
                  ? "Algunos recursos no respondieron."
                  : "La consulta web no estuvo disponible."}{" "}
                Conservamos los enlaces de referencia para que puedas abrirlos.
              </Alert>
            ) : null}
            {research.sources.map((s) => (
              <div key={s.url}>
                <a
                  className="link text-sm"
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {s.title}
                </a>
                <p className="text-xs text-base-content/60">
                  {s.topic} ·{" "}
                  {s.verified
                    ? "Consultado en línea"
                    : "Referencia; acceso sin confirmar"}
                </p>
              </div>
            ))}
          </div>
        ) : null}
        <p className="text-xs text-base-content/60">
          {plan.methodology} La búsqueda se realiza en la biblioteca oficial de
          FIFA por estilo y conserva referencias si no hay conexión. Las jugadas
          requieren revisión del entrenador.
        </p>
      </CardBody>
    </Card>
  );
}
