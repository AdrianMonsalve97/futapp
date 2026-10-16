import { useEffect, useState } from "react";
import { api, errorMessage } from "../services/api";
import { formationsFor, getFormat } from "../data/formations";
import type { Match, MatchStatus } from "../types/api";

export interface MatchForm {
  opponent: string;
  competition: string;
  kickOff: string;
  venue: string;
  venueMapsUrl: string;
  isHome: boolean;
  formation: string;
  status: MatchStatus;
  goalsFor: string;
  goalsAgainst: string;
  notes: string;
}

function toForm(match: Match): MatchForm {
  const profile = getFormat(match.format);
  const available = formationsFor(match.format);
  return {
    opponent: match.opponent,
    competition: match.competition,
    kickOff: match.kickOff.slice(0, 16),
    venue: match.venue ?? "",
    venueMapsUrl: match.venueMapsUrl ?? "",
    isHome: match.isHome,
    formation: available.some((item) => item.key === match.formation)
      ? match.formation
      : profile.defaultFormation,
    status: match.status,
    goalsFor: match.goalsFor !== null ? String(match.goalsFor) : "",
    goalsAgainst: match.goalsAgainst !== null ? String(match.goalsAgainst) : "",
    notes: match.notes ?? "",
  };
}

export function useMatchDataForm(match: Match, onSaved: () => void) {
  const matchId = match.id,
    matchMinutes = match.minutes;
  const [form, setForm] = useState<MatchForm>(() => toForm(match));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  useEffect(() => {
    setForm(toForm(match));
  }, [match]);
  /** Actualiza un campo del formulario (sin mezclar estados mientras carga). */
  const updateForm = <K extends keyof MatchForm>(
    key: K,
    value: MatchForm[K],
  ) => {
    setForm((prev) => {
      if (!prev) return prev;
      const next: MatchForm = { ...prev };
      next[key] = value;
      return next;
    });
  };

  const saveMatchData = async () => {
    if (!form || !match) return;
    if (!form.opponent.trim()) {
      setActionError("El rival es obligatorio.");
      return;
    }
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      await api(`/api/matches/${matchId}`, {
        method: "PUT",
        json: {
          opponent: form.opponent.trim(),
          competition: form.competition.trim() || "Amistoso",
          kickOff: form.kickOff,
          venue: form.venue.trim() || null,
          venueMapsUrl: form.venueMapsUrl.trim() || null,
          isHome: form.isHome,
          formation: form.formation,
          /** §12.4 — el formato viaja siempre; la duración es derivada del formato. */
          format: match.format,
          minutes: matchMinutes,
          notes: form.notes.trim() || null,
          status: form.status,
          goalsFor: form.goalsFor === "" ? null : Number(form.goalsFor),
          goalsAgainst:
            form.goalsAgainst === "" ? null : Number(form.goalsAgainst),
        },
      });
      setNotice(
        form.status === "jugado" &&
          form.goalsFor !== "" &&
          form.goalsAgainst !== "" &&
          match.tournamentId
          ? "Resultado guardado. La tabla de posiciones del torneo ya está actualizada."
          : "Datos del partido guardados.",
      );
      onSaved();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return { form, updateForm, saveMatchData, busy, notice, actionError };
}
