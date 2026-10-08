import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Match } from '../types/api';
export function MatchRulesNotice({ match }: { match: Match }) {
  const { user } = useAuth(); const rules = match.tournamentRules;
  if (!rules || !match.tournamentId) return null;
  return <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 mb-4 flex flex-wrap items-center justify-between gap-3 text-sm"><div><strong>{rules.tournamentName}</strong><p className="text-base-content/60">{rules.periods} × {rules.minutesPerPeriod} min · descanso {rules.breakMinutes === null ? 'por confirmar' : `${rules.breakMinutes} min`} · convocatoria {rules.maxSquad ?? 'por confirmar'} · cambios {rules.maxSubstitutions ?? 'sin límite'}{rules.rollingSubstitutions ? ' con reingreso' : ''}</p></div><Link className="link text-primary" to={`/${user?.role === 'admin' ? 'admin' : 'jugador'}/torneos/${match.tournamentId}`}>Reglamento de la liga →</Link></div>;
}
