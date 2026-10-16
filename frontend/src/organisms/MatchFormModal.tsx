import { useMatchEditor, type MatchEditorProps } from "../hooks/useMatchEditor";
import { Alert } from "../atoms/Alert";
import { Button } from "../atoms/Button";
import { Input } from "../atoms/Input";
import { Modal } from "../atoms/Modal";
import { Select } from "../atoms/Select";
import { Textarea } from "../atoms/Textarea";
import { FormField } from "../molecules/FormField";
import { FORMAT_LIST, formationsFor, getFormat } from "../data/formations";
import type { MatchStatus, TeamFormat } from "../types/api";

export function MatchFormModal(props: MatchEditorProps) {
  const { open, onClose, match } = props;
  const { tournaments, form, setForm, setRulesSelected, busy, error, submit } =
    useMatchEditor(props);
  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      closeOnOutside={!busy}
      title={match ? `Editar partido vs. ${match.opponent}` : "Nuevo partido"}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} loading={busy}>
            {match ? "Guardar cambios" : "Crear partido"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error ? <Alert tone="error">{error}</Alert> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField
            label="Torneo y normativa"
            className="sm:col-span-2"
            hint="Al seleccionarlo se aplican sus reglas confirmadas al partido."
          >
            <Select
              value={form.tournamentId ?? ""}
              disabled={match?.status === "jugado"}
              onChange={(e) => {
                setRulesSelected(true);
                const id = e.target.value ? Number(e.target.value) : null;
                const tournament = (tournaments.data ?? []).find(
                  (row) => row.id === id,
                );
                setForm((p) =>
                  tournament
                    ? {
                        ...p,
                        tournamentId: id,
                        competition: tournament.name,
                        format: tournament.rules.format,
                        minutes:
                          tournament.rules.periods *
                          tournament.rules.minutesPerPeriod,
                        formation: tournament.rules.allowedFormations[0],
                      }
                    : { ...p, tournamentId: null },
                );
              }}
            >
              <option value="">Partido independiente</option>
              {(tournaments.data ?? [])
                .filter(
                  (row) =>
                    row.status === "publicado" ||
                    row.id === match?.tournamentId,
                )
                .map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name} · {row.rules.periods} ×{" "}
                    {row.rules.minutesPerPeriod} min
                  </option>
                ))}
            </Select>
          </FormField>
          <FormField label="Rival" required>
            <Input
              value={form.opponent}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, opponent: event.target.value }))
              }
              placeholder="Rivales FC"
            />
          </FormField>
          <FormField label="Competencia">
            <Input
              value={form.competition}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  competition: event.target.value,
                }))
              }
            />
          </FormField>
          <FormField label="Fecha y hora (Colombia)" required>
            <Input
              type="datetime-local"
              value={form.kickOff}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, kickOff: event.target.value }))
              }
            />
          </FormField>
          <FormField label="Sede">
            <Input
              value={form.venue}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, venue: event.target.value }))
              }
            />
          </FormField>
          <FormField
            label="Enlace de Google Maps"
            hint="Pega el enlace de Compartir de la cancha. Los jugadores verán el mapa y cómo llegar."
          >
            <Input
              type="url"
              maxLength={6000}
              placeholder="https://maps.app.goo.gl/…"
              value={form.venueMapsUrl}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  venueMapsUrl: event.target.value,
                }))
              }
            />
          </FormField>
          <FormField label="Localía">
            <Select
              value={form.isHome ? "1" : "0"}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  isHome: event.target.value === "1",
                }))
              }
            >
              <option value="1">Local</option>
              <option value="0">Visita</option>
            </Select>
          </FormField>
          <FormField
            label="Formato del partido"
            hint="Por defecto, el formato global del equipo."
          >
            <Select
              disabled={form.tournamentId !== null}
              value={form.format}
              onChange={(event) => {
                const next = Number(event.target.value) as TeamFormat;
                setForm((prev) => {
                  const profile = getFormat(next);
                  const stillValid = formationsFor(next).some(
                    (item) => item.key === prev.formation,
                  );
                  return {
                    ...prev,
                    format: next,
                    minutes: profile.matchMinutes,
                    formation: stillValid
                      ? prev.formation
                      : profile.defaultFormation,
                  };
                });
              }}
            >
              {FORMAT_LIST.map((profile) => (
                <option key={profile.format} value={profile.format}>
                  {profile.name} · {profile.playersOnPitch} en cancha ·{" "}
                  {profile.matchMinutes}'
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            label="Duración"
            hint={
              form.tournamentId
                ? "Definida por la normativa del torneo."
                : "Minutos totales de juego, sin incluir descansos."
            }
          >
            <Input
              type="number"
              min={1}
              max={400}
              value={form.minutes}
              disabled={form.tournamentId !== null}
              aria-label="Duración del partido"
              onChange={(e) =>
                setForm((p) => ({ ...p, minutes: Number(e.target.value) }))
              }
            />
          </FormField>
          <FormField label="Formación inicial">
            <Select
              value={form.formation}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, formation: event.target.value }))
              }
            >
              {formationsFor(form.format)
                .filter(
                  (option) =>
                    !form.tournamentId ||
                    (match?.tournamentId === form.tournamentId
                      ? match.tournamentRules?.allowedFormations
                      : tournaments.data?.find(
                          (t) => t.id === form.tournamentId,
                        )?.rules.allowedFormations
                    )?.includes(option.key),
                )
                .map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.key}
                  </option>
                ))}
            </Select>
          </FormField>
          <FormField label="Estado">
            <Select
              value={form.status}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  status: event.target.value as MatchStatus,
                }))
              }
            >
              <option value="programado">Programado</option>
              <option value="jugado">Jugado</option>
              <option value="cancelado">Cancelado</option>
              <option value="pospuesto">Pospuesto</option>
            </Select>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Goles a favor">
              <Input
                type="number"
                min={0}
                value={form.goalsFor}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, goalsFor: event.target.value }))
                }
              />
            </FormField>
            <FormField label="Goles en contra">
              <Input
                type="number"
                min={0}
                value={form.goalsAgainst}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    goalsAgainst: event.target.value,
                  }))
                }
              />
            </FormField>
          </div>
          <FormField label="Notas" className="sm:col-span-2">
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, notes: event.target.value }))
              }
              placeholder="Indicaciones generales…"
            />
          </FormField>
        </div>
      </div>
    </Modal>
  );
}

/** Partidos admin (SPEC §10.4): lista con estado + formulario "Nuevo partido". */
