import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { assignLineupSlot } from "../utils/lineup-slots";
import { buildPlays } from "../../../backend/src/domain/coaching";
import type { PitchSlot, TacticalPlan } from "../types/tactics";

/** Private rehearsal edits are kept in memory and shared with the play replay. */
export function useTrainingDraft(
  plan: TacticalPlan | null,
  setPlan: Dispatch<SetStateAction<TacticalPlan | null>>,
) {
  const [slot, setSlot] = useState<PitchSlot | null>(null);
  const [playerId, setPlayerId] = useState("");
  useEffect(() => {
    setSlot(null);
  }, [plan?.mode, plan?.match.id, plan?.recommendation.formation]);
  const open = (position: PitchSlot) => {
    if (plan?.mode !== "training") return;
    setSlot(position);
    setPlayerId(position.playerId == null ? "" : String(position.playerId));
  };
  const assign = () => {
    if (!slot || plan?.mode !== "training") return;
    const player = plan.roster?.find(
      (row) => String(row.playerId) === playerId,
    );
    if (playerId && !player) return;
    if (
      slot.role === "POR" &&
      player &&
      player.position !== "POR" &&
      player.secondaryPosition !== "POR"
    )
      return;
    const lineup = assignLineupSlot(
      plan.recommendation.lineup,
      slot.slotIndex,
      player
        ? {
            playerId: player.playerId,
            playerName: player.name,
            avatarUrl: player.avatarUrl,
            shirtNumber: player.shirtNumber,
            playerPosition: player.position,
          }
        : null,
    );
    setPlan({
      ...plan,
      recommendation: { ...plan.recommendation, lineup },
      plays: buildPlays(lineup, plan.style),
    });
    setSlot(null);
  };
  const players = (plan?.roster ?? [])
    .filter(
      (row) =>
        slot?.role !== "POR" ||
        row.position === "POR" ||
        row.secondaryPosition === "POR",
    )
    .map((row) => ({
      user: { fullName: row.name, avatarUrl: row.avatarUrl },
      player: {
        id: row.playerId,
        shirtNumber: row.shirtNumber,
        position: row.position,
      },
    }));
  return {
    slot,
    playerId,
    setPlayerId,
    open,
    assign,
    players,
    close: () => setSlot(null),
    setPhase: (phase: "ataque" | "repliegue", formation: string) => {
      if (plan?.mode === "training")
        setPlan({
          ...plan,
          recommendation: {
            ...plan.recommendation,
            phaseFormations: {
              ...plan.recommendation.phaseFormations,
              [phase]: formation,
            },
          },
        });
    },
  };
}
