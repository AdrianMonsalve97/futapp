import { useEffect, useState } from 'react';
import { FormationPitch, pitchGridClass, type PitchSlot } from './FormationPitch';
import { formationsFor, getFormat, getFormation } from '../data/formations';
import { api, errorMessage } from '../services/api';
import { Alert } from '../atoms/Alert';
import { Button } from '../atoms/Button';
import { Modal } from '../atoms/Modal';
import { FormField } from '../molecules/FormField';
import { PositionBadge } from '../molecules/PositionBadge';
import { Select } from '../atoms/Select';
import { Spinner } from '../atoms/Spinner';
import type {
  AutoLineupResponse,
  LineupResponse,
  LineupSlot,
  MatchWithLineupResponse,
  PlayerListItem,
  TeamFormat,
} from '../types/api';

export interface LineupEditorProps {
  matchId: number;
  formation: string;
  lineup: LineupSlot[];
  players: PlayerListItem[];
  /** §12.7.3 — formato del partido: filtra las formaciones y fija el cupo. */
  format: TeamFormat;
  /** Se invoca tras cada escritura para que la página recargue los datos. */
  onChanged: () => void;
}

type Busy = 'formation' | 'suggest' | 'save' | null;

const POSITION_ORDER: Record<string, number> = { POR: 0, DEF: 1, MED: 2, DEL: 3 };

/** Convierte los slots del API (o el catálogo) a slots dibujables del pitch.
 * Siempre itera sobre el catálogo del formato: garantiza exactamente
 * `playersOnPitch` slots aunque la alineación guardada venga de otro formato. */
function buildSlots(lineup: LineupSlot[], formationKey: string, format: TeamFormat): PitchSlot[] {
  const catalog = getFormation(formationKey, format).slots;
  const byIndex = new Map<number, LineupSlot>((lineup ?? []).map((slot) => [slot.slotIndex, slot]));
  return catalog.map((item) => {
    const saved = byIndex.get(item.slotIndex);
    return {
      slotIndex: item.slotIndex,
      x: saved?.x ?? item.x,
      y: saved?.y ?? item.y,
      role: item.role,
      label: item.label,
      playerId: saved?.playerId ?? null,
      playerName: saved?.playerName ?? null,
      shirtNumber: saved?.shirtNumber ?? null,
    };
  });
}

/**
 * Editor de alineación (SPEC §10.4 + §12.7.3): selector de formaciones del
 * FORMATO DEL PARTIDO, pitch editable (click en slot → elegir jugador),
 * contador "N / N en cancha", "Sugerir XI con IA" y "Guardar".
 */
export function LineupEditor({ matchId, formation, lineup, players, format, onChanged }: LineupEditorProps) {
  const [slots, setSlots] = useState<PitchSlot[]>(() => buildSlots(lineup, formation, format));
  const [formationKey, setFormationKey] = useState(formation);
  const [pendingSlot, setPendingSlot] = useState<PitchSlot | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const profile = getFormat(format);
  const formationOptions = formationsFor(format);
  const playersOnPitch = profile.playersOnPitch;

  // Sincroniza cuando el padre recarga (tras cada guardado).
  useEffect(() => {
    setSlots(buildSlots(lineup, formation, format));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineup]);

  useEffect(() => {
    setFormationKey(formation);
  }, [formation]);

  useEffect(() => {
    if (!pendingSlot) return;
    setSelectedPlayerId(pendingSlot.playerId ? String(pendingSlot.playerId) : '');
  }, [pendingSlot]);

  const filled = slots.filter((slot) => slot.playerId).length;

  const sortedPlayers = [...players].sort((a, b) => {
    const byPos = (POSITION_ORDER[a.player.position] ?? 9) - (POSITION_ORDER[b.player.position] ?? 9);
    if (byPos !== 0) return byPos;
    const byNumber = (a.player.shirtNumber ?? 99) - (b.player.shirtNumber ?? 99);
    if (byNumber !== 0) return byNumber;
    return a.user.fullName.localeCompare(b.user.fullName, 'es');
  });

  const changeFormation = async (key: string) => {
    if (key === formationKey) return;
    setBusy('formation');
    setError(null);
    setNotice(null);
    try {
      const res = await api<MatchWithLineupResponse>(`/api/matches/${matchId}/formation`, {
        method: 'PUT',
        json: { formation: key },
      });
      setFormationKey(res.match.formation);
      setSlots(buildSlots(res.lineup, res.match.formation, format));
      setNotice(`Formación ${key}: se conservaron los jugadores que siguen en pie. Revisá y guardá.`);
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const suggestXi = async () => {
    setBusy('suggest');
    setError(null);
    setNotice(null);
    try {
      const res = await api<AutoLineupResponse>(`/api/matches/${matchId}/lineup/auto`, {
        method: 'POST',
        json: { formation: formationKey },
      });
      setSlots(buildSlots(res.lineup, formationKey, format));
      setNotice(res.explanation);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    setBusy('save');
    setError(null);
    setNotice(null);
    try {
      const payload = {
        slots: slots.map((slot) => ({
          slotIndex: slot.slotIndex,
          playerId: slot.playerId ?? null,
          x: slot.x,
          y: slot.y,
          role: slot.role,
          label: slot.label,
        })),
      };
      await api<LineupResponse>(`/api/matches/${matchId}/lineup`, { method: 'PUT', json: payload });
      setNotice('Alineación guardada correctamente.');
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const assignPlayer = () => {
    if (!pendingSlot) return;
    const playerId = selectedPlayerId ? Number(selectedPlayerId) : null;
    const found = playerId ? players.find((item) => item.player.id === playerId) : undefined;
    setSlots((prev) =>
      prev.map((slot) =>
        slot.slotIndex !== pendingSlot.slotIndex
          ? slot
          : {
              ...slot,
              playerId,
              playerName: found ? found.user.fullName : null,
              shirtNumber: found ? found.player.shirtNumber : null,
            },
      ),
    );
    setPendingSlot(null);
  };

  return (
    <div className="space-y-4">
      {/* Selector de formaciones del formato + acciones */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="join">
          {formationOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              className={`btn btn-sm join-item ${formationKey === option.key ? 'btn-active btn-primary' : 'btn-outline'}`}
              onClick={() => void changeFormation(option.key)}
              disabled={busy !== null}
            >
              {option.key}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge badge-ghost badge-sm">
            {filled} / {playersOnPitch} en cancha
          </span>
          <Button size="sm" variant="secondary" onClick={() => void suggestXi()} loading={busy === 'suggest'}>
            Sugerir XI con IA
          </Button>
          <Button size="sm" onClick={() => void save()} loading={busy === 'save'} disabled={filled === 0}>
            Guardar alineación
          </Button>
        </div>
      </div>

      {busy === 'formation' ? <Spinner size="sm" /> : null}
      {error ? <Alert tone="error" onClose={() => setError(null)}>{error}</Alert> : null}
      {notice ? (
        <Alert tone="success" onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      ) : null}

      <div className={`grid gap-4 ${pitchGridClass(format)}`}>
        <FormationPitch
          slots={slots}
          variant="edit"
          format={format}
          selectedSlotIndex={pendingSlot?.slotIndex ?? null}
          onSlotClick={(slot) => setPendingSlot(slot)}
          emptyMessage="Sin formación"
        />

        <div className="space-y-3">
          <div className="rounded-xl border border-base-200 bg-base-100 p-4">
            <h3 className="font-semibold text-sm mb-1">Cómo usar el editor</h3>
            <ul className="text-sm text-base-content/70 space-y-1 list-disc pl-5">
              <li>
                {profile.name}: elegí una formación ({formationOptions.length} opciones): se reemplazan los
                slots vacíos.
              </li>
              <li>Hacé click en un slot del pitch para asignar o vaciar un jugador.</li>
              <li>
                Se necesitan exactamente {playersOnPitch} jugadores en cancha para publicar la alineación
                (actualmente {filled} / {playersOnPitch} en cancha).
              </li>
              <li>“Sugerir XI con IA” arma el titular por rendimiento y luego “Guardá” para publicarlo.</li>
            </ul>
          </div>

          <div className="rounded-xl border border-base-200 bg-base-100 p-4">
            <h3 className="font-semibold text-sm mb-2">Alineación actual</h3>
            <ul className="space-y-1.5">
              {slots.map((slot) => (
                <li key={slot.slotIndex} className="flex items-center gap-2 text-sm">
                  <span className="w-12 shrink-0 text-xs text-base-content/50 font-mono">{slot.label}</span>
                  <PositionBadge position={slot.role} size="xs" />
                  <span className={slot.playerId ? 'font-medium' : 'text-base-content/40'}>
                    {slot.playerId ? `${slot.shirtNumber ?? '—'} ${slot.playerName}` : 'Vacante'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <Modal
        open={pendingSlot !== null}
        onClose={() => setPendingSlot(null)}
        title={pendingSlot ? `Slot ${pendingSlot.label} (${pendingSlot.role})` : ''}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingSlot(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={() => setSelectedPlayerId('')}>
              Vaciar
            </Button>
            <Button onClick={assignPlayer}>Asignar</Button>
          </>
        }
      >
        <FormField label="Jugador" hint="Dejá “— Sin asignar —” para dejar el slot vacío.">
          <Select value={selectedPlayerId} onChange={(event) => setSelectedPlayerId(event.target.value)}>
            <option value="">— Sin asignar —</option>
            {sortedPlayers.map((item) => (
              <option key={item.player.id} value={item.player.id}>
                {item.player.shirtNumber ?? '—'} · {item.user.fullName} ({item.player.position})
                {item.user.active ? '' : ' · inactivo'}
              </option>
            ))}
          </Select>
        </FormField>
      </Modal>
    </div>
  );
}
