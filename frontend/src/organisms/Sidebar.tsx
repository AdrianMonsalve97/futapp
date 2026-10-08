import { ClubLogo } from '../atoms/ClubLogo';
import { NavLink } from 'react-router-dom';
import { Icon, type IconName } from '../atoms/Icon';
import { useSettings } from '../context/SettingsContext';
import type { Role } from '../types/api';

export interface MenuItem {
  to: string;
  label: string;
  icon: IconName;
}

export const MENU_BY_ROLE: Record<Role, MenuItem[]> = {
  admin: [
    { to: '/admin/inicio', label: 'Inicio', icon: 'chart' },
    { to: '/admin/jugadores', label: 'Jugadores', icon: 'usuarios' },
    { to: '/admin/inscripciones', label: 'Inscripciones', icon: 'dinero' },
    { to: '/admin/pagos-qr', label: 'Pagos QR y soportes', icon: 'dinero' },
    { to: '/admin/notificaciones', label: 'Notificaciones y bot', icon: 'clipboard' },
    { to: '/admin/uniformes', label: 'Uniformes', icon: 'camiseta' },
    { to: '/admin/torneos', label: 'Torneos y normativa', icon: 'trofeo' },
    { to: '/admin/partidos', label: 'Partidos', icon: 'futbol' },
    { to: '/admin/transmisiones', label: 'Transmisiones', icon: 'video' },
    { to: '/admin/sanciones', label: 'Sanciones', icon: 'tarjeta' },
    { to: '/admin/estadisticas', label: 'Estadísticas', icon: 'clipboard' },
    { to: '/admin/ia', label: 'Inteligencia artificial', icon: 'sparkles' },
    { to: '/admin/configuracion', label: 'Configuración', icon: 'settings' },
  ],
  player: [
    { to: '/jugador/inicio', label: 'Inicio', icon: 'chart' },
    { to: '/jugador/torneos', label: 'Torneos y normativa', icon: 'trofeo' },
    { to: '/jugador/partidos', label: 'Partidos', icon: 'futbol' },
    { to: '/jugador/transmisiones', label: 'Transmisiones', icon: 'video' },
    { to: '/jugador/estadisticas', label: 'Mis estadísticas', icon: 'clipboard' },
    { to: '/jugador/ia', label: 'Rendimiento IA', icon: 'sparkles' },
    { to: '/jugador/inscripcion', label: 'Mi inscripción', icon: 'dinero' },
    { to: '/jugador/uniformes', label: 'Mis uniformes', icon: 'camiseta' },
    { to: '/jugador/perfil', label: 'Mi perfil', icon: 'usuario' },
  ],
};

export interface SidebarProps {
  role: Role;
  /** Se invoca al navegar (para cerrar el drawer en móvil). */
  onNavigate?: () => void;
}

/** Menú lateral según rol; activo con `menu-active` + acento de color. */
export function Sidebar({ role, onNavigate }: SidebarProps) {
  const items = MENU_BY_ROLE[role];
  const { settings } = useSettings();

  return (
    <aside className="club-sidebar min-h-full w-64 flex flex-col">
      <div className="club-brand flex items-center gap-3 px-5 py-7">
        <ClubLogo className="w-14 h-14 shrink-0" />
        <div className="min-w-0">
          <p className="font-bold leading-tight truncate text-white">{settings.teamName}</p>
          <p className="text-xs text-white/45 mt-1">
            {role === 'admin' ? 'Administración' : 'Zona del jugador'}
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto scroll-slim p-3">
        <ul className="menu w-full gap-1">
          <li className="menu-title text-[10px] uppercase tracking-[.2em] text-white/35 mb-3">
            Tu centro de juego
          </li>
          {items.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  [
                    'club-nav-link flex items-center gap-3',
                    isActive ? 'club-nav-active font-semibold' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')
                }
              >
                <Icon name={item.icon} size={18} />
                <span className="truncate">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="sidebar-season mx-4 mb-5 p-4">
        <Icon name="futbol" size={23} />
        <div><p className="text-[10px] uppercase tracking-[.16em] text-white/45">Una misma camiseta</p><p className="text-xs text-white mt-1">Temporada {settings.season} · {settings.profile.name}</p></div>
      </div>
    </aside>
  );
}
