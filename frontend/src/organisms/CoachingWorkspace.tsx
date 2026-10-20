import { lazy, Suspense } from "react";
import { useCoachingWorkspace } from "../hooks/useCoachingWorkspace";
import { SectionNavigation } from "../molecules/SectionNavigation";
import { FormField } from "../molecules/FormField";
import { Select } from "../atoms/Select";
import { Button } from "../atoms/Button";
import { Alert } from "../atoms/Alert";
import { Spinner } from "../atoms/Spinner";
import { formatKickoffDate } from "../utils/match-clock";
import type { TacticalStyle } from "../types/tactics";
import { CoachingPlanPanel } from "./CoachingPlanPanel";
import { PlayerAssignmentDialog } from "./PlayerAssignmentDialog";
const CoachingPlaysPanel = lazy(() =>
  import("./CoachingPlaysPanel").then((module) => ({
    default: module.CoachingPlaysPanel,
  })),
);
const CoachingModelPanel = lazy(() =>
  import("./CoachingModelPanel").then((module) => ({
    default: module.CoachingModelPanel,
  })),
);
const AdminPlayerPreparation = lazy(() =>
  import("./AdminPlayerPreparation").then((module) => ({
    default: module.AdminPlayerPreparation,
  })),
);

export function CoachingWorkspace() {
  const state = useCoachingWorkspace();
  const collective = state.section === "plan" || state.section === "plays";
  return (
    <div className="space-y-5">
      <SectionNavigation
        label="Tarea de dirección deportiva"
        value={state.section}
        onChange={state.setSection}
        disabled={state.busy !== null}
        items={[
          { key: "plan", label: "Plan del equipo" },
          { key: "plays", label: "Jugadas" },
          { key: "individual", label: "Enfoque individual" },
          { key: "model", label: "Modelo y datos" },
        ]}
      />
      {collective && (
        <SectionNavigation
          label="Contexto del tablero"
          value={state.mode}
          onChange={state.chooseMode}
          disabled={state.busy !== null}
          items={[
            { key: "training", label: "Ensayo libre · todo el plantel" },
            { key: "match", label: "Convocatoria oficial" },
          ]}
        />
      )}
      {collective && (
        <div className="rounded-xl border border-base-300 bg-base-100 p-4 sm:p-5 grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] items-end">
          <FormField
            label={
              state.mode === "training" ? "Formato de referencia" : "Partido"
            }
          >
            <Select
              value={state.selectedId ?? (state.mode === "training" ? "0" : "")}
              disabled={state.busy !== null || state.matchesLoading}
              onChange={(event) =>
                state.chooseMatch(Number(event.target.value))
              }
            >
              {state.mode === "training" && (
                <option value="0">Entrenamiento del club · sin partido</option>
              )}
              <option value="" disabled>
                {state.matchesLoading
                  ? "Cargando calendario…"
                  : "Selecciona un partido"}
              </option>
              {state.list.map((match) => (
                <option key={match.id} value={match.id}>
                  {formatKickoffDate(match.kickOff)} · {match.opponent} · F
                  {match.format}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Estilo de juego">
            <Select
              value={state.activeStyle}
              disabled={state.busy !== null}
              onChange={(event) =>
                state.chooseStyle(event.target.value as TacticalStyle)
              }
            >
              <option value="equilibrado">Equilibrado</option>
              <option value="ofensivo">Ofensivo</option>
              <option value="defensivo">Defensivo</option>
            </Select>
          </FormField>
          <Button
            variant="outline"
            onClick={state.refresh}
            disabled={
              (state.mode === "match" && !state.selected) ||
              state.loading ||
              state.busy !== null
            }
          >
            Recalcular propuesta
          </Button>
        </div>
      )}
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.notice && <Alert tone="success">{state.notice}</Alert>}
      {collective && (state.loading || state.matchesLoading) && (
        <div className="py-10 text-center">
          <Spinner />
        </div>
      )}
      {collective &&
        state.mode === "match" &&
        !state.matchesLoading &&
        !state.selected && (
          <Alert tone="info">
            Programa un encuentro para preparar el plan colectivo. El enfoque
            individual está disponible aunque todavía no haya partido.
          </Alert>
        )}
      <Suspense
        fallback={
          <div className="py-10 text-center">
            <Spinner />
          </div>
        }
      >
        {state.section === "plan" && state.plan && (
          <CoachingPlanPanel
            plan={state.plan}
            busy={state.busy}
            editable={state.editable}
            onApply={state.apply}
            onFormation={state.setFormation}
            onSlotSelect={
              state.mode === "training" ? state.training.open : undefined
            }
            onPhaseFormationChange={
              state.mode === "training" ? state.training.setPhase : undefined
            }
          />
        )}
        {state.section === "plays" && state.plan && (
          <CoachingPlaysPanel
            plan={state.plan}
            activePlay={state.activePlay}
            research={state.research}
            busy={state.busy}
            editable={state.editable}
            onSelect={state.setPlayId}
            onResearch={state.lookup}
            onSave={state.savePlay}
          />
        )}
        {state.section === "individual" && <AdminPlayerPreparation />}
        {state.section === "model" && (
          <>
            {state.insights.loading ? (
              <div className="py-10 text-center">
                <Spinner />
              </div>
            ) : state.insights.error ? (
              <Alert tone="error" onClose={state.insights.reload}>
                {state.insights.error}
              </Alert>
            ) : (
              state.insights.data && (
                <CoachingModelPanel
                  insights={state.insights.data}
                  busy={state.busy}
                  onTrain={state.train}
                />
              )
            )}
          </>
        )}
      </Suspense>
      {state.mode === "training" && state.plan && state.training.slot && (
        <PlayerAssignmentDialog
          training
          slot={state.training.slot}
          slots={state.plan.recommendation.lineup}
          players={state.training.players}
          selectedId={state.training.playerId}
          onSelect={state.training.setPlayerId}
          onAssign={state.training.assign}
          onClose={state.training.close}
          loading={false}
        />
      )}
    </div>
  );
}
