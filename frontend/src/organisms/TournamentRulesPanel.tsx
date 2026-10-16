import { Card, CardBody } from "../atoms/Card";
import { Button } from "../atoms/Button";
import type { Tournament } from "../types/tournament";
export function TournamentRulesPanel({
  row,
  admin,
  isDefault,
  onMakeDefault,
}: {
  row: Tournament;
  admin: boolean;
  isDefault: boolean;
  onMakeDefault: () => Promise<void>;
}) {
  return (
    <Card>
      <CardBody className="space-y-4">
        <h3 className="font-bold">Reglas confirmadas</h3>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {[
            ["En cancha", `${row.rules.format} jugadores`],
            [
              "Convocatoria",
              row.rules.maxSquad === null
                ? "Por confirmar"
                : `Hasta ${row.rules.maxSquad}`,
            ],
            [
              "Tiempo de juego",
              `${row.rules.periods * row.rules.minutesPerPeriod} min`,
            ],
            [
              "Descanso",
              row.rules.breakMinutes === null
                ? "Por confirmar"
                : `${row.rules.breakMinutes} min entre tiempos`,
            ],
            ["Cambios", row.rules.maxSubstitutions ?? "Sin límite"],
            [
              "Reingreso",
              row.rules.rollingSubstitutions === null
                ? "Por confirmar"
                : row.rules.rollingSubstitutions
                  ? "Permitido"
                  : "No permitido",
            ],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg bg-base-200 p-3">
              <dt className="text-xs text-base-content/60">{label}</dt>
              <dd className="font-semibold mt-1">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm">
          Formaciones a evaluar:{" "}
          <strong>{row.rules.allowedFormations.join(" · ")}</strong>
        </p>
        <p className="text-sm">Enfoque: {row.rules.tacticalStyle}</p>
        {admin && row.status === "publicado" ? (
          <Button variant="outline" onClick={() => void onMakeDefault()}>
            {isDefault
              ? "Quitar como torneo predeterminado"
              : "Usar en nuevos partidos"}
          </Button>
        ) : null}
        <p className="text-xs text-base-content/55">
          Cada partido conserva una copia de sus reglas. Editar este torneo se
          aplica a nuevos partidos o al volver a seleccionarlo en un partido
          pendiente.
        </p>
      </CardBody>
    </Card>
  );
}
