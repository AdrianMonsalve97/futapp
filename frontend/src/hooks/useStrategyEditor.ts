import { useEffect, useState } from "react";
import { api, errorMessage } from "../services/api";
import type { Strategy, StrategyKind } from "../types/api";

export interface StrategyEditorProps {
  open: boolean;
  onClose: () => void;
  matchId: number;
  strategy: Strategy | null;
  onSaved: () => void;
}
export function useStrategyEditor({
  open,
  onClose,
  matchId,
  strategy,
  onSaved,
}: StrategyEditorProps) {
  const [form, setForm] = useState({
    title: "",
    kind: "general" as StrategyKind,
    content: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      strategy
        ? {
            title: strategy.title,
            kind: strategy.kind,
            content: strategy.content,
          }
        : { title: "", kind: "general", content: "" },
    );
  }, [open, strategy]);

  const submit = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      setError("Título y contenido son obligatorios.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (strategy) {
        await api(`/api/strategies/${strategy.id}`, {
          method: "PUT",
          json: {
            title: form.title.trim(),
            kind: form.kind,
            content: form.content.trim(),
          },
        });
      } else {
        await api(`/api/matches/${matchId}/strategies`, {
          method: "POST",
          json: {
            title: form.title.trim(),
            kind: form.kind,
            content: form.content.trim(),
          },
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return { form, setForm, busy, error, submit };
}
