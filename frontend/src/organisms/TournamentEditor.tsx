import {
  useTournamentEditor,
  type TournamentEditorProps,
} from "../hooks/useTournamentEditor";
import { Alert } from "../atoms/Alert";
import { Button } from "../atoms/Button";
import { Modal } from "../atoms/Modal";
import { FORMAT_LIST, formationsFor } from "../data/formations";
import type { TeamFormat } from "../types/api";
import type { Tournament, TournamentRules } from "../types/tournament";

export function TournamentEditor(props: TournamentEditorProps) {
  const { current, close } = props;
  const { form, setForm, busy, error, rule, submit } =
    useTournamentEditor(props);
  return (
    <Modal
      open
      onClose={close}
      title={current ? "Editar torneo y normativa" : "Nuevo torneo"}
      size="lg"
      closeOnOutside={!busy}
    >
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        {error ? <Alert tone="error">{error}</Alert> : null}
        <p className="text-sm text-base-content/60">
          Confirma estos datos con el reglamento. La duración se define por
          torneo; un nuevo torneo comienza sin minutos asumidos.
        </p>
        {!current ? (
          <p className="text-sm text-primary">
            Después de guardar puedes subir la foto o afiche desde la ficha del
            torneo.
          </p>
        ) : null}
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="form-control">
            Nombre del torneo
            <input
              required
              maxLength={120}
              className="input input-bordered w-full mt-1"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </label>
          <label className="form-control">
            Liga u organizador
            <input
              required
              maxLength={120}
              className="input input-bordered w-full mt-1"
              value={form.leagueName}
              onChange={(e) =>
                setForm((p) => ({ ...p, leagueName: e.target.value }))
              }
            />
          </label>
          <label>
            Temporada
            <input
              required
              maxLength={40}
              className="input input-bordered w-full mt-1"
              value={form.season}
              onChange={(e) =>
                setForm((p) => ({ ...p, season: e.target.value }))
              }
            />
          </label>
          <label>
            Visibilidad
            <select
              className="select select-bordered w-full mt-1"
              value={form.status}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  status: e.target.value as Tournament["status"],
                }))
              }
            >
              <option value="borrador">Borrador · solo administración</option>
              <option value="publicado">Publicado · todos los jugadores</option>
              <option value="archivado">Archivado · consulta histórica</option>
            </select>
          </label>
          <label>
            Jugadores en cancha
            <select
              className="select select-bordered w-full mt-1"
              value={form.rules.format}
              onChange={(e) => {
                const format = Number(e.target.value) as TeamFormat;
                setForm((p) => ({
                  ...p,
                  rules: {
                    ...p.rules,
                    format,
                    maxSquad:
                      p.rules.maxSquad === null
                        ? null
                        : Math.max(format, p.rules.maxSquad),
                    allowedFormations: formationsFor(format).map((f) => f.key),
                  },
                }));
              }}
            >
              {FORMAT_LIST.map((p) => (
                <option key={p.format} value={p.format}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Límite de convocatoria
            <input
              type="number"
              min={form.rules.format}
              max={50}
              className="input input-bordered w-full mt-1"
              value={form.rules.maxSquad ?? ""}
              placeholder="Por confirmar"
              onChange={(e) =>
                rule(
                  "maxSquad",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
            />
          </label>
          <label>
            Número de tiempos
            <input
              required
              type="number"
              min={1}
              max={4}
              className="input input-bordered w-full mt-1"
              value={form.rules.periods}
              onChange={(e) => rule("periods", Number(e.target.value))}
            />
          </label>
          <label>
            Minutos por tiempo
            <input
              required
              type="number"
              min={1}
              max={400}
              className="input input-bordered w-full mt-1"
              value={form.rules.minutesPerPeriod || ""}
              placeholder="Según reglamento"
              onChange={(e) => rule("minutesPerPeriod", Number(e.target.value))}
            />
          </label>
          <label>
            Descanso entre tiempos (min)
            <input
              type="number"
              min={0}
              max={60}
              className="input input-bordered w-full mt-1"
              value={form.rules.breakMinutes ?? ""}
              placeholder="Por confirmar"
              onChange={(e) =>
                rule(
                  "breakMinutes",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
            />
          </label>
          <label>
            Límite de cambios
            <input
              type="number"
              min={0}
              max={50}
              className="input input-bordered w-full mt-1"
              value={form.rules.maxSubstitutions ?? ""}
              placeholder="Vacío = sin límite"
              onChange={(e) =>
                rule(
                  "maxSubstitutions",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
            />
          </label>
        </div>
        <div className="rounded-xl bg-primary/10 p-3">
          <strong>
            {form.rules.periods * form.rules.minutesPerPeriod} minutos de juego
          </strong>
          <span className="text-sm text-base-content/60">
            {" "}
            ·{" "}
            {form.rules.breakMinutes === null
              ? "Descanso por confirmar"
              : `${Math.max(0, form.rules.periods - 1) * form.rules.breakMinutes} minutos de descansos`}
          </span>
        </div>
        <label className="block">
          Reingreso al campo
          <select
            className="select select-bordered w-full mt-1"
            value={
              form.rules.rollingSubstitutions === null
                ? ""
                : String(form.rules.rollingSubstitutions)
            }
            onChange={(e) =>
              rule(
                "rollingSubstitutions",
                e.target.value === "" ? null : e.target.value === "true",
              )
            }
          >
            <option value="">Por confirmar con la liga</option>
            <option value="true">Permitido</option>
            <option value="false">No permitido</option>
          </select>
        </label>
        <fieldset className="space-y-2">
          <legend className="font-semibold text-sm">
            Formaciones que el entrenador quiere evaluar
          </legend>
          <div className="flex flex-wrap gap-3">
            {formationsFor(form.rules.format).map((f) => (
              <label key={f.key} className="flex gap-2 items-center text-sm">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={form.rules.allowedFormations.includes(f.key)}
                  onChange={(e) =>
                    rule(
                      "allowedFormations",
                      e.target.checked
                        ? [...form.rules.allowedFormations, f.key]
                        : form.rules.allowedFormations.filter(
                            (key) => key !== f.key,
                          ),
                    )
                  }
                />
                {f.key}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block">
          Enfoque táctico
          <select
            className="select select-bordered w-full mt-1"
            value={form.rules.tacticalStyle}
            onChange={(e) =>
              rule(
                "tacticalStyle",
                e.target.value as TournamentRules["tacticalStyle"],
              )
            }
          >
            <option value="equilibrado">Equilibrado</option>
            <option value="ofensivo">Ofensivo</option>
            <option value="defensivo">Defensivo</option>
          </select>
        </label>
        <label className="block">
          Normas adicionales e indicaciones para el equipo
          <textarea
            rows={4}
            maxLength={20000}
            className="textarea textarea-bordered w-full mt-1"
            value={form.notes}
            placeholder="Desempates, sanciones, inscripciones, edades, fechas, indicaciones tácticas…"
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          />
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" loading={busy}>
            Guardar torneo
          </Button>
        </div>
      </form>
    </Modal>
  );
}
