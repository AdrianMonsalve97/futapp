import { useEffect, useState } from 'react';
import { api, errorMessage } from '../services/api';
import { Alert } from '../atoms/Alert';
import { Button } from '../atoms/Button';
import { Modal } from '../atoms/Modal';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { FormField } from '../molecules/FormField';
import { HealthFields } from '../molecules/HealthFields';
import type { Foot, PlayerListItem, Position, Role, UserPlayerResponse } from '../types/api';

export interface PlayerFormModalProps {
  open: boolean;
  onClose: () => void;
  /** `null` = alta; con item = edición. */
  player: PlayerListItem | null;
  onSaved: () => void;
}

interface FormState {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  dni: string;
  position: Position;
  secondaryPosition: string;
  shirtNumber: string;
  birthDate: string;
  heightCm: string;
  weightKg: string;
  foot: string;
  emergencyContact: string;
  eps: string;
  prepaidHealth: string;
  role: Role;
  active: boolean;
}

const EMPTY: FormState = {
  fullName: '',
  email: '',
  phone: '',
  password: '',
  dni: '',
  position: 'MED',
  secondaryPosition: '',
  shirtNumber: '',
  birthDate: '',
  heightCm: '',
  weightKg: '',
  foot: '',
  emergencyContact: '',
  eps: '',
  prepaidHealth: '',
  role: 'player',
  active: true,
};

function fromItem(item: PlayerListItem | null): FormState {
  if (!item) return { ...EMPTY };
  const { user, player } = item;
  return {
    fullName: user.fullName,
    email: user.email,
    phone: user.phone ?? '',
    password: '',
    dni: player.dni ?? '',
    position: player.position,
    secondaryPosition: player.secondaryPosition ?? '',
    shirtNumber: player.shirtNumber !== null ? String(player.shirtNumber) : '',
    birthDate: player.birthDate ?? '',
    heightCm: player.heightCm !== null ? String(player.heightCm) : '',
    weightKg: player.weightKg !== null ? String(player.weightKg) : '',
    foot: player.foot ?? '',
    emergencyContact: player.emergencyContact ?? '',
    eps: player.eps ?? '',
    prepaidHealth: player.prepaidHealth ?? '',
    role: user.role,
    active: user.active,
  };
}

const toNumber = (value: string): number | null => (value.trim() === '' ? null : Number(value));

/** Modal de alta/edición de jugador (`POST/PUT /api/players`). */
export function PlayerFormModal({ open, onClose, player, onSaved }: PlayerFormModalProps) {
  const [form, setForm] = useState<FormState>(() => fromItem(player));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(fromItem(player));
      setError(null);
    }
  }, [open, player]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => {
      const next = { ...prev };
      next[key] = value;
      return next;
    });

  const submit = async () => {
    if (!form.fullName.trim()) {
      setError('El nombre completo es obligatorio.');
      return;
    }
    if (!player && !form.email.trim()) {
      setError('El email es obligatorio para crear el usuario.');
      return;
    }
    if (!player && form.password.length < 15) {
      setError('La contraseña debe tener al menos 15 caracteres.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const common = {
        fullName: form.fullName.trim(),
        phone: form.phone.trim() || null,
        dni: form.dni.trim() || null,
        position: form.position,
        secondaryPosition: form.secondaryPosition ? (form.secondaryPosition as Position) : null,
        shirtNumber: toNumber(form.shirtNumber),
        birthDate: form.birthDate || null,
        heightCm: toNumber(form.heightCm),
        weightKg: toNumber(form.weightKg),
        foot: form.foot ? (form.foot as Foot) : null,
        emergencyContact: form.emergencyContact.trim() || null,
        eps: form.eps.trim() || null,
        prepaidHealth: form.prepaidHealth.trim() || null,
      };

      if (player) {
        await api<UserPlayerResponse>(`/api/players/${player.player.id}`, {
          method: 'PUT',
          json: { ...common, role: form.role },
        });
      } else {
        await api<UserPlayerResponse>('/api/players', {
          method: 'POST',
          json: {
            ...common,
            email: form.email.trim(),
            password: form.password,
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={player ? `Editar jugador · ${player.user.fullName}` : 'Nuevo jugador'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} loading={busy}>
            {player ? 'Guardar cambios' : 'Crear jugador'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error ? <Alert tone="error">{error}</Alert> : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Nombre completo" required>
            <Input
              value={form.fullName}
              onChange={(event) => set('fullName', event.target.value)}
              placeholder="Lucas Martínez"
            />
          </FormField>
          <FormField label="Email" required>
            <Input
              type="email"
              value={form.email}
              onChange={(event) => set('email', event.target.value)}
              placeholder="jugador@club.com"
              disabled={Boolean(player)}
              error={Boolean(player)}
            />
          </FormField>
          <FormField label="Teléfono">
            <Input value={form.phone} onChange={(event) => set('phone', event.target.value)} placeholder="300 000 0000" />
          </FormField>
          <FormField
            label="Contraseña"
            required={!player}
            hint={player ? 'Dejar vacío para no modificar.' : 'Mínimo 15 caracteres.'}
          >
            <Input
              type="password"
              value={form.password}
              onChange={(event) => set('password', event.target.value)}
              placeholder="••••••"
              autoComplete="new-password"
            />
          </FormField>
          <FormField label="DNI">
            <Input value={form.dni} onChange={(event) => set('dni', event.target.value)} placeholder="12345678" />
          </FormField>
          <FormField label="Fecha de nacimiento">
            <Input type="date" value={form.birthDate} onChange={(event) => set('birthDate', event.target.value)} />
          </FormField>
          <FormField label="Posición" required>
            <Select value={form.position} onChange={(event) => set('position', event.target.value as Position)}>
              <option value="POR">POR · Portero</option>
              <option value="DEF">DEF · Defensor</option>
              <option value="MED">MED · Mediocampista</option>
              <option value="DEL">DEL · Delantero</option>
            </Select>
          </FormField>
          <FormField label="Posición secundaria">
            <Select
              value={form.secondaryPosition}
              onChange={(event) => set('secondaryPosition', event.target.value)}
            >
              <option value="">— Sin secundaria —</option>
              <option value="POR">POR · Portero</option>
              <option value="DEF">DEF · Defensor</option>
              <option value="MED">MED · Mediocampista</option>
              <option value="DEL">DEL · Delantero</option>
            </Select>
          </FormField>
          <FormField label="Dorsal" hint="Cada número pertenece a un solo integrante. Vacío = sin asignar.">
            <Input
              type="number"
              min={0}
              max={99}
              value={form.shirtNumber}
              onChange={(event) => set('shirtNumber', event.target.value)}
              placeholder="10"
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
          <FormField label="Estatura (cm)">
            <Input
              type="number"
              min={100}
              max={230}
              value={form.heightCm}
              onChange={(event) => set('heightCm', event.target.value)}
              placeholder="178"
            />
          </FormField>
          <FormField label="Peso (kg)">
            <Input
              type="number"
              min={40}
              max={150}
              value={form.weightKg}
              onChange={(event) => set('weightKg', event.target.value)}
              placeholder="74"
            />
          </FormField>
          <FormField label="Rol">
            <Select value={form.role} disabled={!player} onChange={(event) => set('role', event.target.value as Role)}>
              <option value="player">Jugador</option>
              <option value="admin">Administrador</option>
            </Select>
          </FormField>
          <FormField label="Estado"><p className="text-sm py-3">{player?.pendingApproval ? 'Pendiente de aval' : form.active ? 'Activo' : 'Inactivo'}. Las bajas se realizan desde el listado de jugadores.</p></FormField>
        </div>
        <section className="space-y-3 border-t border-base-200 pt-4">
          <h3 className="font-semibold">Salud</h3>
          <HealthFields value={form} onChange={set} />
        </section>
      </div>
    </Modal>
  );
}
