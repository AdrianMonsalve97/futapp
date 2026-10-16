import { useMatchDataForm } from "../hooks/useMatchDataForm";
import { useTeamFormat } from "../context/SettingsContext";
import { Alert } from "../atoms/Alert";
import { Badge } from "../atoms/Badge";
import { Button } from "../atoms/Button";
import { Card, CardBody, CardTitle } from "../atoms/Card";
import { Input } from "../atoms/Input";
import { Select } from "../atoms/Select";
import { FormField } from "../molecules/FormField";
import { StatusBadge } from "../molecules/StatusBadge";
import type { Match, MatchStatus } from "../types/api";

export function MatchDataEditor({
  match,
  onSaved,
}: {
  match: Match;
  onSaved: () => void;
}) {
  const { form, updateForm, saveMatchData, busy, notice, actionError } =
    useMatchDataForm(match, onSaved);
  const profile = useTeamFormat(match.format),
    matchMinutes = match.minutes;
  return (
    <>
      {notice && <Alert tone="success">{notice}</Alert>}
      {actionError && <Alert tone="error">{actionError}</Alert>}
      <Card className="mb-4">
        <CardBody className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">Datos del partido</CardTitle>
            <div className="flex max-w-full flex-wrap items-center gap-2">
              <StatusBadge status={form.status} />
              <Badge tone="info" size="sm">
                {profile.name} · {matchMinutes}'
              </Badge>
              <Badge tone="neutral" size="sm">
                {match.formation}
              </Badge>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <FormField label="Rival" required>
              <Input
                value={form.opponent}
                onChange={(event) => updateForm("opponent", event.target.value)}
              />
            </FormField>
            <FormField label="Competencia">
              <Input
                value={form.competition}
                onChange={(event) =>
                  updateForm("competition", event.target.value)
                }
              />
            </FormField>
            <FormField label="Fecha y hora (Colombia)">
              <Input
                type="datetime-local"
                value={form.kickOff}
                onChange={(event) => updateForm("kickOff", event.target.value)}
              />
            </FormField>
            <FormField label="Sede">
              <Input
                value={form.venue}
                onChange={(event) => updateForm("venue", event.target.value)}
              />
            </FormField>
            <FormField
              label="Enlace de Google Maps"
              hint="Enlace de Compartir de la cancha; deja vacío para quitarlo."
            >
              <Input
                type="url"
                maxLength={6000}
                placeholder="https://maps.app.goo.gl/…"
                value={form.venueMapsUrl}
                onChange={(e) => updateForm("venueMapsUrl", e.target.value)}
              />
            </FormField>
            <FormField label="Localía">
              <Select
                value={form.isHome ? "1" : "0"}
                onChange={(event) =>
                  updateForm("isHome", event.target.value === "1")
                }
              >
                <option value="1">Local</option>
                <option value="0">Visita</option>
              </Select>
            </FormField>
            <FormField label="Estado">
              <Select
                value={form.status}
                onChange={(event) =>
                  updateForm("status", event.target.value as MatchStatus)
                }
              >
                <option value="programado">Programado</option>
                <option value="jugado">Jugado</option>
                <option value="cancelado">Cancelado</option>
                <option value="pospuesto">Pospuesto</option>
              </Select>
            </FormField>
            <FormField label="Goles a favor">
              <Input
                type="number"
                min={0}
                value={form.goalsFor}
                onChange={(event) => updateForm("goalsFor", event.target.value)}
              />
            </FormField>
            <FormField label="Goles en contra">
              <Input
                type="number"
                min={0}
                value={form.goalsAgainst}
                onChange={(event) =>
                  updateForm("goalsAgainst", event.target.value)
                }
              />
            </FormField>
            <FormField label="Notas">
              <Input
                value={form.notes}
                onChange={(event) => updateForm("notes", event.target.value)}
                placeholder="Indicaciones generales…"
              />
            </FormField>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => void saveMatchData()} loading={busy}>
              Guardar datos del partido
            </Button>
          </div>
        </CardBody>
      </Card>
    </>
  );
}
