import { useEffect, useState, type FormEvent } from 'react';
import { api, errorMessage } from '../services/api';
import { Alert } from '../atoms/Alert';
import { Button } from '../atoms/Button';
import { HealthFields, type HealthValues } from '../molecules/HealthFields';
import type { Player, UserPlayerResponse } from '../types/api';

const fromPlayer = (player: Player): HealthValues => ({
  eps: player.eps ?? '', prepaidHealth: player.prepaidHealth ?? '', emergencyContact: player.emergencyContact ?? '',
});

export function HealthForm({ player, endpoint, onSaved }: {
  player: Player;
  endpoint: string;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(() => fromPlayer(player));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => { setForm(fromPlayer(player)); }, [player]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(null); setSaved(false);
    try {
      await api<UserPlayerResponse>(endpoint, { method: 'PUT', json: {
        eps: form.eps.trim() || null,
        prepaidHealth: form.prepaidHealth.trim() || null,
        emergencyContact: form.emergencyContact.trim() || null,
      } });
      setSaved(true); onSaved();
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={event => void submit(event)} className="space-y-4">
      <p className="text-sm text-base-content/60">Información opcional, visible para el jugador y los administradores del equipo.</p>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {saved ? <Alert tone="success">Información de salud guardada.</Alert> : null}
      <HealthFields value={form} onChange={(field, value) => { setForm(prev => ({ ...prev, [field]: value })); setSaved(false); }} />
      <div className="flex justify-end"><Button type="submit" loading={busy}>Guardar salud</Button></div>
    </form>
  );
}
