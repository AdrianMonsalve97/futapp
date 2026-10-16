import { useState } from "react";
import { apiBlob, errorMessage } from "../services/api";
import { Alert } from "../atoms/Alert";
import { Button } from "../atoms/Button";
import type { TournamentDocument } from "../types/tournament";

export function TournamentDocumentCard({
  document,
}: {
  document: TournamentDocument;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      const blob = await apiBlob("/api/media/" + document.assetId);
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = document.fileName;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rounded-xl border border-base-300 p-4 space-y-2">
      <div className="flex flex-wrap gap-2 justify-between items-center">
        <div>
          <p className="font-bold">{document.title}</p>
          <p className="text-xs text-base-content/55">{document.fileName}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          loading={busy}
          onClick={() => void download()}
        >
          Descargar original
        </Button>
      </div>
      {document.extractionStatus === "extraido" ? (
        <details>
          <summary className="cursor-pointer text-sm text-primary">
            Leer texto del documento
          </summary>
          <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap font-sans text-sm">
            {document.extractedText}
          </pre>
        </details>
      ) : (
        <p className="text-sm text-warning">
          Este archivo no tiene texto extraíble. Consulta el original y registra
          sus reglas e indicaciones en el torneo.
        </p>
      )}
      {error ? <Alert tone="error">{error}</Alert> : null}
    </div>
  );
}
