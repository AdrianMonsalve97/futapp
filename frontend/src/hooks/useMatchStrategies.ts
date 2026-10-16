import { useState } from "react";
import { api, errorMessage } from "../services/api";
import type { Strategy } from "../types/api";

export function useMatchStrategies(onChanged: () => void) {
  const [editor, setEditor] = useState<{ strategy: Strategy | null } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const remove = async (strategy: Strategy) => {
    setError(null);
    try {
      await api(`/api/strategies/${strategy.id}`, { method: "DELETE" });
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  return { editor, setEditor, error, remove };
}
