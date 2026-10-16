import { Alert } from "../atoms/Alert";
import { Button } from "../atoms/Button";
import { Modal } from "../atoms/Modal";
import type { LeagueResult } from "../types/league";

interface LeagueRemovalDialogProps {
  result: LeagueResult;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}
export function LeagueRemovalDialog({
  result,
  busy,
  error,
  onClose,
  onConfirm,
}: LeagueRemovalDialogProps) {
  return (
    <Modal
      open
      title="Eliminar resultado"
      onClose={onClose}
      size="sm"
      closeOnOutside={!busy}
    >
      <p className="text-sm leading-7">
        Se eliminará {result.home} vs {result.away} de la jornada{" "}
        {result.matchday}. La clasificación se recalculará.
      </p>
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex justify-end gap-3 mt-6">
        <Button disabled={busy} variant="ghost" onClick={onClose}>
          Conservar
        </Button>
        <Button loading={busy} variant="danger" onClick={onConfirm}>
          Eliminar resultado
        </Button>
      </div>
    </Modal>
  );
}
