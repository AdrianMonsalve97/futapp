import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { SquadMember } from "../../../backend/src/domain/squad";
import type { Tournament } from "../types/tournament";
import { useFetch } from "./useFetch";

const searchKey = (value: string) =>
  value.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase("es").trim();

export function useSquad() {
  const [params, setParams] = useSearchParams();
  const tournament = params.get("torneo") ?? "";
  const tournaments = useFetch<Tournament[]>("/api/tournaments");
  const squad = useFetch<SquadMember[]>(
    `/api/squad${tournament ? `?tournamentId=${encodeURIComponent(tournament)}` : ""}`,
  );
  const [role, setRole] = useState("TODOS");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("number");
  const [selectedId, select] = useState<number | null>(null);
  const filtered = useMemo(
    () =>
      (squad.data ?? [])
        .filter(
          (player) =>
            (role === "TODOS" ||
              player.position === role ||
              player.secondaryPosition === role) &&
            searchKey(`${player.name} ${player.shirtNumber ?? ""}`).includes(
              searchKey(search),
            ),
        )
        .sort(
          (a, b) =>
            (sort === "rating"
              ? b.stats.avgRating - a.stats.avgRating
              : sort === "goals"
                ? b.stats.goals - a.stats.goals
                : (a.shirtNumber ?? 999) - (b.shirtNumber ?? 999)) ||
            a.name.localeCompare(b.name),
        ),
    [squad.data, role, search, sort],
  );
  return {
    squad,
    tournaments,
    tournament,
    setTournament: (id: string) => {
      setParams(id ? { torneo: id } : {});
      select(null);
    },
    role,
    setRole,
    search,
    setSearch,
    sort,
    setSort,
    filtered,
    select,
    selected: squad.data?.find((row) => row.playerId === selectedId) ?? null,
  };
}
