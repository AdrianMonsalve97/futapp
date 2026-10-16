import { upcomingFixtures } from "../utils/upcoming-fixtures";
import { useFetch } from "./useFetch";
import type { Match, MatchDetailResponse } from "../types/api";

export function useSquadFixture(tournamentId: string) {
  const matches = useFetch<Match[]>("/api/matches");
  const next = upcomingFixtures(
    (matches.data ?? []).filter(
      (match) =>
        match.status === "programado" &&
        (!tournamentId || match.tournamentId === Number(tournamentId)),
    ),
  ).featured;
  const detail = useFetch<MatchDetailResponse>(
    next ? `/api/matches/${next.id}` : null,
  );
  return { matches, next, detail };
}
