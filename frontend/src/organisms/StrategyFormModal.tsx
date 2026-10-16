import { useStrategyEditor } from "../hooks/useStrategyEditor";
import { Alert } from "../atoms/Alert";
import { Button } from "../atoms/Button";
import { Input } from "../atoms/Input";
import { Modal } from "../atoms/Modal";
import { Select } from "../atoms/Select";
import { Textarea } from "../atoms/Textarea";
import { FormField } from "../molecules/FormField";
import type { Strategy, StrategyKind } from "../types/api";

export function StrategyFormModal({
  open,
  onClose,
  matchId,
  strategy,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  matchId: number;
  strategy: Strategy | null;
  onSaved: () => void;
}) {
  const { form, setForm, busy, error, submit } = useStrategyEditor({
    open,
    onClose,
    matchId,
    strategy,
    onSaved,
  });

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      closeOnOutside={!busy}
      title={strategy ? "Editar estrategia" : "Nueva estrategia"}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} loading={busy}>
            {strategy ? "Guardar cambios" : "Crear estrategia"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error ? <Alert tone="error">{error}</Alert> : null}
        <FormField label="Título" required>
          <Input
            value={form.title}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, title: event.target.value }))
            }
            placeholder="Presión alta en salida"
          />
        </FormField>
        <FormField label="Tipo">
          <Select
            value={form.kind}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                kind: event.target.value as StrategyKind,
              }))
            }
          >
            <option value="general">General</option>
            <option value="ataque">Ataque</option>
            <option value="defensa">Defensa</option>
            <option value="pelota_parada">Pelota parada</option>
            <option value="transicion">Transición</option>
          </Select>
        </FormField>
        <FormField label="Contenido" required>
          <Textarea
            rows={5}
            value={form.content}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, content: event.target.value }))
            }
            placeholder="Describí la indicación táctica…"
          />
        </FormField>
      </div>
    </Modal>
  );
}
