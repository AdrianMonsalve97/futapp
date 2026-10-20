import { useEffect, useState } from "react";
import { useFetch } from "./useFetch";
import { api, errorMessage } from "../services/api";
import { upcomingFixtures } from "../utils/upcoming-fixtures";
import { useTrainingDraft } from "./useTrainingDraft";
import type { AiInsights, Match, ModelInfo } from "../types/api";
import type {
  TacticalPlan,
  TacticalStyle,
  CoachingResearch,
  TacticalPlay,
} from "../types/tactics";

export type CoachingSection = "plan" | "plays" | "individual" | "model";
const styleNames = {
  equilibrado: "Equilibrado",
  ofensivo: "Ofensivo",
  defensivo: "Defensivo",
};
export function useCoachingWorkspace() {
  const [mode, setMode] = useState<"training" | "match">("training");
  const [section, setSectionState] = useState<CoachingSection>("plan");
  const collective = section === "plan" || section === "plays";
  const matches = useFetch<Match[]>(collective ? "/api/matches" : null),
    insights = useFetch<AiInsights>(
      section === "model" ? "/api/ai/insights" : null,
    );
  const [targetId, setTargetId] = useState<number | null>(null),
    [style, setStyle] = useState<TacticalStyle | null>(null),
    [formation, setFormation] = useState("");
  const [plan, setPlan] = useState<TacticalPlan | null>(null),
    [loading, setLoading] = useState(false),
    [refresh, setRefresh] = useState(0);
  const [research, setResearch] = useState<CoachingResearch | null>(null),
    [playId, setPlayId] = useState("salida");
  const [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState<string | null>(null),
    [busy, setBusy] = useState<string | null>(null);
  const list = matches.data ?? [];
  const defaultMatch = upcomingFixtures(list).featured;
  const selected = list.find((m) => m.id === (targetId ?? defaultMatch?.id));
  const selectedId = selected?.id;
  const activeStyle =
    style ?? selected?.tournamentRules?.tacticalStyle ?? "equilibrado";
  useEffect(() => {
    if ((!selectedId && mode === "match") || !collective) return;
    let current = true;
    setLoading(true);
    setPlan(null);
    setResearch(null);
    setError(null);
    setNotice(null);
    api<TacticalPlan>(
      mode === "training" ? "/api/ai/training-plan" : "/api/ai/tactical-plan",
      {
        method: "POST",
        json: {
          ...(selectedId ? { matchId: selectedId } : {}),
          style: activeStyle,
          ...(formation ? { formation } : {}),
        },
      },
    )
      .then((data) => {
        if (current) setPlan(data);
      })
      .catch((err) => {
        if (current) setError(errorMessage(err));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [selectedId, activeStyle, formation, refresh, collective, mode]);
  const editable =
    mode === "match" &&
    (selected?.status === "programado" || selected?.status === "pospuesto");
  const apply = async () => {
    if (
      !plan ||
      plan.match.id === null ||
      !editable ||
      busy !== null ||
      plan.match.id !== selectedId ||
      plan.style !== activeStyle ||
      (formation !== "" && plan.recommendation.formation !== formation)
    )
      return;
    setBusy("apply");
    setError(null);
    setNotice(null);
    try {
      if (plan.recommendation.lineup.length !== plan.match.format)
        throw new Error("La alineación no corresponde al formato del partido.");
      await api(`/api/matches/${plan.match.id}/formation`, {
        method: "PUT",
        json: { formation: plan.recommendation.formation },
      });
      await api(`/api/matches/${plan.match.id}/lineup`, {
        method: "PUT",
        json: {
          phaseFormations: plan.recommendation.phaseFormations,
          slots: plan.recommendation.lineup.map((s) => ({
            slotIndex: s.slotIndex,
            playerId: s.playerId,
            x: s.x,
            y: s.y,
            role: s.role,
            label: s.label,
          })),
        },
      });
      setNotice(
        `${plan.match.format} inicial guardado como borrador. Revisa y publica desde el tablero del partido.`,
      );
      matches.reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };
  const lookup = async () => {
    if (!plan || busy !== null) return;
    setBusy("research");
    setError(null);
    const requestedStyle = plan.style;
    try {
      const result = await api<CoachingResearch>("/api/ai/research", {
        method: "POST",
        json: { style: requestedStyle },
      });
      setResearch(result);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };
  const savePlay = async (play: TacticalPlay) => {
    if (
      !plan ||
      plan.match.id === null ||
      !editable ||
      busy !== null ||
      plan.match.id !== selectedId ||
      plan.style !== activeStyle ||
      (formation !== "" && plan.recommendation.formation !== formation)
    )
      return;
    setBusy(play.id);
    setError(null);
    try {
      await api(`/api/matches/${plan.match.id}/strategies`, {
        method: "POST",
        json: {
          title: play.title,
          kind:
            play.id === "transicion"
              ? "transicion"
              : play.phase === "Sin balón"
                ? "defensa"
                : "ataque",
          content: [
            `Fútbol ${plan.match.format} · ${plan.recommendation.formation} · ${plan.match.minutes} min · ${styleNames[plan.style]}`,
            play.objective,
            ...play.steps.map((s, i) => `${i + 1}. ${s}`),
            play.coaching,
            `Referencia: ${play.source.url}`,
          ].join("\n"),
        },
      });
      setNotice(
        "Jugada guardada en las estrategias del partido y disponible para sus jugadores.",
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };
  const train = async () => {
    if (busy !== null) return;
    setBusy("train");
    setError(null);
    try {
      await api<ModelInfo>("/api/ai/model/train", { method: "POST" });
      insights.reload();
      setRefresh((r) => r + 1);
      setNotice("Modelo reentrenado.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };
  const activePlay = plan?.plays.find((p) => p.id === playId) ?? plan?.plays[0];
  const current =
    plan?.match.id === (selectedId ?? null) &&
    plan?.mode === mode &&
    plan?.style === activeStyle &&
    (!formation || plan.recommendation.formation === formation)
      ? plan
      : null;
  const training = useTrainingDraft(current, setPlan);
  return {
    training,
    mode,
    chooseMode: (value: "training" | "match") => {
      if (busy !== null) return;
      setMode(value);
      setFormation("");
      setPlan(null);
    },
    section,
    setSection: (value: CoachingSection) => {
      if (busy !== null) return;
      setSectionState(value);
      setError(null);
      setNotice(null);
    },
    list,
    selected,
    selectedId,
    activeStyle,
    plan: current,
    loading,
    error: error ?? matches.error,
    notice,
    busy,
    editable,
    insights,
    research,
    activePlay,
    setPlayId,
    setFormation,
    apply,
    lookup,
    savePlay,
    train,
    chooseMatch: (id: number) => {
      setTargetId(id);
      setFormation("");
      setStyle(null);
    },
    chooseStyle: (value: TacticalStyle) => {
      setStyle(value);
      setFormation("");
    },
    refresh: () => setRefresh((value) => value + 1),
    matchesLoading: matches.loading,
  };
}
