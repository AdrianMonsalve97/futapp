import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import { api, errorMessage } from '../services/api';
import { Alert } from '../atoms/Alert';
import { Badge } from '../atoms/Badge';
import { Button } from '../atoms/Button';
import { Card, CardBody } from '../atoms/Card';
import { Icon } from '../atoms/Icon';
import { Modal } from '../atoms/Modal';
import { PositionBadge } from '../molecules/PositionBadge';
import type { PlayerListItem } from '../types/api';
import type { Tournament, TournamentPlayer, TournamentRoster as Roster } from '../types/tournament';

export function TournamentRoster({ tournament, admin }: { tournament: Tournament; admin: boolean }) {
  const endpoint = `/api/tournaments/${tournament.id}/players`;
  const roster = useFetch<Roster>(endpoint);
  const team = useFetch<PlayerListItem[]>(admin ? '/api/players' : null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [removing, setRemoving] = useState<TournamentPlayer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const members = roster.data?.players ?? [];
  const memberIds = new Set(members.map(p => p.playerId));
  const query = search.trim().toLocaleLowerCase('es');
  const available = (team.data ?? []).filter(({ player, user }) => user.active && !memberIds.has(player.id) &&
    `${user.fullName} ${player.shirtNumber ?? ''} ${player.position}`.toLocaleLowerCase('es').includes(query));
  const mine = roster.data?.myPlayerId;
  const add = async () => {
    setBusy(true); setError(null); setFeedback('');
    try {
      await api<Roster>(endpoint, { method: 'POST', json: { playerIds: selected } });
      setFeedback(`${selected.length} ${selected.length === 1 ? 'jugador inscrito' : 'jugadores inscritos'} en ${tournament.name}.`);
      setSelected([]); roster.reload();
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!removing) return;
    setBusy(true); setError(null); setFeedback('');
    try {
      await api<Roster>(`${endpoint}/${removing.playerId}`, { method: 'DELETE' });
      setFeedback(`${removing.playerName} ya no está inscrito en este torneo.`);
      setRemoving(null); roster.reload();
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };
  return <Card><CardBody className="space-y-4">
    <div className="flex flex-wrap gap-3 items-center justify-between">
      <h3 className="font-bold flex items-center gap-2"><Icon name="usuarios" size={20} />Jugadores inscritos</h3>
      <Badge tone="primary">{members.length} inscritos · Fútbol {tournament.rules.format}</Badge>
    </div>
    <p className="text-sm text-base-content/60">Esta plantilla participa en {tournament.name}. La convocatoria y la IA de sus partidos consideran únicamente a los inscritos activos y disponibles. Un jugador puede participar en varios torneos.</p>
    {(error || roster.error) ? <Alert tone="error">{error ?? roster.error}</Alert> : null}
    {feedback ? <Alert tone="success"><span role="status">{feedback}</span></Alert> : null}
    {roster.loading ? <p className="text-sm text-base-content/55">Consultando inscritos…</p> : null}
    {!admin && !roster.loading && !roster.error ? <Alert tone={mine && memberIds.has(mine) ? 'success' : 'info'}>{mine && memberIds.has(mine) ? 'Estás inscrito en este torneo. Puedes confirmar asistencia a sus partidos.' : 'Aún no estás inscrito. Solicita al administrador que te agregue a este torneo para confirmar asistencia.'}</Alert> : null}
    {!roster.loading && !roster.error && !members.length ? <div className="rounded-xl border border-dashed border-base-300 p-5 text-sm text-base-content/60">Todavía no hay jugadores inscritos.{admin ? ' Selecciónalos abajo para comenzar a preparar los partidos de este torneo.' : ''}</div> : null}
    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">{members.map(player => <div key={player.playerId} className="flex min-w-0 items-center gap-3 rounded-xl bg-base-200 p-3">
      <span className="grid place-items-center rounded-lg bg-base-100 w-10 h-10 shrink-0 font-black">{player.shirtNumber ?? '—'}</span>
      <div className="min-w-0 flex-1"><p className="font-semibold text-sm break-words">{player.playerName}{player.playerId === mine ? ' · Tú' : ''}</p><div className="flex flex-wrap gap-1 mt-1"><PositionBadge position={player.position} />{player.secondaryPosition ? <PositionBadge position={player.secondaryPosition} /> : null}{!player.active ? <Badge tone="neutral" size="sm">Inactivo</Badge> : null}</div></div>
      {admin ? <Button size="sm" variant="ghost" disabled={busy || roster.loading} aria-label={`Quitar a ${player.playerName} del torneo`} onClick={() => setRemoving(player)}>Quitar</Button> : null}
    </div>)}</div>
    {admin ? <div className="rounded-xl border border-base-300 p-4 space-y-3">
      <h4 className="font-semibold">Agregar jugadores a este torneo</h4>
      <label className="block text-sm">Buscar por nombre, dorsal o posición<input type="search" className="input input-bordered w-full mt-1" placeholder="Encuentra integrantes del equipo" value={search} onChange={e => setSearch(e.target.value)} /></label>
      {team.error ? <Alert tone="error">{team.error}</Alert> : null}
      {team.loading ? <p className="text-sm">Cargando jugadores del equipo…</p> : null}
      <fieldset disabled={busy || roster.loading || !!roster.error} className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2 max-h-80 overflow-y-auto">
        <legend className="sr-only">Seleccionar jugadores para inscribir</legend>
        {available.map(({ user, player }) => <label key={player.id} className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer ${selected.includes(player.id) ? 'border-primary bg-primary/10' : 'border-base-300'}`}>
          <input type="checkbox" className="checkbox checkbox-primary checkbox-sm shrink-0" checked={selected.includes(player.id)} onChange={e => setSelected(ids => e.target.checked ? [...ids, player.id] : ids.filter(id => id !== player.id))} />
          <span className="min-w-0 text-sm"><span className="block font-semibold break-words">{user.fullName}</span><span className="text-xs text-base-content/60">Dorsal {player.shirtNumber ?? 'sin asignar'} · {player.position}</span></span>
        </label>)}
      </fieldset>
      {!team.loading && !team.error && !available.length ? <p className="text-sm text-base-content/55">{query ? 'No hay jugadores disponibles que coincidan con tu búsqueda.' : 'Todos los jugadores activos del equipo ya están inscritos, o todavía no hay integrantes.'} <Link className="link text-primary" to="/admin/jugadores">Ver jugadores del equipo</Link></p> : null}
      <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-sm text-base-content/60">{selected.length} seleccionados{selected.length ? <Button size="sm" variant="ghost" disabled={busy} onClick={() => setSelected([])}>Limpiar selección</Button> : null}</span><Button loading={busy} disabled={!selected.length || roster.loading || !!roster.error} onClick={() => void add()}>Inscribir seleccionados</Button></div>
      <p className="text-xs text-base-content/55">La inscripción deportiva se gestiona aquí. Los cobros y comprobantes se gestionan en Pagos. El límite de convocatoria ({tournament.rules.maxSquad ?? 'por confirmar'}) corresponde a cada partido.</p>
    </div> : null}
    {removing ? <Modal open title="Quitar inscripción del torneo" onClose={() => { if (!busy) setRemoving(null); }} closeOnOutside={!busy}>
      <p className="text-sm mb-4">Quitar a <strong>{removing.playerName}</strong> de <strong>{tournament.name}</strong> lo excluirá de sus próximos partidos. Si está en una alineación publicada pendiente, tendrás que completarla y publicarla de nuevo. Los partidos jugados y sus estadísticas se conservan.</p>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div className="flex flex-wrap justify-end gap-3 mt-4"><Button variant="ghost" disabled={busy} onClick={() => setRemoving(null)}>Cancelar</Button><Button loading={busy} onClick={() => void remove()}>Quitar del torneo</Button></div>
    </Modal> : null}
  </CardBody></Card>;
}
