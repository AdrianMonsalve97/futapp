import { Modal } from "../atoms/Modal";
import { Input } from "../atoms/Input";
import { Button } from "../atoms/Button";
import { Alert } from "../atoms/Alert";
import { FormField } from "../molecules/FormField";
import { ClubLogo } from "../atoms/ClubLogo";
import { useSettings } from "../context/SettingsContext";
import { useMatchResult } from "../hooks/useMatchResult";
import type { Match } from "../types/api";

export function MatchResultDialog({
  match,
  onClose,
  onSaved,
}: {
  match: Match;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { settings } = useSettings();
  const state = useMatchResult(match, onSaved);
  return (
    <Modal
      open
      title={
        match.status === "jugado" ? "Corregir resultado" : "Finalizar partido"
      }
      onClose={() => {
        if (!state.busy) onClose();
      }}
      closeOnOutside={!state.busy}
      footer={
        <>
          <Button variant="ghost" disabled={state.busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button loading={state.busy} onClick={() => void state.submit()}>
            Confirmar resultado
          </Button>
        </>
      }
    >
      <div className="match-result-dialog">
        <ClubLogo className="w-16 h-16 mx-auto" />
        <p className="sport-eyebrow">EL MARCADOR CUENTA NUESTRA HISTORIA</p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void state.submit();
          }}
        >
          <fieldset disabled={state.busy} className="grid grid-cols-2 gap-4">
            <FormField label={settings.teamName}>
              <Input
                aria-label="Goles de nuestro equipo"
                type="number"
                min={0}
                max={99}
                required
                value={state.goalsFor}
                onChange={(event) => state.setGoalsFor(event.target.value)}
                autoFocus
              />
            </FormField>
            <FormField label={match.opponent}>
              <Input
                aria-label="Goles del rival"
                type="number"
                min={0}
                max={99}
                required
                value={state.goalsAgainst}
                onChange={(event) => state.setGoalsAgainst(event.target.value)}
              />
            </FormField>
          </fieldset>
          <button
            type="submit"
            className="sr-only"
            disabled={state.busy}
            tabIndex={-1}
          >
            Confirmar resultado
          </button>
        </form>
        {state.error && <Alert tone="error">{state.error}</Alert>}
        <p>
          Al confirmar, el encuentro quedará finalizado y{" "}
          {match.tournamentId
            ? "la clasificación del torneo recalculará puntos, goles y diferencia."
            : "aparecerá en los resultados del equipo. Es un partido sin torneo asociado."}
        </p>
        {match.status !== "jugado" && (
          <p className="text-xs text-base-content/60">
            Se cerrará también el reparto de arbitraje y se conservarán los
            saldos y comprobantes.
          </p>
        )}
      </div>
    </Modal>
  );
}
