import { MatchdayRoster } from "../molecules/MatchdayRoster";
import { formatColombiaDateTime } from "../utils/format";
import {
  useLineupEditor,
  type LineupEditorProps,
} from "../hooks/useLineupEditor";
import { TacticalBoard } from "./TacticalBoard";
import { PlayerAssignmentDialog } from "./PlayerAssignmentDialog";
import { TacticalBalance } from "../molecules/TacticalBalance";
import { Alert } from "../atoms/Alert";
import { Button } from "../atoms/Button";
import { Select } from "../atoms/Select";

export function LineupEditor(props: LineupEditorProps) {
  const state = useLineupEditor(props);
  return (
    <section className="fc-lineup-workspace">
      <div className="fc-lineup-heading">
        <div>
          <p className="sport-eyebrow">MATCH PREPARATION</p>
          <h2>Tu equipo. Tu sistema.</h2>
        </div>
        <span
          className={`badge ${props.publishedAt ? "badge-success" : "badge-warning"}`}
        >
          {props.publishedAt ? "Alineación publicada" : "Borrador sin publicar"}
        </span>
      </div>
      {state.error && (
        <Alert tone="error" onClose={() => state.setError(null)}>
          {state.error}
        </Alert>
      )}
      {state.notice && (
        <Alert tone="info" onClose={() => state.setNotice(null)}>
          {state.notice}
        </Alert>
      )}
      {state.attendanceOnlyUntil && <Alert tone="warning">Excepción de hoy: puedes alinear a los confirmados con arbitraje pendiente hasta {formatColombiaDateTime(state.attendanceOnlyUntil)}. Las deudas y los comprobantes siguen vigentes.</Alert>}
      {state.refereeError && <Alert tone="error">{state.refereeError}</Alert>}
      {state.matchdayRoster && <MatchdayRoster confirmed={state.matchdayRoster} slots={state.slots} />}
      <div className="fc-tactical-workspace">
        <aside className="fc-tactical-console">
          <p className="sport-eyebrow">TU PLAN DE PARTIDO</p>
          <h3>Identidad táctica</h3>
          <label className="fc-console-field">
            Formación
            <Select
              value={state.formationKey}
              disabled={state.busy !== null}
              onChange={(event) =>
                void state.changeFormation(event.target.value)
              }
            >
              {state.formationOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.key}
                </option>
              ))}
            </Select>
          </label>
          <div className="fc-console-facts">
            <span>
              Formato <strong>F{props.format}</strong>
            </span>
            <span>
              En cancha{" "}
              <strong>
                {state.filled}/{state.playersOnPitch}
              </strong>
            </span>
          </div>
          <TacticalBalance slots={state.slots} />
          <div className="fc-console-assistant">
            <p className="sport-eyebrow">ASISTENTE DEL ENTRENADOR</p>
            <Button
              size="sm"
              onClick={() => void state.suggestXi()}
              loading={state.busy === "suggest"}
              disabled={state.busy !== null}
            >
              Proponer {state.playersOnPitch} inicial con IA
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void state.suggestXi(true)}
              disabled={state.busy !== null}
            >
              Comparar sistemas con IA
            </Button>
            <p>
              La propuesta usa rendimiento y disponibilidad; tú decides qué
              equipo publicar.
            </p>
          </div>
          <p className="fc-console-help">
            Elige una ficha para asignar o mover un jugador. {state.attendanceOnlyUntil ? "Hoy se habilita por asistencia confirmada; el punto rojo conserva visible el arbitraje pendiente." : "La convocatoria y el pago aprobado de arbitraje determinan quién puede ser titular."}
          </p>
        </aside>
        <TacticalBoard
          formation={state.formationKey}
          phaseFormations={state.phaseFormations}
          allowedFormations={props.allowedFormations}
          onPhaseFormationChange={state.changePhaseFormation}
          phaseEditingDisabled={state.busy !== null}
          slots={state.slots}
          format={props.format}
          selectedSlotIndex={state.pendingSlot?.slotIndex}
          onSlotSelect={state.busy === null ? state.openSlot : undefined}
        />
      </div>
      {state.attendance.error && (
        <Alert tone="error">
          {state.attendance.error}{" "}
          <button className="link" onClick={state.attendance.reload}>
            Actualizar convocatoria
          </button>
        </Alert>
      )}
      {state.bench.length > 0 && (
        <div className="fc-bench">
          <strong>Suplentes sugeridos</strong>
          {state.bench.map((player) => (
            <span key={player.playerId}>
              {player.playerName} <small>{player.position}</small>
            </span>
          ))}
        </div>
      )}
      <div className="fc-lineup-savebar">
        <p>
          <strong>
            {state.filled === state.playersOnPitch
              ? "Equipo completo"
              : "Completa el inicial"}
          </strong>
          <span>
            El equipo verá los cambios cuando publiques la alineación.
          </span>
        </p>
        <div>
          <Button
            variant="outline"
            onClick={() => void state.save()}
            loading={state.busy === "save"}
            disabled={state.busy !== null}
          >
            Guardar borrador
          </Button>
          <Button
            onClick={() => void state.save(true)}
            loading={state.busy === "publish"}
            disabled={
              state.filled !== state.playersOnPitch || state.busy !== null
            }
          >
            Publicar {state.playersOnPitch} inicial →
          </Button>
        </div>
      </div>
      {state.pendingSlot && (
        <PlayerAssignmentDialog
          slot={state.pendingSlot}
          players={state.sortedPlayers}
          slots={state.slots}
          selectedId={state.selectedPlayerId}
          onSelect={state.setSelectedPlayerId}
          onClose={() => state.setPendingSlot(null)}
          onAssign={state.assignPlayer}
          loading={state.attendance.loading}
        />
      )}
    </section>
  );
}
