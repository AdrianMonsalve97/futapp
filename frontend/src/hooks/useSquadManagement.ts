import { useMemo, useState } from "react";
import { useFetch } from "./useFetch";
import { api, errorMessage } from "../services/api";
import type { PlayerListItem } from "../types/api";

export function useSquadManagement() {
  const { data, loading, error, reload } =
    useFetch<PlayerListItem[]>("/api/players");
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PlayerListItem | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<number | null>(null);
  const [reactivatingId, setReactivatingId] = useState<number | null>(null);
  const pending = (data ?? []).filter((item) => item.pendingApproval);

  const filtered = useMemo(() => {
    const items = (data ?? []).filter((item) => !item.pendingApproval);
    const term = query.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => {
      const haystack = [
        item.user.fullName,
        item.user.email,
        String(item.player.shirtNumber ?? ""),
        item.player.position,
        item.player.dni ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [data, query]);

  const deletePlayer = async (item: PlayerListItem) => {
    setActionError(null);
    setActionNotice(null);
    try {
      const result = await api<{ ok: true; filesPending: boolean }>(
        `/api/players/${item.player.id}`,
        {
          method: "DELETE",
        },
      );
      setActionNotice(
        result.filesPending
          ? "Jugador eliminado. La limpieza de algunos archivos privados sigue pendiente y se reintentará automáticamente."
          : "Jugador eliminado junto con sus datos vinculados.",
      );
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  const reactivate = async (item: PlayerListItem) => {
    if (item.user.active || item.pendingApproval || reactivatingId !== null)
      return;
    setReactivatingId(item.player.id);
    setActionError(null);
    setActionNotice(null);
    try {
      await api(`/api/players/${item.player.id}`, {
        method: "PUT",
        json: { active: true },
      });
      setActionNotice(
        "Jugador reactivado. Conserva sus datos y puede volver a iniciar sesión con su contraseña.",
      );
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setReactivatingId(null);
    }
  };

  const approve = async (item: PlayerListItem) => {
    if (reviewing !== null) return;
    setReviewing(item.player.id);
    setActionError(null);
    setActionNotice(null);
    try {
      await api(`/api/players/${item.player.id}/approval`, {
        method: "POST",
        json: {},
      });
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setReviewing(null);
    }
  };

  return {
    total: (data ?? []).filter((item) => !item.pendingApproval).length,
    loading,
    error,
    reload,
    query,
    setQuery,
    pending,
    filtered,
    modalOpen,
    editing,
    actionError,
    actionNotice,
    reviewing,
    reactivatingId,
    dismissError: () => setActionError(null),
    dismissNotice: () => setActionNotice(null),
    createPlayer: () => {
      setEditing(null);
      setModalOpen(true);
    },
    editPlayer: (item: PlayerListItem) => {
      setEditing(item);
      setModalOpen(true);
    },
    closeEditor: () => setModalOpen(false),
    deletePlayer,
    reactivate,
    approve,
  };
}
