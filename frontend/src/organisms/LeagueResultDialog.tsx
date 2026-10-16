import { Alert } from "../atoms/Alert";
import { Button } from "../atoms/Button";
import { Modal } from "../atoms/Modal";
import type { LeagueResult } from "../types/league";
interface LeagueResultDialogProps {
  editor: LeagueResult;
  participants: string[];
  busy: boolean;
  error: string | null;
  onChange: (result: LeagueResult) => void;
  onClose: () => void;
  onSubmit: () => void;
}
export function LeagueResultDialog({
  editor,
  participants,
  busy,
  error,
  onChange,
  onClose,
  onSubmit,
}: LeagueResultDialogProps) {
  return (
    <Modal
      open
      title="Resultado de la jornada"
      onClose={onClose}
      size="md"
      closeOnOutside={!busy}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        className="space-y-5"
      >
        <fieldset disabled={busy} className="contents">
          <p className="club-muted">
            Solo encuentros entre otros equipos. El resultado de tu club se
            registra en Partidos y se incorpora automáticamente.
          </p>
          {error && <Alert tone="error">{error}</Alert>}
          <div className="club-league-form-grid">
            <label>
              Jornada
              <input
                required
                className="input input-bordered w-full mt-2"
                type="number"
                min={1}
                max={1000}
                value={editor.matchday}
                onChange={(e) =>
                  onChange({ ...editor, matchday: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Estado
              <select
                className="select select-bordered w-full mt-2"
                value={editor.status}
                onChange={(e) =>
                  onChange({
                    ...editor,
                    status: e.target.value as LeagueResult["status"],
                  })
                }
              >
                {["jugado", "programado", "pospuesto", "cancelado"].map(
                  (value) => (
                    <option key={value}>{value}</option>
                  ),
                )}
              </select>
            </label>
            {(["home", "away"] as const).map((key, i) => (
              <label key={key}>
                {i ? "Visitante" : "Local"}
                <select
                  required
                  className="select select-bordered w-full mt-2"
                  value={editor[key]}
                  onChange={(e) =>
                    onChange({ ...editor, [key]: e.target.value })
                  }
                >
                  <option value="">Selecciona equipo</option>
                  {participants.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              </label>
            ))}
            {(["homeGoals", "awayGoals"] as const).map((key, i) => (
              <label key={key}>
                Goles {i ? "visitante" : "local"}
                <input
                  required={editor.status === "jugado"}
                  type="number"
                  min={0}
                  max={99}
                  className="input input-bordered w-full mt-2"
                  value={editor[key] ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...editor,
                      [key]:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-3">
            <Button disabled={busy} variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={busy}>
              Guardar resultado
            </Button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
