import { Outlet } from 'react-router-dom';
import { ClubLogo } from '../atoms/ClubLogo';
import { useSettings } from '../context/SettingsContext';
import { StadiumAtmosphere } from '../organisms/StadiumAtmosphere';

/** Layout de rutas públicas: tarjeta centrada con marca del club. */
export function AuthLayout() {
  const { settings } = useSettings();
  return (
    <div className="auth-stadium">
      <section className="auth-editorial">
        <StadiumAtmosphere />
        <div className="flex items-center gap-3"><ClubLogo className="w-24 h-24" /><span className="text-sm font-bold tracking-wide">FUTAPP <span className="text-white/40 font-normal">/ {settings.teamName}</span></span></div>
        <div className="hero-kicker mt-10"><span className="live-dot" /> TU CLUB, DENTRO Y FUERA DE LA CANCHA</div>
        <h1>MUCHO MÁS<br />QUE <em>FÚTBOL.</em></h1>
        <p>Una misma camiseta. Todas las decisiones en un solo lugar. El próximo triunfo empieza con un equipo conectado.</p>
        <div className="flex flex-wrap gap-3 mt-7 text-[10px] tracking-wide text-white/65"><span>◉ PLANTEL</span><span>◉ TÁCTICA</span><span>◉ RENDIMIENTO</span></div>
        <svg className="hero-tactical" viewBox="0 0 180 240" aria-hidden="true"><g fill="none" stroke="currentColor"><rect x="10" y="10" width="160" height="220" /><path d="M10 120h160M50 10v35h80V10M50 230v-35h80v35" /><circle cx="90" cy="120" r="24" /></g></svg>
      </section>
      <section className="auth-form-zone"><div className="page-enter"><Outlet /><p className="mt-7 text-center text-xs text-base-content/45">© {new Date().getFullYear()} FutApp · Una misma camiseta</p></div></section>
    </div>
  );
}
