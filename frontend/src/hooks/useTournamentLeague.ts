import { useEffect, useRef, useState } from "react";
import { useFetch } from "./useFetch";
import { api, errorMessage } from "../services/api";
import type { LeagueConfig, LeagueResult, LeagueView } from "../types/league";

export function useTournamentLeague(tournamentId: number, clubName: string) {
  const league = useFetch<LeagueView>(
    `/api/tournaments/${tournamentId}/standings`,
  );
  const [draft, setDraftState] = useState<LeagueConfig | null>(null);
  const draftRef = useRef<LeagueConfig | null>(null);
  const setDraft = (config: LeagueConfig | null) => {
    draftRef.current = config;
    setDraftState(config);
  };
  const [editor, setEditorState] = useState<LeagueResult | null>(null);
  const [deleting, setDeletingState] = useState<LeagueResult | null>(null);
  const baseline = useRef<LeagueConfig | null>(null);
  const editing = useRef(false);
  const removing = useRef(false);
  const setEditor = (result: LeagueResult | null) => {
    editing.current = result !== null;
    setEditorState(result);
  };
  const setDeleting = (result: LeagueResult | null) => {
    removing.current = result !== null;
    setDeletingState(result);
  };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [teamSetupRequest, setTeamSetupRequest] = useState(0);

  useEffect(() => {
    if (!league.data || editing.current || removing.current) return;
    const incoming = league.data.config;
    if (baseline.current && incoming.version < baseline.current.version) return;
    if (
      draftRef.current &&
      baseline.current &&
      JSON.stringify(draftRef.current) !== JSON.stringify(baseline.current)
    )
      return;
    baseline.current = incoming;
    setDraft(structuredClone(incoming));
  }, [league.data]);
  const dirty =
    !!draft &&
    !!baseline.current &&
    JSON.stringify(draft) !== JSON.stringify(baseline.current);
  useEffect(() => {
    if (dirty || busy || editor || deleting) return;
    const refresh = () => {
      if (document.visibilityState === "visible") league.reload();
    };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [dirty, busy, editor, deleting, league.reload]);

  const save = async (config: LeagueConfig) => {
    setBusy(true);
    setError(null);
    setNotice("");
    try {
      const saved = await api<LeagueView>(
        `/api/tournaments/${tournamentId}/standings`,
        { method: "PUT", json: config },
      );
      baseline.current = saved.config;
      setDraft(structuredClone(saved.config));
      league.reload();
      setNotice("Resultados guardados. La tabla ya está actualizada.");
      setEditor(null);
      setDeleting(null);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };
  const teams = new Map<string, string>();
  for (const name of [
    ...(draft?.teams ?? []),
    ...(league.data?.results ?? []).flatMap((result) => [
      result.home,
      result.away,
    ]),
  ]) {
    const key = name
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLocaleLowerCase("es")
      .replace(/\s+/g, " ")
      .trim();
    if (name !== clubName && !teams.has(key)) teams.set(key, name);
  }
  const participants = [...teams.values()];
  const createResult = () => {
    if (participants.length < 2) {
      setTeamSetupRequest((request) => request + 1);
      setError(
        "Añade al menos dos equipos participantes antes de registrar sus resultados.",
      );
      return;
    }
    setEditor({
      id: crypto.randomUUID(),
      matchday: Math.max(
        1,
        ...(league.data?.results ?? []).map((result) => result.matchday),
      ),
      home: participants[0],
      away: participants[1],
      homeGoals: null,
      awayGoals: null,
      status: "jugado",
    });
  };
  const editResult = (result: LeagueResult) => {
    // The API accepts the editable fields only, never presentation metadata.
    const { id, matchday, home, away, homeGoals, awayGoals, status } = result;
    setError(null);
    setEditor({ id, matchday, home, away, homeGoals, awayGoals, status });
  };
  const saveResult = () => {
    if (draft && editor)
      void save({
        ...draft,
        results: [
          ...draft.results.filter((result) => result.id !== editor.id),
          editor,
        ],
      });
  };
  const deleteResult = () => {
    if (draft && deleting)
      void save({
        ...draft,
        results: draft.results.filter((result) => result.id !== deleting.id),
      });
  };
  const discardChanges = () => {
    if (league.data) {
      baseline.current = league.data.config;
      setDraft(structuredClone(league.data.config));
    }
  };
  const reload = () => {
    baseline.current = null;
    setDraft(null);
    league.reload();
  };
  return {
    league,
    draft,
    setDraft,
    dirty,
    busy,
    error,
    setError,
    notice,
    setNotice,
    editor,
    setEditor,
    deleting,
    setDeleting,
    teamSetupRequest,
    participants,
    createResult,
    editResult,
    saveResult,
    deleteResult,
    discardChanges,
    reload,
    save,
  };
}
