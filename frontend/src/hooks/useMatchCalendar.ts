import { useState } from "react";
import { useFetch } from "./useFetch";
import { api, errorMessage } from "../services/api";
import type { Match } from "../types/api";

export function useMatchCalendar() {
  const { data, loading, error, reload } = useFetch<Match[]>("/api/matches");
  const [view, setView] = useState<"upcoming" | "played" | "archive">(
    "upcoming",
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Match | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const remove = async (match: Match) => {
    setActionError(null);
    try {
      await api(`/api/matches/${match.id}`, { method: "DELETE" });
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  const matches = data ?? [];
  const upcoming = matches.filter(
    (item) => item.status === "programado" || item.status === "pospuesto",
  );
  const played = matches.filter((item) => item.status === "jugado");
  const archive = matches.filter((item) => item.status === "cancelado");

  return {
    loading,
    error,
    reload,
    view,
    setView,
    modalOpen,
    editing,
    actionError,
    upcoming,
    played,
    archive,
    remove,
    clearError: () => setActionError(null),
    create: () => {
      setEditing(null);
      setModalOpen(true);
    },
    edit: (match: Match) => {
      setEditing(match);
      setModalOpen(true);
    },
    close: () => setModalOpen(false),
  };
}
