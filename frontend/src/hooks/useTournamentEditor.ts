import { useState, type FormEvent } from "react";
import { useSettings } from "../context/SettingsContext";
import { api, errorMessage } from "../services/api";
import { formationsFor } from "../data/formations";
import type { Tournament, TournamentRules } from "../types/tournament";

type TournamentInput = Omit<
  Tournament,
  "id" | "updatedAt" | "documents" | "imageUrl"
>;
export interface TournamentEditorProps {
  current: Tournament | null;
  close: () => void;
  saved: (row: Tournament) => void;
}
export function useTournamentEditor({ current, saved }: TournamentEditorProps) {
  const { settings } = useSettings();
  const [form, setForm] = useState<TournamentInput>(() =>
    current
      ? {
          name: current.name,
          leagueName: current.leagueName,
          season: current.season,
          status: current.status,
          rules: current.rules,
          notes: current.notes,
        }
      : {
          name: "",
          leagueName: "",
          season: settings.season,
          status: "borrador",
          notes: "",
          rules: {
            format: settings.format,
            periods: 2,
            minutesPerPeriod: 0,
            breakMinutes: null,
            maxSquad: null,
            maxSubstitutions: null,
            rollingSubstitutions: null,
            allowedFormations: formationsFor(settings.format).map(
              (row) => row.key,
            ),
            tacticalStyle: "equilibrado",
          },
        },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rule = <K extends keyof TournamentRules>(
    key: K,
    value: TournamentRules[K],
  ) => setForm((prev) => ({ ...prev, rules: { ...prev.rules, [key]: value } }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      saved(
        await api<Tournament>(
          current ? `/api/tournaments/${current.id}` : "/api/tournaments",
          { method: current ? "PUT" : "POST", json: form },
        ),
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return { form, setForm, busy, error, rule, submit };
}
