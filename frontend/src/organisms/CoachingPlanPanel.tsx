import { Link } from "react-router-dom";
import { Button } from "../atoms/Button";
import { LeagueContextPanel } from "../molecules/LeagueContextPanel";
import { TACTICAL_ROLE_NAMES } from "../molecules/TacticalPosition";
import { TacticalBoard } from "./TacticalBoard";
import { pitchSlotsFrom } from "../utils/lineup-slots";
import type { TacticalPlan } from "../types/tactics";

export function CoachingPlanPanel({
  plan,
  busy,
  editable,
  onApply,
  onFormation,
}: {
  plan: TacticalPlan;
  busy: string | null;
  editable: boolean;
  onApply: () => void;
  onFormation: (formation: string) => void;
}) {
  return (
    <div className="space-y-5">
      <section className="fc-lineup-workspace fc-coaching-plan">
        <header className="fc-lineup-heading">
          <div>
            <p className="sport-eyebrow">
              PROPUESTA DEL EQUIPO · F{plan.match.format}
            </p>
            <h2>{plan.recommendation.formation}</h2>
            <p>
              vs. {plan.match.opponent} · {plan.match.minutes} minutos
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="btn btn-outline btn-sm"
              to={`/admin/partidos/${plan.match.id}`}
            >
              Abrir sala de partido
            </Link>
            <Button
              onClick={onApply}
              disabled={!editable || busy !== null}
              loading={busy === "apply"}
            >
              Usar propuesta como borrador
            </Button>
          </div>
        </header>
        <TacticalBoard
          slots={pitchSlotsFrom(
            plan.recommendation.formation,
            plan.recommendation.lineup,
            plan.match.format,
          )}
          format={plan.match.format}
        />
        <div className="fc-coaching-explanation">
          <h3>Por qué este sistema</h3>
          <p>{plan.recommendation.explanation}</p>
          <p>
            <strong>Banco propuesto:</strong>{" "}
            {plan.recommendation.bench
              .map((player) => player.playerName)
              .join(", ") || "Sin suplentes disponibles"}
          </p>
          <p className="text-sm">
            La propuesta respeta asistencia, pagos aprobados y normativa.
            Guardarla no publica la alineación.
          </p>
        </div>
      </section>
      <details className="rounded-xl border border-base-300 p-4 sm:p-6">
        <summary className="cursor-pointer font-semibold">
          Comparar sistemas y disponibilidad
        </summary>
        <p className="text-sm text-base-content/65 my-4">
          El índice compara encaje y vacantes; no expresa una probabilidad de
          ganar. Solo se evalúan sistemas permitidos por la liga.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            {plan.formations.map((formation) => (
              <div
                key={formation.key}
                className="border border-base-300 rounded-xl p-4"
              >
                <div className="flex flex-wrap justify-between items-center gap-3">
                  <strong>{formation.key}</strong>
                  <Button
                    size="sm"
                    variant={
                      formation.key === plan.recommendation.formation
                        ? "primary"
                        : "outline"
                    }
                    disabled={busy !== null}
                    onClick={() => onFormation(formation.key)}
                  >
                    {formation.key === plan.recommendation.formation
                      ? "Propuesta actual"
                      : "Comparar"}
                  </Button>
                </div>
                <p className="text-sm mt-2">
                  {formation.filled}/{plan.match.format} puestos cubiertos ·{" "}
                  {formation.naturalFit} en su posición principal · índice{" "}
                  {formation.score.toFixed(2)}
                </p>
              </div>
            ))}
          </div>
          <div className="space-y-4">
            <h3 className="font-semibold">Cobertura por posición</h3>
            <p className="text-sm text-base-content/65">
              Incluye posiciones secundarias; un jugador puede contar en más de
              una línea.
            </p>
            {plan.positions.map((position) => (
              <div key={position.role}>
                <p className="flex justify-between gap-3 text-sm">
                  <span>{TACTICAL_ROLE_NAMES[position.role]}</span>
                  <strong>
                    {position.available} disponibles / {position.needed}{" "}
                    necesarios
                  </strong>
                </p>
                <progress
                  className="progress progress-primary w-full"
                  value={position.available}
                  max={Math.max(position.available, position.needed, 1)}
                  aria-label={`Disponibilidad de ${TACTICAL_ROLE_NAMES[position.role]}`}
                />
              </div>
            ))}
          </div>
        </div>
      </details>
      {plan.recommendation.leagueContext && (
        <details className="rounded-xl border border-base-300 p-4">
          <summary className="cursor-pointer font-semibold">
            Normativa aplicada a la propuesta
          </summary>
          <LeagueContextPanel context={plan.recommendation.leagueContext} />
        </details>
      )}
    </div>
  );
}
