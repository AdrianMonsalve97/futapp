import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { useFetch } from "./useFetch";
import { errorMessage, uploadFile } from "../services/api";
import type { Tournament } from "../types/tournament";
export function useTournamentWorkspace() {
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const admin = user?.role === "admin";
  const base = `/${admin ? "admin" : "jugador"}/torneos`;
  const list = useFetch<Tournament[]>("/api/tournaments");
  const detail = useFetch<Tournament>(id ? `/api/tournaments/${id}` : null);
  const [section, setSection] = useState<"rules" | "roster" | "photo">("rules");
  const [editor, setEditor] = useState<{ current: Tournament | null } | null>(
    null,
  );
  const [uploadBusy, setUploadBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { settings, save, reload: reloadSettings } = useSettings();
  useEffect(() => {
    setError(null);
    setSection("rules");
  }, [id]);
  const row = detail.data;
  const upload = async (file?: File) => {
    if (!file || !row) return;
    setUploadBusy(true);
    setError(null);
    try {
      if (file.size > 12 * 1024 * 1024)
        throw new Error("El documento debe pesar hasta 12 MB");
      await uploadFile(`/api/tournaments/${row.id}/documents`, file);
      detail.reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploadBusy(false);
    }
  };
  const makeDefault = async () => {
    if (!row) return;
    setError(null);
    try {
      await save({
        defaultTournamentId:
          settings.defaultTournamentId === row.id ? null : row.id,
      });
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  const saveEditor = (saved: Tournament) => {
    setEditor(null);
    list.reload();
    detail.reload();
    reloadSettings();
    navigate(`${base}/${saved.id}`);
  };
  return {
    id,
    admin,
    base,
    list,
    detail,
    row,
    editor,
    setEditor,
    section,
    setSection,
    uploadBusy,
    error,
    settings,
    upload,
    makeDefault,
    saveEditor,
  };
}
