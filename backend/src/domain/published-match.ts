import type { Match } from "./entities";

/** All player-facing match views share the last published tactical snapshot. */
export function publishedMatch(match: Match): Match {
  return {
    ...match,
    formation: match.publishedFormation ?? match.formation,
    phaseFormations: match.lineupPublishedAt
      ? (match.publishedPhaseFormations ?? null)
      : null,
  };
}
