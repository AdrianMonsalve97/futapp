import { useEffect, useState } from 'react';
import { api, errorMessage } from '../services/api';
import { Alert } from '../atoms/Alert';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { FormField } from '../molecules/FormField';
import type { Foot, Player, Position, UserPlayerResponse } from '../types/api';

export interface ProfileFormProps {
  player: Player | null;
  /** Se invoca tras guardar (para recargar sesión/datos). */
  onSaved: () => void;
}

interface FormState {
  phone: string;
  dni: string;
  birthDate: string;
  position: Position;
  secondaryPosition: string;
  shirtNumber: string;
  heightCm: string;
  weightKg: string;
  foot: string;
  emergencyContact: string;
}

function fromPlayer(player: Player | null, phone: string): FormState {
  return {
    phone,
    dni: player?.dni ?? '',
    birthDate: player?.birthDate ?? '',
    position: player?.position ?? 'MED',
    secondaryPosition: player?.secondaryPosition ?? '',
    shirtNumber: player?.shirtNumber !== null && player?.shirtNumber !== undefined ? String(player.shirtNumber) : '',
    heightCm: player?.heightCm !== null && player?.heightCm !== undefined ? String(player.heightCm) : '',
    weightKg: player?.weightKg !== null && player?.weightKg !== undefined ? String(player.weightKg) : '',
    foot: player?.foot ?? '',
    emergencyContact: player?.emergencyContact ?? '',
  };
}

const toNumber = (value: string): number | null => (value.trim() === '' ? null : Number(value));

/** Formulario de ficha del jugador → `PUT /api/me/profile`. */
export function ProfileForm({ player, onSaved }: ProfileFormProps) {
  const [form, setForm] = useState<FormState>(() => fromPlayer(player, ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForm(fromPlayer(player, form.phone));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => {
      const next = { ...prev };
      next[key] = value;
      return next;
    });

  const submit = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await api<UserPlayerResponse>('/api/me/profile', {
        method: 'PUT',
        json: {
          phone: form.phone.trim() || null,
          dni: form.dni.trim() || null,
          birthDate: form.birthDate || null,
          position: form.position,
          secondaryPosition: form.secondaryPosition ? (form.secondaryPosition as Position) : null,
          shirtNumber: toNumber(form.shirtNumber),
          heightCm: toNumber(form.heightCm),
          weightKg: toNumber(form.weightKg),
          foot: form.foot ? (form.foot as Foot) : null,
          emergencyContact: form.emergencyContact.trim() || null,
        },
      });
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {error ? <Alert tone="error" onClose={() => setError(null)}>{error}</Alert> : null}
      {saved ? <Alert tone="success">Ficha actualizada correctamente.</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Teléfono">
          <Input value={form.phone} onChange={(event) => set('phone', event.target.value)} placeholder="300 000 0000" />
        </FormField>
        <FormField label="DNI">
          <Input value={form.dni} onChange={(event) => set('dni', event.target.value)} placeholder="12345678" />
        </FormField>
        <FormField label="Fecha de nacimiento">
          <Input type="date" value={form.birthDate} onChange={(event) => set('birthDate', event.target.value)} />
        </FormField>
        <FormField label="Dorsal">
          <Input
            type="number"
            min={0}
            max={99}
            value={form.shirtNumber}
            onChange={(event) => set('shirtNumber', event.target.value)}
          />
        </FormField>
        <FormField label="Posición principal">
          <Select value={form.position} onChange={(event) => set('position', event.target.value as Position)}>
            <option value="POR">POR · Portero</option>
            <option value="DEF">DEF · Defensor</option>
            <option value="MED">MED · Mediocampista</option>
            <option value="DEL">DEL · Delantero</option>
          </Select>
        </FormField>
        <FormField label="Posición secundaria">
          <Select value={form.secondaryPosition} onChange={(event) => set('secondaryPosition', event.target.value)}>
            <option value="">— Sin secundaria —</option>
            <option value="POR">POR · Portero</option>
            <option value="DEF">DEF · Defensor</option>
            <option value="MED">MED · Mediocampista</option>
            <option value="DEL">DEL · Delantero</option>
          </Select>
        </FormField>
        <FormField label="Estatura (cm)">
          <Input
            type="number"
            min={100}
            max={230}
            value={form.heightCm}
            onChange={(event) => set('heightCm', event.target.value)}
          />
        </FormField>
        <FormField label="Peso (kg)">
          <Input
            type="number"
            min={40}
            max={150}
            value={form.weightKg}
            onChange={(event) => set('weightKg', event.target.value)}
          />
        </FormField>
        <FormField label="Pie hábil">
          <Select value={form.foot} onChange={(event) => set('foot', event.target.value)}>
            <option value="">— No informado —</option>
            <option value="izq">Izquierdo</option>
            <option value="der">Derecho</option>
            <option value="ambos">Ambos</option>
          </Select>
        </FormField>
        <FormField label="Contacto de emergencia">
          <Input
            value={form.emergencyContact}
            onChange={(event) => set('emergencyContact', event.target.value)}
            placeholder="Nombre · teléfono"
          />
        </FormField>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => void submit()} loading={busy}>
          Guardar ficha
        </Button>
      </div>
    </div>
  );
}
