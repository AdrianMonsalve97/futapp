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
    { to: '/admin/uniformes', label: 'Uniformes', icon: 'camiseta' },
    { to: '/admin/partidos', label: 'Partidos', icon: 'futbol' },
    { to: '/admin/sanciones', label: 'Sanciones', icon: 'tarjeta' },
    { to: '/admin/estadisticas', label: 'Estadísticas', icon: 'clipboard' },
    { to: '/admin/ia', label: 'Inteligencia artificial', icon: 'sparkles' },
    { to: '/admin/configuracion', label: 'Configuración', icon: 'settings' },
  ],
  player: [
    { to: '/jugador/inicio', label: 'Inicio', icon: 'chart' },
    { to: '/jugador/partidos', label: 'Partidos', icon: 'futbol' },
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
    <aside className="min-h-full w-72 bg-base-100 border-r border-base-200 flex flex-col">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-base-200">
        <div className="w-10 h-10 rounded-xl bg-primary text-primary-content grid place-items-center shrink-0">
          <Icon name="futbol" size={22} />
        </div>
        <div className="min-w-0">
          <p className="font-bold leading-tight truncate">{settings.teamName}</p>
          <p className="text-xs text-base-content/50">
            {role === 'admin' ? 'Administración' : 'Zona del jugador'}
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto scroll-slim p-3">
        <ul className="menu w-full gap-1">
          <li className="menu-title text-[11px] uppercase tracking-wider text-base-content/40 mb-1">
            Secciones
          </li>
          {items.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-3 rounded-btn',
                    isActive ? 'menu-active bg-primary/10 text-primary font-semibold' : '',
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

      <div className="px-5 py-4 border-t border-base-200 text-[11px] text-base-content/40">
        Temporada {settings.season} · {settings.profile.name} · datos en vivo del backend
      </div>
    </aside>
  );
}
