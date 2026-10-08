import { Card, CardBody, CardTitle } from '../atoms/Card';
import { Link } from 'react-router-dom';
import { formatMoney } from '../utils/format';

export function ClubPulse({ total, collected, paidCount, pendingCount }: { total: number; collected: number; paidCount: number; pendingCount: number }) {
  const percentage = total > 0 ? Math.round(collected / total * 100) : 0;
  const length = 2 * Math.PI * 43;
  return <Card><CardBody>
    <div className="flex items-center justify-between gap-3"><CardTitle className="text-base">Pulso del club</CardTitle><span className="badge badge-outline badge-sm">Finanzas</span></div>
    <div className="club-pulse">
      <div className="relative shrink-0"><svg className="club-pulse-ring" viewBox="0 0 100 100" aria-label={`${percentage}% recaudado`}><circle cx="50" cy="50" r="43" fill="none" stroke="var(--color-base-200)" strokeWidth="8" /><circle cx="50" cy="50" r="43" fill="none" stroke="var(--color-primary)" strokeWidth="8" strokeLinecap="round" strokeDasharray={length} strokeDashoffset={length * (1 - percentage / 100)} /></svg><div className="absolute inset-0 grid place-content-center text-center"><strong className="text-2xl font-bold tabular-nums">{percentage}%</strong><span className="text-[9px] text-base-content/50 uppercase tracking-wide">Recaudado</span></div></div>
      <div className="min-w-0 text-sm"><p className="text-base-content/55 text-xs">Esta temporada</p><p className="font-bold mt-1 break-words">{formatMoney(collected)}</p><p className="text-xs text-base-content/50 mt-1">de {formatMoney(total)}</p></div>
    </div>
    <div className="grid grid-cols-2 gap-2"><div className="bg-base-200 rounded-xl p-3"><strong className="text-xl font-bold text-success">{paidCount}</strong><p className="text-[10px] text-base-content/60 mt-1">Inscripciones al día</p></div><div className="bg-base-200 rounded-xl p-3"><strong className="text-xl font-bold text-warning">{pendingCount}</strong><p className="text-[10px] text-base-content/60 mt-1">Por completar</p></div></div>
    <Link to="/admin/inscripciones" className="btn btn-outline btn-sm">Gestionar inscripciones</Link>
  </CardBody></Card>;
}
