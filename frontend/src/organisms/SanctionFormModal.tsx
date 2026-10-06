import { useEffect, useState } from 'react';
import { api, errorMessage } from '../services/api';
import { Alert } from '../atoms/Alert';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Modal } from '../atoms/Modal';
import { Select } from '../atoms/Select';
import { Textarea } from '../atoms/Textarea';
import { FormField } from '../molecules/FormField';
import type {
  Match,
  PlayerListItem,
  Sanction,
  SanctionResponse,
  SanctionType,
} from '../types/api';

export interface SanctionFormModalProps {
  open: boolean;
  onClose: () => void;
  /** `null` = crear; con sanción = editar. */
  sanction: Sanction | null;
  players: PlayerListItem[];
  matches: Match[];
  onSaved: () => void;
}

interface FormState {
  playerId: string;
  type: SanctionType;
  reason: string;
  amount: string;
  points: string;
  matchId: string;
  matchDate: string;
}

const EMPTY: FormState = {
  playerId: '',
  type: 'tarjeta_amarilla',
  reason: '',
  amount: '0',
  points: '0',
  matchId: '',
  matchDate: '',
};

/** Modal de alta/edición de sanciones (`POST/PUT /api/sanctions`). */
export function SanctionFormModal({ open, onClose, sanction, players, matches, onSaved }: SanctionFormModalProps) {
  const [form, setForm] = useState<FormState>({ ...EMPTY });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (sanction) {
      setForm({
        playerId: String(sanction.playerId),
        type: sanction.type,
        reason: sanction.reason,
        amount: String(sanction.amount),
        points: String(sanction.points),
        matchId: sanction.matchId !== null ? String(sanction.matchId) : '',
        matchDate: sanction.matchDate ?? '',
      });
    } else {
      setForm({ ...EMPTY, playerId: players[0] ? String(players[0].player.id) : '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sanction]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => {
      const next = { ...prev };
      next[key] = value;
      return next;
    });

  const submit = async () => {
    if (!form.playerId) {
      setError('Seleccioná un jugador.');
      return;
    }
    if (!form.reason.trim()) {
      setError('El motivo es obligatorio.');
      return;
    }
    const amount = Number(form.amount) || 0;
    const points = Number(form.points) || 0;

    setBusy(true);
    setError(null);
    try {
      const payload = {
        playerId: Number(form.playerId),
        type: form.type,
        reason: form.reason.trim(),
        amount,
        points,
        matchId: form.matchId ? Number(form.matchId) : null,
        matchDate: form.matchDate || null,
      };
      if (sanction) {
        await api<SanctionResponse>(`/api/sanctions/${sanction.id}`, {
          method: 'PUT',
          json: {
            reason: payload.reason,
            amount: payload.amount,
            points: payload.points,
          },
        });
      } else {
        await api<SanctionResponse>('/api/sanctions', { method: 'POST', json: payload });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={sanction ? 'Editar sanción' : 'Nueva sanción'}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} loading={busy}>
            {sanction ? 'Guardar cambios' : 'Crear sanción'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error ? <Alert tone="error">{error}</Alert> : null}

        <FormField label="Jugador" required>
          <Select
            value={form.playerId}
            onChange={(event) => set('playerId', event.target.value)}
            disabled={Boolean(sanction)}
          >
            <option value="">— Seleccioná —</option>
            {players.map((item) => (
              <option key={item.player.id} value={item.player.id}>
                {item.player.shirtNumber ?? '—'} · {item.user.fullName}
              </option>
            ))}
          </Select>
        </FormField>

        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Tipo" required>
            <Select value={form.type} onChange={(event) => set('type', event.target.value as SanctionType)}>
              <option value="tarjeta_amarilla">Tarjeta amarilla</option>
              <option value="tarjeta_roja">Tarjeta roja</option>
              <option value="suspension">Suspensión</option>
              <option value="multa">Multa</option>
              <option value="amonestacion">Amonestación</option>
            </Select>
          </FormField>
          <FormField label="Partido (opcional)">
            <Select value={form.matchId} onChange={(event) => set('matchId', event.target.value)}>
              <option value="">— Sin partido —</option>
              {matches.map((match) => (
                <option key={match.id} value={match.id}>
                  {match.kickOff.slice(0, 10)} · vs {match.opponent}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Monto (multas)">
            <Input
              type="number"
              min={0}
              step={1000}
              value={form.amount}
              onChange={(event) => set('amount', event.target.value)}
            />
          </FormField>
          <FormField label="Puntos / acumulación">
            <Input
              type="number"
              min={0}
              max={10}
              value={form.points}
              onChange={(event) => set('points', event.target.value)}
            />
          </FormField>
          <FormField label="Fecha del hecho" className="sm:col-span-2">
            <Input type="date" value={form.matchDate} onChange={(event) => set('matchDate', event.target.value)} />
          </FormField>
        </div>

        <FormField label="Motivo" required>
          <Textarea
            rows={3}
            value={form.reason}
            onChange={(event) => set('reason', event.target.value)}
            placeholder="Ej. Entrada tardía sobre el rival en el minuto 70"
          />
        </FormField>
      </div>
    </Modal>
  );
}
