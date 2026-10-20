import { useState } from "react";
import { api, errorMessage } from "../services/api";
import type { Match } from "../types/api";

export function useMatchResult(match: Match, onSaved: () => void) {
  const [goalsFor, setGoalsFor] = useState(
    match.goalsFor === null ? "" : String(match.goalsFor),
  );
  const [goalsAgainst, setGoalsAgainst] = useState(
    match.goalsAgainst === null ? "" : String(match.goalsAgainst),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (busy) return;
    if (![goalsFor, goalsAgainst].every((value) => /^\d{1,2}$/.test(value))) {
      setError("Completa ambos marcadores, entre 0 y 99 goles.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/api/matches/${match.id}`, {
        method: "PUT",
        json: {
          status: "jugado",
          goalsFor: Number(goalsFor),
          goalsAgainst: Number(goalsAgainst),
        },
      });
      onSaved();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };
  return {
    goalsFor,
    setGoalsFor,
    goalsAgainst,
    setGoalsAgainst,
    busy,
    error,
    submit,
  };
}
