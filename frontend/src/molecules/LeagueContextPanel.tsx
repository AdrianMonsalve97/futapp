import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { LeagueContext } from '../types/tournament';
export function LeagueContextPanel({ context }: { context?: LeagueContext }) {
  const { user } = useAuth();
  if (!context) return null;
  return <section className="league-context rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-3">
    <div className="flex flex-wrap justify-between gap-2"><div><p className="text-xs uppercase tracking-wider text-primary">La liga en el análisis</p><h3 className="font-bold">{context.name} · {context.leagueName}</h3></div><Link className="link text-sm" to={`/${user?.role === 'admin' ? 'admin' : 'jugador'}/torneos/${context.tournamentId}`}>Ver normativa</Link></div>
    <div className="flex flex-wrap gap-2 text-xs"><span className="badge badge-outline">{context.periods} × {context.minutesPerPeriod} min</span><span className="badge badge-outline">Convocatoria: {context.maxSquad ?? 'por confirmar'}</span><span className="badge badge-outline">Cambios: {context.maxSubstitutions ?? 'sin límite'}</span><span className="badge badge-outline">{context.rollingSubstitutions === null ? 'Reingreso por confirmar' : context.rollingSubstitutions ? 'Con reingreso' : 'Sin reingreso'}</span></div>
    {context.notes ? <p className="text-sm whitespace-pre-wrap">{context.notes}</p> : null}
    <details className="text-sm"><summary className="cursor-pointer font-semibold">Plan de posiciones y documentos consultados</summary><ul className="mt-2 grid sm:grid-cols-2 gap-1">{context.positionPlan.map((item,i) => <li key={i}>{item}</li>)}</ul>{context.documents.map((doc,i) => <div key={i} className="mt-3"><p className="font-semibold">{doc.title}</p><p className="whitespace-pre-wrap text-xs text-base-content/60">{doc.excerpt || 'Documento sin texto extraíble. Completa las indicaciones del torneo.'}</p></div>)}</details>
  </section>;
}
