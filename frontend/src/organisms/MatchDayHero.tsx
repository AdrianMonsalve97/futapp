import { useEffect, useState } from 'react';
import { ClubLogo } from '../atoms/ClubLogo';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useFetch } from '../hooks/useFetch';
import { Icon } from '../atoms/Icon';
import { getFormation } from '../data/formations';
import { formatDateTime } from '../utils/format';
import type { Match } from '../types/api';
import { StadiumAtmosphere } from './StadiumAtmosphere';

function Countdown({ kickOff }: { kickOff: string }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.floor((new Date(kickOff+'-05:00').getTime() - now) / 1000));
  if (!seconds) return <p className="match-countdown-note">Hora programada alcanzada · consulta el estado del partido</p>;
  const values = [Math.floor(seconds / 86400), Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60, seconds % 60];
  return <div className="match-countdown" aria-label="Tiempo hasta el próximo partido">
    {values.map((value, index) => <div key={index}><span key={value} className="countdown-tick">{String(value).padStart(2, '0')}</span><small>{['DÍAS', 'HORAS', 'MIN', 'SEG'][index]}</small></div>)}
  </div>;
}

export function MatchDayHero({ match }: { match: Match | null }) {
  const { user } = useAuth();
  const { settings } = useSettings();
  const matches = useFetch<Match[]>('/api/matches');
  const lastFive = (matches.data ?? []).filter(item => item.status === 'jugado').sort((a, b) => b.kickOff.localeCompare(a.kickOff)).slice(0, 5).reverse();
  const slots = getFormation(match?.formation ?? settings.profile.defaultFormation, match?.format ?? settings.format).slots;
  const admin = user?.role === 'admin';
  return <section className="matchday-hero" aria-label="Centro de juego">
    <StadiumAtmosphere />
    <div className="stadium-glow" aria-hidden="true" />
    <div className="hero-editorial">
      <div className="hero-kicker"><span className="live-dot" /> TEMPORADA {settings.season} <span className="hero-format">F{match?.format ?? settings.format}</span></div>
      <p className="hero-welcome">Hola, {user?.fullName.split(' ')[0] ?? 'equipo'}. Tenemos fútbol.</p>
      <h2>{admin ? <>EL PARTIDO<br />EMPIEZA <em>AQUÍ.</em></> : <>TU EQUIPO.<br />TU <em>PARTIDO.</em></>}</h2>
      <p className="hero-description">{admin ? 'Cada decisión cuenta. Prepara el equipo y lleva el control dentro y fuera de la cancha.' : 'Sigue tu rendimiento, confirma tu asistencia y encuentra tu lugar en la cancha.'}</p>
      <div className="hero-form"><span>ÚLTIMOS RESULTADOS</span>{lastFive.length ? lastFive.map(item => {
        const result = (item.goalsFor ?? 0) > (item.goalsAgainst ?? 0) ? 'V' : item.goalsFor === item.goalsAgainst ? 'E' : 'D';
        return <span key={item.id} className={`form-result result-${result}`} title={`${item.opponent}: ${item.goalsFor}–${item.goalsAgainst}`}>{result}</span>;
      }) : <small>El historial comienza en la cancha</small>}</div>
    </div>
    <div className="fixture-board">
      <div className="fixture-heading"><span>{match ? 'PRÓXIMO ENCUENTRO' : 'A LA ESPERA DEL FIXTURE'}</span><Icon name="futbol" size={19} /></div>
      <div className="fixture-teams"><ClubLogo className="w-14 h-14 shrink-0" /><strong>{settings.teamName}</strong><span className="fixture-versus">VS</span><strong>{match?.opponent ?? 'Por definir'}</strong></div>
      {match ? <><p className="fixture-date">{formatDateTime(match.kickOff)}</p><p className="fixture-venue">{match.venue ?? 'Sede por confirmar'} · {match.isHome ? 'Local' : 'Visitante'}</p><Countdown kickOff={match.kickOff} /></> : <p className="fixture-date">Programa un partido para empezar la preparación.</p>}
      <Link className="fixture-action" to={match ? `/${admin ? 'admin' : 'jugador'}/partidos/${match.id}` : `/${admin ? 'admin' : 'jugador'}/partidos`}>{admin ? 'ABRIR TABLERO TÁCTICO' : 'VER MI PARTIDO'}<Icon name="arrowRight" size={18} /></Link>
    </div>
    <svg className="hero-tactical" viewBox="0 0 180 240" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1"><rect x="10" y="10" width="160" height="220" rx="2" /><path d="M10 120h160M50 10v35h80V10M50 230v-35h80v35" /><circle cx="90" cy="120" r="24" /><circle cx="90" cy="120" r="2" /></g>
      {slots.map(slot => <circle key={slot.slotIndex} className="tactical-marker" style={{ animationDelay: `${slot.slotIndex * 120}ms` }} cx={10 + slot.x * 1.6} cy={10 + slot.y * 2.2} r="5" />)}
    </svg>
  </section>;
}
