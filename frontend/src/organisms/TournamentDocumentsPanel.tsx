import { Card, CardBody } from "../atoms/Card";
import { TournamentDocumentCard } from "./TournamentDocumentCard";
import type { Tournament } from "../types/tournament";
export function TournamentDocumentsPanel({
  row,
  admin,
  uploadBusy,
  onUpload,
}: {
  row: Tournament;
  admin: boolean;
  uploadBusy: boolean;
  onUpload: (file?: File) => Promise<void>;
}) {
  return (
    <Card>
      <CardBody className="space-y-3">
        <h3 className="font-bold">Indicaciones y documentos de la liga</h3>
        {row.notes ? (
          <p className="whitespace-pre-wrap text-sm">{row.notes}</p>
        ) : (
          <p className="text-sm text-base-content/50">
            Sin indicaciones adicionales.
          </p>
        )}
        {admin ? (
          <div className="rounded-xl bg-base-200 p-3 space-y-2">
            <label
              className="font-semibold text-sm block"
              htmlFor="league-document"
            >
              Agregar reglamento o información del torneo
            </label>
            <input
              id="league-document"
              type="file"
              className="file-input file-input-bordered file-input-sm w-full"
              disabled={uploadBusy}
              accept=".pdf,.txt,.md,.jpg,.jpeg,.png,.webp"
              onChange={(e) => {
                void onUpload(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <p className="text-xs text-base-content/55">
              PDF, TXT, MD o imagen · hasta 12 MB · PDF hasta 100 páginas.{" "}
              {uploadBusy
                ? "Leyendo y guardando…"
                : "El original y el texto disponible se comparten al publicar."}
            </p>
          </div>
        ) : null}
        {(row.documents ?? []).map((doc) => (
          <TournamentDocumentCard key={doc.id} document={doc} />
        ))}
        {!row.documents?.length ? (
          <p className="text-sm text-base-content/50">
            Todavía no hay documentos.
          </p>
        ) : null}
        <p className="text-xs text-base-content/55">
          La IA usa las reglas confirmadas, las posiciones y el rendimiento. El
          texto del reglamento acompaña el análisis; no modifica las reglas
          automáticamente.
        </p>
      </CardBody>
    </Card>
  );
}
