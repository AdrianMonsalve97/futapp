import type { LineupSlot } from "./entities";
import { formationsFor, type FormationDef } from "./formations";
import type { FormatProfile } from "./formats";
import { selectXi, round2, type XiCandidate } from "./model/performance-model";
import { buildPlays } from "./coaching";
import {
  resolvePhaseFormations,
  type PhaseFormations,
} from "./tactical-phases";
import type { TacticalPlan, TacticalStyle } from "./tactics";
import { ValidationError } from "./errors";

export function selectedLineup(
  formation: FormationDef,
  candidates: XiCandidate[],
) {
  const selection = selectXi(formation, candidates);
  const byId = new Map(candidates.map((row) => [row.playerId, row]));
  const lineup: LineupSlot[] = formation.slots.map((slot) => {
    const assignment = selection.assignments.find(
      (row) => row.slotIndex === slot.slotIndex,
    );
    const candidate =
      assignment?.playerId == null ? undefined : byId.get(assignment.playerId);
    return {
      ...slot,
      playerId: candidate?.playerId ?? null,
      playerName: candidate?.playerName ?? null,
      avatarUrl: candidate?.avatarUrl ?? null,
      shirtNumber: candidate?.shirtNumber ?? null,
      playerPosition: candidate?.position ?? null,
    };
  });
  const assigned = lineup.flatMap((slot) =>
    slot.playerId == null ? [] : [byId.get(slot.playerId)!],
  );
  return {
    lineup,
    score: selection.totalScore,
    avgRating: round2(
      assigned.length
        ? assigned.reduce((total, row) => total + row.predictedRating, 0) /
            assigned.length
        : 0,
    ),
  };
}

/** A private practice session has no attendance, enrolment or financial eligibility. */
export function buildTrainingPlan(
  profile: FormatProfile,
  candidates: XiCandidate[],
  options: {
    reference?: {
      id: number;
      opponent: string;
      minutes: number;
      formation: string;
      phaseFormations?: PhaseFormations | null;
    };
    formation?: string;
    style: TacticalStyle;
  },
): TacticalPlan {
  const { reference, style } = options;
  const definitions = formationsFor(profile.format);
  if (
    options.formation &&
    !definitions.some((row) => row.key === options.formation)
  )
    throw new ValidationError(
      "La formación no corresponde al formato del ensayo",
    );
  const pool = candidates.map((row) => ({ ...row, selectionPriority: 0 }));
  const formations = definitions.map((definition) => {
    const selected = selectedLineup(definition, pool);
    return {
      key: definition.key,
      score: round2(selected.score),
      avgRating: selected.avgRating,
      filled: selected.lineup.filter((slot) => slot.playerId !== null).length,
      naturalFit: selected.lineup.filter(
        (slot) => slot.playerId !== null && slot.role === slot.playerPosition,
      ).length,
      slots: selected.lineup,
    };
  });
  const key =
    options.formation ?? reference?.formation ?? profile.defaultFormation;
  const selected = formations.find((row) => row.key === key)!;
  const assigned = new Set(selected.slots.map((slot) => slot.playerId));
  const bench = pool
    .filter((row) => !assigned.has(row.playerId))
    .map(({ selectionPriority: _priority, ...candidate }) => candidate);
  return {
    mode: "training",
    roster: pool.map((row) => ({
      playerId: row.playerId,
      name: row.playerName,
      position: row.position,
      secondaryPosition: row.secondaryPosition ?? null,
      avatarUrl: row.avatarUrl ?? null,
      shirtNumber: row.shirtNumber ?? null,
    })),
    match: {
      id: reference?.id ?? null,
      opponent: reference?.opponent ?? null,
      format: profile.format,
      minutes: reference?.minutes ?? profile.matchMinutes,
    },
    style,
    recommendation: {
      formation: key,
      lineup: selected.slots,
      bench,
      phaseFormations: resolvePhaseFormations(
        key,
        profile.format,
        reference?.phaseFormations,
      ),
      explanation:
        "Ensayo con todo el plantel activo, sin exigir asistencia, inscripción al torneo ni arbitraje. La propuesta usa posiciones y rendimiento registrado; no modifica la convocatoria ni la alineación oficial.",
    },
    formations,
    positions: (["POR", "DEF", "MED", "DEL"] as const).map((role) => {
      const available = pool.filter(
        (row) => row.position === role || row.secondaryPosition === role,
      );
      return {
        role,
        available: available.length,
        primary: available.filter((row) => row.position === role).length,
        needed: selected.slots.filter((row) => row.role === role).length,
        avgRating: round2(
          available.length
            ? available.reduce((total, row) => total + row.predictedRating, 0) /
                available.length
            : 0,
        ),
      };
    }),
    plays: buildPlays(selected.slots, style),
    rotation:
      "Prueba relevos y asociaciones con el plantel completo. La convocatoria oficial se revisa en la sala del partido.",
    methodology:
      "Ensayo táctico por posiciones. Los movimientos son esquemas de entrenamiento, no seguimiento de un partido real.",
  };
}
