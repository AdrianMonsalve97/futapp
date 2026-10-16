import { useEffect, useRef, useState } from "react";
import { Button } from "../atoms/Button";
import { Icon } from "../atoms/Icon";
import type { LeagueConfig } from "../types/league";
interface LeagueConfigEditorProps {
  draft: LeagueConfig;
  busy: boolean;
  loading: boolean;
  canSave: boolean;
  setupRequest: number;
  onChange: (draft: LeagueConfig) => void;
  onSave: (draft: LeagueConfig) => Promise<void>;
}
export function LeagueConfigEditor({
  draft,
  busy,
  loading,
  canSave,
  setupRequest,
  onChange,
  onSave,
}: LeagueConfigEditorProps) {
  const [team, setTeam] = useState("");
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (setupRequest && details.current) {
      details.current.open = true;
      details.current.scrollIntoView({ block: "center" });
      details.current.querySelector("input")?.focus({ preventScroll: true });
    }
  }, [setupRequest]);
  return (
    <details ref={details} id="league-config" className="club-league-editor">
      <summary>Configurar equipos y puntuación</summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onSave(draft);
        }}
        className="space-y-5"
      >
        <fieldset disabled={busy} className="contents">
          <p className="club-muted">
            Tu club y sus rivales aparecen automáticamente. Añade el resto de
            participantes. Los cambios se aplican al guardar.
          </p>
          <div className="flex gap-3 flex-wrap">
            <label className="flex-1">
              Nombre del equipo
              <input
                className="input input-bordered"
                maxLength={100}
                value={team}
                onChange={(e) => setTeam(e.target.value)}
              />
            </label>
            <Button
              className="self-end"
              variant="outline"
              disabled={!team.trim() || busy}
              onClick={() => {
                onChange({
                  ...draft,
                  teams: [...draft.teams, team.trim()],
                });
                setTeam("");
              }}
            >
              Añadir equipo
            </Button>
          </div>
          <div className="club-team-chips">
            {draft.teams.map((name, index) => (
              <span key={`${name}-${index}`}>
                {name}
                <button
                  type="button"
                  aria-label={`Quitar ${name} de la lista de participantes`}
                  onClick={() =>
                    onChange({
                      ...draft,
                      teams: draft.teams.filter((_, i) => i !== index),
                    })
                  }
                >
                  <Icon name="close" size={12} />
                </button>
              </span>
            ))}
          </div>
          <div className="club-league-form-grid">
            {(["win", "draw", "loss"] as const).map((key, index) => (
              <label key={key}>
                Puntos por {["victoria", "empate", "derrota"][index]}
                <input
                  className="input input-bordered"
                  required
                  type="number"
                  min={0}
                  max={20}
                  value={draft.rules[key]}
                  onChange={(e) =>
                    onChange({
                      ...draft,
                      rules: {
                        ...draft.rules,
                        [key]: Number(e.target.value),
                      },
                    })
                  }
                />
              </label>
            ))}
            <label>
              Orden de desempate
              <select
                className="select select-bordered"
                value={draft.rules.tiebreak}
                onChange={(e) =>
                  onChange({
                    ...draft,
                    rules: {
                      ...draft.rules,
                      tiebreak: e.target.value as "difference" | "goals",
                    },
                  })
                }
              >
                <option value="difference">
                  Diferencia de gol → Goles a favor
                </option>
                <option value="goals">Goles a favor → Diferencia de gol</option>
              </select>
            </label>
          </div>
          <Button type="submit" loading={busy} disabled={!canSave || loading}>
            Guardar configuración
          </Button>
        </fieldset>
      </form>
    </details>
  );
}
