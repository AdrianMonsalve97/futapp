import { useEffect, useRef, useState, type SetStateAction } from "react";
import { useFetch } from "./useFetch";
import { useSettings } from "../context/SettingsContext";
import { api, errorMessage } from "../services/api";
import { formationsFor, getFormat } from "../data/formations";
import { todayIso } from "../utils/format";
import type { Tournament } from "../types/tournament";
import type { Match, MatchStatus, TeamFormat } from "../types/api";

interface FormState {
  tournamentId: number | null;
  opponent: string;
  competition: string;
  kickOff: string;
  venue: string;
  venueMapsUrl: string;
  isHome: boolean;
  format: TeamFormat;
  minutes: number;
  formation: string;
  status: MatchStatus;
  goalsFor: string;
  goalsAgainst: string;
  notes: string;
}

/** Estado del formulario: crea con el formato del equipo (§12.7.5) y edita con el del partido. */
function toForm(match: Match | null, teamFormat: TeamFormat): FormState {
  if (!match) {
    const profile = getFormat(teamFormat);
    return {
      tournamentId: null,
      opponent: "",
      competition: "Amistoso",
      kickOff: `${todayIso()}T15:00`,
      venue: "Cancha del club",
      venueMapsUrl: "",
      isHome: true,
      format: teamFormat,
      minutes: profile.matchMinutes,
      formation: profile.defaultFormation,
      status: "programado",
      goalsFor: "",
      goalsAgainst: "",
      notes: "",
    };
  }
  const format = match.format ?? teamFormat;
  const profile = getFormat(format);
  const available = formationsFor(format);
  return {
    tournamentId: match.tournamentId ?? null,
    opponent: match.opponent,
    competition: match.competition,
    kickOff: match.kickOff.slice(0, 16),
    venue: match.venue ?? "",
    venueMapsUrl: match.venueMapsUrl ?? "",
    isHome: match.isHome,
    format,
    minutes: match.minutes ?? profile.matchMinutes,
    formation: available.some((item) => item.key === match.formation)
      ? match.formation
      : profile.defaultFormation,
    status: match.status,
    goalsFor: match.goalsFor !== null ? String(match.goalsFor) : "",
    goalsAgainst: match.goalsAgainst !== null ? String(match.goalsAgainst) : "",
    notes: match.notes ?? "",
  };
}

export interface MatchEditorProps {
  open: boolean;
  onClose: () => void;
  match: Match | null;
  teamFormat: TeamFormat;
  onSaved: () => void;
}
export function useMatchEditor({
  open,
  onClose,
  match,
  teamFormat,
  onSaved,
}: MatchEditorProps) {
  const tournaments = useFetch<Tournament[]>(open ? "/api/tournaments" : null);
  const { settings } = useSettings();
  const [rulesSelected, setRulesSelected] = useState(false);
  const [form, setFormState] = useState<FormState>(() =>
    toForm(match, teamFormat),
  );
  const dirty = useRef(false);
  const setForm = (update: SetStateAction<FormState>) => {
    dirty.current = true;
    setFormState(update);
  };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      dirty.current = false;
      return;
    }
    if (dirty.current) return;
    setRulesSelected(false);
    const next = toForm(match, teamFormat);
    const defaultTournament = !match
      ? (tournaments.data ?? []).find(
          (row) =>
            row.id === settings.defaultTournamentId &&
            row.status === "publicado",
        )
      : null;
    if (defaultTournament) {
      next.tournamentId = defaultTournament.id;
      next.competition = defaultTournament.name;
      next.format = defaultTournament.rules.format;
      next.minutes =
        defaultTournament.rules.periods *
        defaultTournament.rules.minutesPerPeriod;
      next.formation = defaultTournament.rules.allowedFormations[0];
    }
    setFormState(next);
    setError(null);
  }, [open, match, teamFormat, tournaments.data, settings.defaultTournamentId]);

  const submit = async () => {
    if (!form.opponent.trim()) {
      setError("Ingresá el rival.");
      return;
    }
    setBusy(true);
    setError(null);
    const payload = {
      ...(match?.status === "jugado" ||
      (match &&
        (match.tournamentId ?? null) === form.tournamentId &&
        !rulesSelected)
        ? {}
        : { tournamentId: form.tournamentId }),
      opponent: form.opponent.trim(),
      competition: form.competition.trim() || "Amistoso",
      kickOff: form.kickOff,
      venue: form.venue.trim() || null,
      venueMapsUrl: form.venueMapsUrl.trim() || null,
      isHome: form.isHome,
      format: form.format,
      minutes: form.minutes,
      formation: form.formation,
      notes: form.notes.trim() || null,
      status: form.status,
      goalsFor: form.goalsFor === "" ? null : Number(form.goalsFor),
      goalsAgainst: form.goalsAgainst === "" ? null : Number(form.goalsAgainst),
    };
    try {
      if (match) {
        await api(`/api/matches/${match.id}`, { method: "PUT", json: payload });
      } else {
        await api("/api/matches", { method: "POST", json: payload });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return { tournaments, form, setForm, setRulesSelected, busy, error, submit };
}
