import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../hooks/useFetch';
import { api, errorMessage } from '../services/api';
import { Card, CardBody, CardTitle } from '../atoms/Card';
import { Alert } from '../atoms/Alert';
import { Button } from '../atoms/Button';
import { Icon } from '../atoms/Icon';
import type { AttendanceStatus, MatchAttendance } from '../types/api';

export function AttendancePanel({ matchId, tournamentId, onChanged }: { matchId: number; tournamentId?: number | null; onChanged?: () => void }) {
  const { user } = useAuth();
  const admin = user?.role === 'admin';
  const endpoint = admin ? `/api/matches/${matchId}/attendance` : `/api/me/matches/${matchId}/attendance`;
  const response = useFetch<MatchAttendance[]>(endpoint);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback,setFeedback]=useState('');
  const rows = response.data ?? [];
  const confirm = async (status: AttendanceStatus) => {
    setBusy(true); setError(null);setFeedback('');
    try {
      await api(endpoint, { method: 'PUT', json: { status } });
      response.reload(); onChanged?.();
      setFeedback(status==='confirmado'?'Asistencia confirmada. Revisa tu cuota de arbitraje y envía el soporte para quedar habilitado.':status==='no_disponible'?'Avisaste al equipo que no podrás asistir.':'Puedes confirmar cuando estés listo.');
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  };
  return <Card className={`mb-5 attendance-card ${rows[0]?.status==='confirmado'&&!admin?'attendance-confirmed':''}`}><CardBody>
    <div className="flex flex-wrap items-center justify-between gap-3"><CardTitle className="text-base"><Icon name="usuarios" size={20} />{admin ? 'Convocatoria y disponibilidad' : '¿Cuentas con nosotros para el partido?'}</CardTitle>{admin && <span className="badge badge-success badge-outline">{rows.filter(row => row.status === 'confirmado').length} confirmados · {rows.filter(row=>row.starterEligible).length} habilitados para titular</span>}</div>
    {(error || response.error) && <Alert tone="error">{error ?? response.error}</Alert>}
    {response.loading && <p className="text-sm text-base-content/50">Consultando disponibilidad…</p>}
    {!response.loading && !response.error && (admin ? <>
      <p className="text-xs text-base-content/55">Los jugadores confirman desde su cuenta. Para el inicial se requiere asistencia y arbitraje aprobado a tiempo; los pagos tardíos solo habilitan suplentes. Las bajas y suspensiones se excluyen.</p>
      {tournamentId ? <p className="text-sm">{!rows.length ? 'No hay jugadores activos inscritos en este torneo. ' : 'Esta convocatoria usa la plantilla del torneo. '}<Link className="link text-primary" to={`/admin/torneos/${tournamentId}`}>Gestionar jugadores inscritos</Link></p> : null}
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{rows.map(row => <div key={row.playerId} className="flex min-w-0 items-center gap-3 rounded-xl bg-base-200 p-3"><span className="grid place-items-center w-8 h-8 shrink-0 rounded-lg bg-base-100 font-bold text-xs">{row.shirtNumber ?? '—'}</span><div className="flex-1 min-w-0"><p className="text-xs font-semibold truncate">{row.playerName}</p><p className="text-[10px] text-base-content/55">{row.position} · {row.reason ?? (row.status === 'confirmado' ? 'Asistencia confirmada' : 'Por confirmar')}</p></div><span className={`w-2 h-2 rounded-full shrink-0 ${!row.eligible ? 'bg-error' : row.status === 'confirmado' ? 'bg-success' : 'bg-warning'}`} aria-label={row.reason ?? row.status} /></div>)}</div>
    </> : rows.length ? <>
      <p className="text-sm text-base-content/60">{rows[0].reason ?? (rows[0].status === 'confirmado' ? 'Tu asistencia está confirmada. ¡Nos vemos en la cancha!' : 'Confirma tu asistencia para que el equipo pueda preparar la convocatoria.')}</p>
      <div className="attendance-actions"><Button className="attendance-yes" onClick={() => void confirm('confirmado')} loading={busy} disabled={busy || rows[0].status === 'confirmado'}><Icon name={rows[0].status==='confirmado'?'check':'futbol'} size={20}/>{rows[0].status==='confirmado'?'Asistencia confirmada':'Voy al partido'}</Button><Button variant="outline" onClick={() => void confirm('no_disponible')} disabled={busy || rows[0].status === 'no_disponible'}>No puedo asistir</Button>{rows[0].status !== 'pendiente' && <Button variant="ghost" onClick={() => void confirm('pendiente')} disabled={busy}>Lo confirmaré después</Button>}</div>
      {feedback?<p key={feedback} role="status" className="attendance-feedback"><Icon name="check" size={18}/>{feedback}</p>:null}
    </> : <p className="text-sm text-base-content/55">{tournamentId ? 'Necesitas estar activo e inscrito en este torneo para confirmar tu asistencia. Solicítalo al administrador.' : 'No tienes una ficha activa para este partido.'}</p>)}
  </CardBody></Card>;
}
