import { useEffect, useState } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { useSettings } from '../../context/SettingsContext';
import { api, errorMessage } from '../../services/api';
import { PageHeader } from '../../templates/PageHeader';
import { Alert } from '../../atoms/Alert';
import { Button } from '../../atoms/Button';
import { Card, CardBody, CardTitle } from '../../atoms/Card';
import { Input } from '../../atoms/Input';
import { Modal } from '../../atoms/Modal';
import { Select } from '../../atoms/Select';
import { Textarea } from '../../atoms/Textarea';
import { FormField } from '../../molecules/FormField';
import { MatchList } from '../../organisms/MatchList';
import { FORMAT_LIST, formationsFor, getFormat } from '../../data/formations';
import { todayIso } from '../../utils/format';
import type { Match, MatchStatus, TeamFormat } from '../../types/api';

interface FormState {
  opponent: string;
  competition: string;
  kickOff: string;
  venue: string;
  isHome: boolean;
  format: TeamFormat;
  minutes: number;
  formation: string;
  status: MatchStatus;
  goalsFor: string;
  goalsAgainst: string;
  notes: string;
}

/** Estado del formulario: crea con el formato del equipo (§12.7.5) y edita con el del partido. */
function toForm(match: Match | null, teamFormat: TeamFormat): FormState {
  if (!match) {
    const profile = getFormat(teamFormat);
    return {
      opponent: '',
      competition: 'Amistoso',
      kickOff: `${todayIso()}T15:00`,
      venue: 'Cancha del club',
      isHome: true,
      format: teamFormat,
      minutes: profile.matchMinutes,
      formation: profile.defaultFormation,
      status: 'programado',
      goalsFor: '',
      goalsAgainst: '',
      notes: '',
    };
  }
  const format = match.format ?? teamFormat;
  const profile = getFormat(format);
  const available = formationsFor(format);
  return {
    opponent: match.opponent,
    competition: match.competition,
    kickOff: match.kickOff.slice(0, 16),
    venue: match.venue ?? '',
    isHome: match.isHome,
    format,
    minutes: match.minutes ?? profile.matchMinutes,
    formation: available.some((item) => item.key === match.formation)
      ? match.formation
      : profile.defaultFormation,
    status: match.status,
    goalsFor: match.goalsFor !== null ? String(match.goalsFor) : '',
    goalsAgainst: match.goalsAgainst !== null ? String(match.goalsAgainst) : '',
    notes: match.notes ?? '',
  };
}

/** Modal de alta/edición de partido. */
function MatchFormModal({
  open,
  onClose,
  match,
  teamFormat,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  match: Match | null;
  teamFormat: TeamFormat;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => toForm(match, teamFormat));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(toForm(match, teamFormat));
      setError(null);
    }
  }, [open, match, teamFormat]);

  const submit = async () => {
    if (!form.opponent.trim()) {
      setError('Ingresá el rival.');
      return;
    }
    setBusy(true);
    setError(null);
    const payload = {
      opponent: form.opponent.trim(),
      competition: form.competition.trim() || 'Amistoso',
      kickOff: form.kickOff,
      venue: form.venue.trim() || null,
      isHome: form.isHome,
      format: form.format,
      minutes: form.minutes,
      formation: form.formation,
      notes: form.notes.trim() || null,
      status: form.status,
      goalsFor: form.goalsFor === '' ? null : Number(form.goalsFor),
      goalsAgainst: form.goalsAgainst === '' ? null : Number(form.goalsAgainst),
    };
    try {
      if (match) {
        await api(`/api/matches/${match.id}`, { method: 'PUT', json: payload });
      } else {
        await api('/api/matches', { method: 'POST', json: payload });
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
      title={match ? `Editar partido vs. ${match.opponent}` : 'Nuevo partido'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} loading={busy}>
            {match ? 'Guardar cambios' : 'Crear partido'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error ? <Alert tone="error">{error}</Alert> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Rival" required>
            <Input
              value={form.opponent}
              onChange={(event) => setForm((prev) => ({ ...prev, opponent: event.target.value }))}
              placeholder="Rivales FC"
            />
          </FormField>
          <FormField label="Competencia">
            <Input
              value={form.competition}
              onChange={(event) => setForm((prev) => ({ ...prev, competition: event.target.value }))}
            />
          </FormField>
          <FormField label="Fecha y hora" required>
            <Input
              type="datetime-local"
              value={form.kickOff}
              onChange={(event) => setForm((prev) => ({ ...prev, kickOff: event.target.value }))}
            />
          </FormField>
          <FormField label="Sede">
            <Input
              value={form.venue}
              onChange={(event) => setForm((prev) => ({ ...prev, venue: event.target.value }))}
            />
          </FormField>
          <FormField label="Localía">
            <Select
              value={form.isHome ? '1' : '0'}
              onChange={(event) => setForm((prev) => ({ ...prev, isHome: event.target.value === '1' }))}
            >
              <option value="1">Local</option>
              <option value="0">Visita</option>
            </Select>
          </FormField>
          <FormField label="Formato del partido" hint="Por defecto, el formato global del equipo.">
            <Select
              value={form.format}
              onChange={(event) => {
                const next = Number(event.target.value) as TeamFormat;
                setForm((prev) => {
                  const profile = getFormat(next);
                  const stillValid = formationsFor(next).some((item) => item.key === prev.formation);
                  return {
                    ...prev,
                    format: next,
                    minutes: profile.matchMinutes,
                    formation: stillValid ? prev.formation : profile.defaultFormation,
                  };
                });
              }}
            >
              {FORMAT_LIST.map((profile) => (
                <option key={profile.format} value={profile.format}>
                  {profile.name} · {profile.playersOnPitch} en cancha · {profile.matchMinutes}'
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Duración" hint="Se deriva del formato elegido.">
            <Input value={`${form.minutes}'`} readOnly disabled aria-label="Duración del partido" />
          </FormField>
          <FormField label="Formación inicial">
            <Select
              value={form.formation}
              onChange={(event) => setForm((prev) => ({ ...prev, formation: event.target.value }))}
            >
              {formationsFor(form.format).map((option) => (
                <option key={option.key} value={option.key}>
                  {option.key}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Estado">
            <Select
              value={form.status}
              onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as MatchStatus }))}
            >
              <option value="programado">Programado</option>
              <option value="jugado">Jugado</option>
              <option value="cancelado">Cancelado</option>
              <option value="pospuesto">Pospuesto</option>
            </Select>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Goles a favor">
              <Input
                type="number"
                min={0}
                value={form.goalsFor}
                onChange={(event) => setForm((prev) => ({ ...prev, goalsFor: event.target.value }))}
              />
            </FormField>
            <FormField label="Goles en contra">
              <Input
                type="number"
                min={0}
                value={form.goalsAgainst}
                onChange={(event) => setForm((prev) => ({ ...prev, goalsAgainst: event.target.value }))}
              />
            </FormField>
          </div>
          <FormField label="Notas" className="sm:col-span-2">
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              placeholder="Indicaciones generales…"
            />
          </FormField>
        </div>
      </div>
    </Modal>
  );
}

/** Partidos admin (SPEC §10.4): lista con estado + formulario "Nuevo partido". */
export function MatchesPage() {
  const { data, loading, error, reload } = useFetch<Match[]>('/api/matches');
  const { settings } = useSettings();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Match | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const remove = async (match: Match) => {
    setActionError(null);
    try {
      await api(`/api/matches/${match.id}`, { method: 'DELETE' });
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  const matches = data ?? [];
  const upcoming = matches.filter((item) => item.status !== 'jugado');
  const played = matches.filter((item) => item.status === 'jugado');

  return (
    <>
      <PageHeader
        title="Partidos"
        subtitle={`Fixture, resultados y preparación táctica · Formato global: ${settings.profile.name} (${settings.profile.matchMinutes}')`}
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            Nuevo partido
          </Button>
        }
      />

      {actionError ? (
        <Alert tone="error" className="mb-4" onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      ) : null}

      <div className="space-y-5">
        <Card>
          <CardBody className="gap-3">
            <CardTitle className="text-base">Próximos y en curso</CardTitle>
            <MatchList
              matches={upcoming}
              mode="admin"
              isLoading={loading}
              error={error}
              detailHref={(match) => `/admin/partidos/${match.id}`}
              onEdit={(match) => {
                setEditing(match);
                setModalOpen(true);
              }}
              onDelete={(match) => void remove(match)}
              emptyTitle="Sin partidos programados"
              emptyMessage="Creá el primer partido con el botón “Nuevo partido”."
            />
          </CardBody>
        </Card>

        <Card>
          <CardBody className="gap-3">
            <CardTitle className="text-base">Jugados</CardTitle>
            <MatchList
              matches={played}
              mode="admin"
              detailHref={(match) => `/admin/partidos/${match.id}`}
              onEdit={(match) => {
                setEditing(match);
                setModalOpen(true);
              }}
              onDelete={(match) => void remove(match)}
              emptyTitle="Sin partidos jugados"
              emptyMessage="Todavía no se registraron resultados."
            />
          </CardBody>
        </Card>
      </div>

      <MatchFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        match={editing}
        teamFormat={settings.profile.format}
        onSaved={reload}
      />
    </>
  );
}
