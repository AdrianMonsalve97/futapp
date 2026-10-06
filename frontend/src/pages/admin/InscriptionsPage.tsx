import { useEffect, useMemo, useState } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { api, errorMessage } from '../../services/api';
import { PageHeader } from '../../templates/PageHeader';
import { Alert } from '../../atoms/Alert';
import { Button } from '../../atoms/Button';
import { Icon } from '../../atoms/Icon';
import { Input } from '../../atoms/Input';
import { Modal } from '../../atoms/Modal';
import { Select } from '../../atoms/Select';
import { FormField } from '../../molecules/FormField';
import { Money } from '../../molecules/Money';
import { InscriptionsTable } from '../../organisms/InscriptionsTable';
import { PaymentModal } from '../../organisms/PaymentModal';
import { StatCardsRow } from '../../organisms/StatCardsRow';
import { todayIso } from '../../utils/format';
import type { Inscription, InscriptionStatus, PlayerListItem } from '../../types/api';

interface FormState {
  playerId: string;
  season: string;
  concept: string;
  amount: string;
  dueDate: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  playerId: '',
  season: '2026',
  concept: 'Inscripción anual',
  amount: '1200000',
  dueDate: todayIso(),
  notes: '',
};

/** Modal de alta/edición de inscripción. */
function InscriptionFormModal({
  open,
  onClose,
  inscription,
  players,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  inscription: Inscription | null;
  players: PlayerListItem[];
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>({
    ...EMPTY_FORM,
    playerId: players[0] ? String(players[0].player.id) : '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Precarga el formulario cada vez que el modal se abre.
  useEffect(() => {
    if (!open) return;
    setError(null);
    if (inscription) {
      setForm({
        playerId: String(inscription.playerId),
        season: inscription.season,
        concept: inscription.concept,
        amount: String(inscription.amount),
        dueDate: inscription.dueDate ?? '',
        notes: inscription.notes ?? '',
      });
    } else {
      setForm({
        ...EMPTY_FORM,
        playerId: players[0] ? String(players[0].player.id) : '',
      });
    }
  }, [open, inscription, players]);

  const submit = async () => {
    if (!form.playerId && !inscription) {
      setError('Seleccioná un jugador.');
      return;
    }
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('El monto debe ser mayor a cero.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = {
        season: form.season.trim() || '2026',
        concept: form.concept.trim() || 'Inscripción anual',
        amount,
        dueDate: form.dueDate || null,
        notes: form.notes.trim() || null,
      };
      if (inscription) {
        await api(`/api/inscriptions/${inscription.id}`, { method: 'PUT', json: payload });
      } else {
        await api('/api/inscriptions', { method: 'POST', json: { ...payload, playerId: Number(form.playerId) } });
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
      title={inscription ? 'Editar inscripción' : 'Nueva inscripción'}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} loading={busy}>
            {inscription ? 'Guardar cambios' : 'Crear inscripción'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error ? <Alert tone="error">{error}</Alert> : null}
        <FormField label="Jugador" required>
          <Select
            value={form.playerId}
            onChange={(event) => setForm((prev) => ({ ...prev, playerId: event.target.value }))}
            disabled={Boolean(inscription)}
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
          <FormField label="Temporada" required>
            <Input
              value={form.season}
              onChange={(event) => setForm((prev) => ({ ...prev, season: event.target.value }))}
              placeholder="2026"
            />
          </FormField>
          <FormField label="Monto" required>
            <Input
              type="number"
              min={1}
              step={10000}
              value={form.amount}
              onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
            />
          </FormField>
          <FormField label="Concepto">
            <Input
              value={form.concept}
              onChange={(event) => setForm((prev) => ({ ...prev, concept: event.target.value }))}
            />
          </FormField>
          <FormField label="Vencimiento">
            <Input
              type="date"
              value={form.dueDate}
              onChange={(event) => setForm((prev) => ({ ...prev, dueDate: event.target.value }))}
            />
          </FormField>
          <FormField label="Notas" className="sm:col-span-2">
            <Input
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              placeholder="Observaciones…"
            />
          </FormField>
        </div>
      </div>
    </Modal>
  );
}

/** Inscripciones (SPEC §10.4): filtros, totales, tabla, cobro y alta. */
export function InscriptionsPage() {
  const [season, setSeason] = useState('');
  const [status, setStatus] = useState<'' | InscriptionStatus>('');
  const [payFor, setPayFor] = useState<Inscription | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Inscription | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (season.trim()) params.set('season', season.trim());
    if (status) params.set('status', status);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }, [season, status]);

  const { data, loading, error, reload } = useFetch<Inscription[]>(`/api/inscriptions${query}`);
  const players = useFetch<PlayerListItem[]>('/api/players');
  const [actionError, setActionError] = useState<string | null>(null);

  const items = data ?? [];
  const totals = items.reduce(
    (acc, item) => ({
      amount: acc.amount + item.amount,
      paid: acc.paid + item.paid,
      pending: acc.pending + Math.max(0, item.amount - item.paid),
    }),
    { amount: 0, paid: 0, pending: 0 },
  );

  return (
    <>
      <PageHeader
        title="Inscripciones"
        subtitle="Control de cobros por temporada"
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Icon name="plus" size={16} />
            Nueva inscripción
          </Button>
        }
      />

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <FormField label="Temporada" className="w-36">
          <Input value={season} onChange={(event) => setSeason(event.target.value)} placeholder="2026" />
        </FormField>
        <FormField label="Estado" className="w-44">
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value as '' | InscriptionStatus)}
          >
            <option value="">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="parcial">Parcial</option>
            <option value="pagada">Pagada</option>
          </Select>
        </FormField>
        <Button variant="ghost" size="sm" onClick={() => { setSeason(''); setStatus(''); }}>
          Limpiar filtros
        </Button>
      </div>

      <StatCardsRow
        tiles={[
          { label: 'Inscripciones', value: items.length, icon: 'clipboard', tone: 'neutral' },
          { label: 'Total facturado', value: <Money value={totals.amount} />, icon: 'dinero', tone: 'primary' },
          { label: 'Cobrado', value: <Money value={totals.paid} />, icon: 'dinero', tone: 'success' },
          { label: 'Pendiente', value: <Money value={totals.pending} />, icon: 'dinero', tone: 'warning' },
        ]}
        className="mb-4"
      />

      {actionError ? (
        <Alert tone="error" className="mb-4" onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      ) : null}

      <InscriptionsTable
        items={items}
        isLoading={loading}
        error={error}
        onPay={(item) => setPayFor(item)}
        onEdit={(item) => {
          setEditing(item);
          setFormOpen(true);
        }}
        onDelete={async (item) => {
          setActionError(null);
          try {
            await api(`/api/inscriptions/${item.id}`, { method: 'DELETE' });
            reload();
          } catch (err) {
            setActionError(errorMessage(err));
          }
        }}
        emptyTitle="Sin inscripciones"
        emptyMessage="No hay inscripciones con los filtros aplicados o todavía no se crearon."
      />

      <PaymentModal
        inscription={payFor}
        onClose={() => setPayFor(null)}
        onSaved={() => {
          setPayFor(null);
          reload();
        }}
      />

      <InscriptionFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        inscription={editing}
        players={players.data ?? []}
        onSaved={reload}
      />
    </>
  );
}
