import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../hooks/useFetch';
import { PageHeader } from '../templates/PageHeader';
import { Alert } from '../atoms/Alert';
import { Spinner } from '../atoms/Spinner';
import { EmptyState } from '../atoms/EmptyState';
import { Select } from '../atoms/Select';
import { MatchBroadcast } from '../organisms/MatchBroadcast';
import type { Match } from '../types/api';

export function BroadcastsPage() {
  const { user } = useAuth();
  const admin = user?.role === 'admin';
  const { data, loading, error, reload } = useFetch<Match[]>('/api/matches');
  const [filter, setFilter] = useState('todos');
  const available = (data ?? []).filter(match => admin || Boolean(match.streamUrl));
  const matches = available.filter(match => filter === 'todos' || (filter === 'enlace' ? Boolean(match.streamUrl) : ['programado', 'pospuesto'].includes(match.status)))
    .sort((a, b) => {
      const futureA = a.status === 'programado' || a.status === 'pospuesto';
      const futureB = b.status === 'programado' || b.status === 'pospuesto';
      return futureA !== futureB ? Number(futureB) - Number(futureA) : futureA ? a.kickOff.localeCompare(b.kickOff) : b.kickOff.localeCompare(a.kickOff);
    });
  return <>
    <PageHeader title="Transmisiones" subtitle={admin ? 'Configura la emisión de cada partido y compártela con el equipo' : 'Emisiones y grabaciones de nuestros partidos'} actions={admin ? <Link className="btn btn-outline" to="/admin/partidos">Gestionar partidos</Link> : undefined} />
    <p className="text-sm text-base-content/65 mb-5">La emisión se realiza con YouTube Live. Aquí puedes abrir el reproductor o el enlace de YouTube; guardar un enlace no indica que el partido ya esté en vivo.</p>
    <label className="grid gap-2 text-sm mb-5 max-w-sm">Mostrar<Select value={filter} onChange={e => setFilter(e.target.value)}><option value="todos">{admin ? 'Todos los partidos' : 'Todas las transmisiones'}</option><option value="proximos">Partidos programados</option>{admin ? <option value="enlace">Con enlace de transmisión</option> : null}</Select></label>
    {error ? <Alert tone="error">{error}</Alert> : null}
    {loading && !data ? <div className="flex justify-center p-10"><Spinner /></div> : null}
    {!loading && !error && !matches.length ? <EmptyState title={admin ? 'Sin partidos para mostrar' : 'Sin transmisiones disponibles'} message={admin ? 'Programa un partido para configurar su enlace de transmisión.' : 'El administrador puede añadir el enlace de cada partido. Aparecerá aquí cuando lo guarde.'} icon="video" /> : null}
    <div className="grid gap-5 xl:grid-cols-2 items-start">{matches.map(match => <MatchBroadcast key={match.id} match={match} admin={admin} showMatchDetails onSaved={reload} />)}</div>
  </>;
}
