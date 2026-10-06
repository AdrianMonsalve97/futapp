import { useEffect, useState } from 'react';
import { api, errorMessage } from '../services/api';
import { Alert } from '../atoms/Alert';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Modal } from '../atoms/Modal';
import { Select } from '../atoms/Select';
import { Textarea } from '../atoms/Textarea';
import { FormField } from '../molecules/FormField';
import { Money } from '../molecules/Money';
import { pendingAmount, todayIso } from '../utils/format';
import type { Inscription, PaymentMethod } from '../types/api';

export interface PaymentModalProps {
  /** La modal está abierta cuando hay una inscripción. */
  inscription: Inscription | null;
  onClose: () => void;
  onSaved: (inscription: Inscription) => void;
}

/** Modal de cobro → `POST /api/inscriptions/:id/payments`. */
export function PaymentModal({ inscription, onClose, onSaved }: PaymentModalProps) {
  const pending = inscription ? pendingAmount(inscription.amount, inscription.paid) : 0;
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('efectivo');
  const [reference, setReference] = useState('');
  const [paidAt, setPaidAt] = useState(todayIso());
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (inscription) {
      setAmount(pending > 0 ? String(pending) : '');
      setMethod('efectivo');
      setReference('');
      setPaidAt(todayIso());
      setNotes('');
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inscription]);

  const submit = async () => {
    if (!inscription) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Ingresá un monto mayor a cero.');
      return;
    }
    if (value > pending) {
      setError(`El pago no puede superar el pendiente (${pending}).`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await api<Inscription>(`/api/inscriptions/${inscription.id}/payments`, {
        method: 'POST',
        json: {
          amount: value,
          method,
          reference: reference.trim() || null,
          paidAt,
          notes: notes.trim() || null,
        },
      });
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!inscription) return null;

  return (
    <Modal
      open
      onClose={onClose}
      title={`Registrar pago · ${inscription.playerName ?? `Jugador #${inscription.playerId}`}`}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} loading={busy}>
            Registrar pago
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error ? <Alert tone="error">{error}</Alert> : null}

        <div className="rounded-xl bg-base-200 p-3 grid grid-cols-3 gap-2 text-sm">
          <div>
            <p className="text-xs text-base-content/60">Monto total</p>
            <p className="font-semibold">
              <Money value={inscription.amount} />
            </p>
          </div>
          <div>
            <p className="text-xs text-base-content/60">Pagado</p>
            <p className="font-semibold text-success">
              <Money value={inscription.paid} />
            </p>
          </div>
          <div>
            <p className="text-xs text-base-content/60">Pendiente</p>
            <p className="font-semibold text-warning">
              <Money value={pending} />
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Monto a cobrar" required error={error && !amount ? 'Requerido' : null}>
            <Input
              type="number"
              min={1}
              step={1000}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder={String(pending)}
            />
          </FormField>
          <FormField label="Método de pago" required>
            <Select value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="qr">QR</option>
              <option value="tarjeta">Tarjeta</option>
            </Select>
          </FormField>
          <FormField label="Fecha de pago">
            <Input type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} />
          </FormField>
          <FormField label="Referencia" hint="N° de comprobante (opcional)">
            <Input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="TRX-00123" />
          </FormField>
          <FormField label="Notas" className="sm:col-span-2">
            <Textarea
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Observaciones del cobro…"
            />
          </FormField>
        </div>
      </div>
    </Modal>
  );
}
