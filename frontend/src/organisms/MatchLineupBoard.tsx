import type { PitchSlot } from "../types/tactics";
import { useState } from "react";
import type { SquadMember } from "../../../backend/src/domain/squad";
import type { TeamFormat } from "../types/api";
import { useFetch } from "../hooks/useFetch";

import { TacticalBoard } from "./TacticalBoard";
import { PlayerPerformanceDetail } from "./PlayerPerformanceDetail";
import { Spinner } from "../atoms/Spinner";
import { Alert } from "../atoms/Alert";

export function MatchLineupBoard({
  slots,
  format,
  tournamentId,
}: {
  slots: PitchSlot[];
  format: TeamFormat;
  tournamentId?: number | null;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const squad = useFetch<SquadMember[]>(
    selected === null
      ? null
      : `/api/squad${tournamentId ? `?tournamentId=${tournamentId}` : ""}`,
  );
  const member = squad.data?.find((row) => row.playerId === selected);
  return (
    <>
      <TacticalBoard
        slots={slots}
        format={format}
        onPlayerSelect={setSelected}
      />
      <p className="text-xs text-base-content/60 mt-3">
        Selecciona la ficha de un compañero para explorar sus números y últimas
        actuaciones.
      </p>
      {selected !== null && squad.loading && (
        <p className="text-sm my-3">
          <Spinner size="sm" /> Cargando rendimiento…
        </p>
      )}
      {selected !== null && squad.error && (
        <Alert tone="error" onClose={() => setSelected(null)}>
          {squad.error}
        </Alert>
      )}
      {selected !== null && !squad.loading && !squad.error && !member && (
        <p className="text-sm my-3">
          Este integrante ya no está en la plantilla activa de este torneo.
        </p>
      )}
      {member && selected !== null && !squad.loading && (
        <PlayerPerformanceDetail
          member={member}
          base="/jugador"
          close={() => setSelected(null)}
        />
      )}
    </>
  );
}
