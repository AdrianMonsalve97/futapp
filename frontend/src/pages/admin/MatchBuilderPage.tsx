import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';
import { useTeamFormat } from '../../context/SettingsContext';
import { api, errorMessage } from '../../services/api';
import { MatchRulesNotice } from '../../molecules/MatchRulesNotice';
import { PageHeader } from '../../templates/PageHeader';
import { Alert } from '../../atoms/Alert';
import { Badge } from '../../atoms/Badge';
import { Button } from '../../atoms/Button';
import { Card, CardBody, CardTitle } from '../../atoms/Card';
import { Icon } from '../../atoms/Icon';
import { Input } from '../../atoms/Input';
import { Modal } from '../../atoms/Modal';
import { Select } from '../../atoms/Select';
import { Spinner } from '../../atoms/Spinner';
import { Textarea } from '../../atoms/Textarea';
import { FormField } from '../../molecules/FormField';
import { LineupEditor } from '../../organisms/LineupEditor';
import { AttendancePanel } from '../../organisms/AttendancePanel';
import { MatchBroadcast } from '../../organisms/MatchBroadcast';
import { NotifyMatchButton } from '../../organisms/NotifyMatchButton';
import { StatsEntryForm } from '../../organisms/StatsEntryForm';
import { StrategyList } from '../../organisms/StrategyList';
import { StatusBadge } from '../../molecules/StatusBadge';
import { formationsFor, getFormat } from '../../data/formations';
import type {
  Match,
  MatchDetailResponse,
  MatchStatus,
  PlayerListItem,
  Strategy,
  StrategyKind,
} from '../../types/api';

type ZoneTab = 'estrategias' | 'estadisticas';

interface MatchForm {
  opponent: string;
  competition: string;
  kickOff: string;
  venue: string;
  isHome: boolean;
  formation: string;
  status: MatchStatus;
  goalsFor: string;
  goalsAgainst: string;
  notes: string;
}

function toForm(match: Match): MatchForm {
  const profile = getFormat(match.format);
  const available = formationsFor(match.format);
  return {
    opponent: match.opponent,
    competition: match.competition,
    kickOff: match.kickOff.slice(0, 16),
    venue: match.venue ?? '',
    isHome: match.isHome,
    formation: available.some((item) => item.key === match.formation)
      ? match.formation
      : profile.defaultFormation,
    status: match.status,
    goalsFor: match.goalsFor !== null ? String(match.goalsFor) : '',
    goalsAgainst: match.goalsAgainst !== null ? String(match.goalsAgainst) : '',
    notes: match.notes ?? '',
  };
}

/** Modal de alta/edición de estrategia. */
function StrategyFormModal({
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
  const [form, setForm] = useState({ title: '', kind: 'general' as StrategyKind, content: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      strategy
        ? { title: strategy.title, kind: strategy.kind, content: strategy.content }
        : { title: '', kind: 'general', content: '' },
    );
  }, [open, strategy]);

  const submit = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      setError('Título y contenido son obligatorios.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (strategy) {
        await api(`/api/strategies/${strategy.id}`, {
          method: 'PUT',
          json: { title: form.title.trim(), kind: form.kind, content: form.content.trim() },
        });
      } else {
        await api(`/api/matches/${matchId}/strategies`, {
          method: 'POST',
          json: { title: form.title.trim(), kind: form.kind, content: form.content.trim() },
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
      title={strategy ? 'Editar estrategia' : 'Nueva estrategia'}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} loading={busy}>
            {strategy ? 'Guardar cambios' : 'Crear estrategia'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error ? <Alert tone="error">{error}</Alert> : null}
        <FormField label="Título" required>
          <Input
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="Presión alta en salida"
          />
        </FormField>
        <FormField label="Tipo">
          <Select
            value={form.kind}
            onChange={(event) => setForm((prev) => ({ ...prev, kind: event.target.value as StrategyKind }))}
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
            onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
            placeholder="Describí la indicación táctica…"
          />
        </FormField>
      </div>
    </Modal>
  );
}

/**
 * Constructor de partido (SPEC §10.4) — página central:
 * (1) datos + resultado/estado, (2) alineación con IA, (3) estrategias y estadísticas.
 */
export function MatchBuilderPage() {
  const { id } = useParams();
  const matchId = Number(id);
  const valid = Number.isFinite(matchId) && matchId > 0;
  const detail = useFetch<MatchDetailResponse>(valid ? `/api/matches/${matchId}` : null);
  const players = useFetch<PlayerListItem[]>('/api/players');

  const [form, setForm] = useState<MatchForm | null>(null);
  const [zoneTab, setZoneTab] = useState<ZoneTab>('estrategias');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null);

  const match = detail.data?.match ?? null;
  /** §12.7.6 — formato del partido: badge, LineupEditor y "Sugerir XI con IA". */
  const profile = useTeamFormat(match?.format);
  const matchMinutes = match?.minutes ?? profile.matchMinutes;

  useEffect(() => {
    if (match) setForm(toForm(match));
  }, [match]);

  /** Actualiza un campo del formulario (sin mezclar estados mientras carga). */
  const updateForm = <K extends keyof MatchForm>(key: K, value: MatchForm[K]) => {
    setForm((prev) => {
      if (!prev) return prev;
      const next: MatchForm = { ...prev };
      next[key] = value;
      return next;
    });
  };

  const saveMatchData = async () => {
    if (!form || !match) return;
    if (!form.opponent.trim()) {
      setActionError('El rival es obligatorio.');
      return;
    }
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      await api(`/api/matches/${matchId}`, {
        method: 'PUT',
        json: {
          opponent: form.opponent.trim(),
          competition: form.competition.trim() || 'Amistoso',
          kickOff: form.kickOff,
          venue: form.venue.trim() || null,
          isHome: form.isHome,
          formation: form.formation,
          /** §12.4 — el formato viaja siempre; la duración es derivada del formato. */
          format: match.format,
          minutes: matchMinutes,
          notes: form.notes.trim() || null,
          status: form.status,
          goalsFor: form.goalsFor === '' ? null : Number(form.goalsFor),
          goalsAgainst: form.goalsAgainst === '' ? null : Number(form.goalsAgainst),
        },
      });
      setNotice('Datos del partido guardados.');
      detail.reload();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const deleteStrategy = async (strategy: Strategy) => {
    setActionError(null);
    setNotice(null);
    try {
      await api(`/api/strategies/${strategy.id}`, { method: 'DELETE' });
      setNotice('Estrategia eliminada.');
      detail.reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  if (!valid) {
    return (
      <>
        <PageHeader title="Constructor de partido" />
        <Alert tone="error">Identificador de partido inválido.</Alert>
      </>
    );
  }
  if (detail.loading || !detail.data || !form) {
    return (
      <div className="flex flex-col items-center gap-3 py-20">
        <Spinner size="lg" />
        <p className="text-sm text-base-content/60">Cargando partido…</p>
      </div>
    );
  }
  if (detail.error) {
    return (
      <>
        <PageHeader title="Constructor de partido" />
        <Alert tone="error" title="No se pudo cargar el partido" onClose={detail.reload}>
          {detail.error}
        </Alert>
      </>
    );
  }

  const strategies = detail.data.strategies;
  const showResult = form.status === 'jugado' && form.goalsFor !== '' && form.goalsAgainst !== '';

  return (
    <>
      <PageHeader
        title={`vs. ${match?.opponent ?? ''}`}
        subtitle={match ? `${match.competition} · ${match.formation}` : 'Constructor de partido'}
        actions={
          <>
            <Badge tone="primary" size="sm" className="px-3">
              {profile.name} · {matchMinutes}'
            </Badge>
            {showResult ? (
              <span className="badge badge-success badge-lg font-bold tabular-nums px-3">
                {form.goalsFor} – {form.goalsAgainst}
              </span>
            ) : null}
            <Link to="/admin/partidos" className="btn btn-outline btn-sm">
              <Icon name="arrowLeft" size={14} />
              Volver
            </Link>
          </>
        }
      />

      {match ? <MatchRulesNotice match={match} /> : null}
      {match?.status==='programado' ? <NotifyMatchButton matchId={match.id} /> : null}
      {notice ? (
        <Alert tone="success" className="mb-4" onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      ) : null}
      {actionError ? (
        <Alert tone="error" className="mb-4" onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      ) : null}

      {/* ZONA 1 · datos del partido */}
      {match && ['programado', 'pospuesto'].includes(match.status) && <AttendancePanel matchId={matchId} tournamentId={match.tournamentId} onChanged={detail.reload} />}
      {match?<MatchBroadcast key={`${match.id}:${match.streamUrl}`} match={match} admin onSaved={detail.reload}/>:null}
      <Card className="mb-4">
        <CardBody className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">1 · Datos del partido</CardTitle>
            <div className="flex max-w-full flex-wrap items-center gap-2">
              <StatusBadge status={form.status} />
              <Badge tone="info" size="sm">
                {profile.name} · {matchMinutes}'
              </Badge>
              <Badge tone="neutral" size="sm">
                {match?.formation}
              </Badge>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <FormField label="Rival" required>
              <Input
                value={form.opponent}
                onChange={(event) => updateForm('opponent', event.target.value)}
              />
            </FormField>
            <FormField label="Competencia">
              <Input
                value={form.competition}
                onChange={(event) => updateForm('competition', event.target.value)}
              />
            </FormField>
            <FormField label="Fecha y hora">
              <Input
                type="datetime-local"
                value={form.kickOff}
                onChange={(event) => updateForm('kickOff', event.target.value)}
              />
            </FormField>
            <FormField label="Sede">
              <Input
                value={form.venue}
                onChange={(event) => updateForm('venue', event.target.value)}
              />
            </FormField>
            <FormField label="Localía">
              <Select
                value={form.isHome ? '1' : '0'}
                onChange={(event) => updateForm('isHome', event.target.value === '1')}
              >
                <option value="1">Local</option>
                <option value="0">Visita</option>
              </Select>
            </FormField>
            <FormField label="Estado">
              <Select
                value={form.status}
                onChange={(event) => updateForm('status', event.target.value as MatchStatus)}
              >
                <option value="programado">Programado</option>
                <option value="jugado">Jugado</option>
                <option value="cancelado">Cancelado</option>
                <option value="pospuesto">Pospuesto</option>
              </Select>
            </FormField>
            <FormField label="Goles a favor">
              <Input
                type="number"
                min={0}
                value={form.goalsFor}
                onChange={(event) => updateForm('goalsFor', event.target.value)}
              />
            </FormField>
            <FormField label="Goles en contra">
              <Input
                type="number"
                min={0}
                value={form.goalsAgainst}
                onChange={(event) => updateForm('goalsAgainst', event.target.value)}
              />
            </FormField>
            <FormField label="Notas">
              <Input
                value={form.notes}
                onChange={(event) => updateForm('notes', event.target.value)}
                placeholder="Indicaciones generales…"
              />
            </FormField>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => void saveMatchData()} loading={busy}>
              Guardar datos del partido
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* ZONA 2 · alineación */}
      <Card className="mb-4">
        <CardBody className="gap-3">
          <CardTitle className="text-base">2 · Alineación titulares</CardTitle>
          <LineupEditor
            matchId={matchId}
            formation={form.formation}
            lineup={detail.data.lineup}
            players={players.data ?? []}
            format={profile.format}
            allowedFormations={match?.tournamentRules?.allowedFormations}
            publishedAt={match?.lineupPublishedAt}
            onChanged={detail.reload}
          />
        </CardBody>
      </Card>

      {/* ZONA 3 · estrategias y estadísticas */}
      <Card>
        <CardBody className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">3 · Plan de partido</CardTitle>
            <div className="flex min-w-0 max-w-full flex-wrap items-center gap-3">
              <div role="tablist" className="tabs tabs-boxed bg-base-200 p-1">
                <button
                  type="button"
                  role="tab"
                  className={`tab ${zoneTab === 'estrategias' ? 'tab-active' : ''}`}
                  onClick={() => setZoneTab('estrategias')}
                >
                  Estrategias ({strategies.length})
                </button>
                <button
                  type="button"
                  role="tab"
                  className={`tab ${zoneTab === 'estadisticas' ? 'tab-active' : ''}`}
                  onClick={() => setZoneTab('estadisticas')}
                >
                  Estadísticas
                </button>
              </div>
              {zoneTab === 'estrategias' ? (
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingStrategy(null);
                    setStrategyOpen(true);
                  }}
                >
                  <Icon name="plus" size={14} />
                  Nueva estrategia
                </Button>
              ) : null}
            </div>
          </div>

          {zoneTab === 'estrategias' ? (
            <StrategyList
              strategies={strategies}
              onEdit={(strategy) => {
                setEditingStrategy(strategy);
                setStrategyOpen(true);
              }}
              onDelete={(strategy) => void deleteStrategy(strategy)}
            />
          ) : (
            <StatsEntryForm
              matchId={matchId}
              players={players.data ?? []}
              initial={detail.data.stats}
              maxMinutes={matchMinutes}
              onSaved={() => detail.reload()}
            />
          )}
        </CardBody>
      </Card>

      <StrategyFormModal
        open={strategyOpen}
        onClose={() => setStrategyOpen(false)}
        matchId={matchId}
        strategy={editingStrategy}
        onSaved={() => detail.reload()}
      />
    </>
  );
}
