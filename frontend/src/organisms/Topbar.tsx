import { useAuth } from '../context/AuthContext';
import { Avatar } from '../atoms/Avatar';
import { Badge } from '../atoms/Badge';
import { Icon } from '../atoms/Icon';
import { useAppearance } from '../context/AppearanceContext';

export interface TopbarProps {
  /** Abre el drawer en móvil. */
  onMenuClick: () => void;
}

/** Barra superior: menú móvil, nombre/rol del usuario y cierre de sesión. */
export function Topbar({ onMenuClick }: TopbarProps) {
  const { user, logout } = useAuth();
  const { night, motion, toggleNight, toggleMotion } = useAppearance();

  return (
    <header className="club-topbar sticky top-0 z-30 bg-base-100/90 backdrop-blur-xl border-b border-base-200">
      <div className="navbar min-h-14 px-3 sm:px-4 max-w-7xl mx-auto">
        <div className="flex-1 min-w-0 gap-2">
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-circle lg:hidden"
            onClick={onMenuClick}
            aria-label="Abrir menú"
          >
            <Icon name="menu" size={20} />
          </button>
          <span className="hidden xl:inline font-semibold text-base-content/70">
            <span className="text-xs uppercase tracking-[.18em]">FutApp <span className="text-primary">/</span> Centro de juego</span>
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <button className="btn btn-ghost btn-sm appearance-button" type="button" onClick={toggleMotion} aria-label={motion ? 'Pausar animaciones' : 'Activar animaciones'} aria-pressed={!motion} title={motion ? 'Pausar animaciones' : 'Activar animaciones'}>{motion ? 'Ⅱ' : '▷'}</button>
          <button className="btn btn-ghost btn-sm appearance-button" type="button" onClick={toggleNight} aria-label={night ? 'Activar modo día' : 'Activar modo noche'} aria-pressed={night} title={night ? 'Modo día' : 'Modo noche'}>{night ? '☀' : '☾'}</button>
          {user ? (
            <>
              <div className="hidden md:flex min-w-0 items-center gap-2">
                <Avatar name={user.fullName} src={user.avatarUrl} size="sm" />
                <div className="leading-tight min-w-0 max-w-40 xl:max-w-48">
                  <p className="text-sm font-semibold truncate" title={user.fullName}>{user.fullName}</p>
                  <p className="text-xs text-base-content/50 truncate" title={user.email}>{user.email}</p>
                </div>
                <Badge tone={user.role === 'admin' ? 'primary' : 'info'} size="xs">
                  {user.role === 'admin' ? 'Admin' : 'Jugador'}
                </Badge>
              </div>
              <div className="md:hidden">
                <Avatar name={user.fullName} src={user.avatarUrl} size="sm" />
              </div>
            </>
          ) : null}
          <button type="button" className="btn btn-ghost btn-sm gap-2" aria-label="Cerrar sesión" onClick={logout}>
            <Icon name="logout" size={17} />
            <span className="hidden xl:inline">Cerrar sesión</span>
          </button>
        </div>
      </div>
    </header>
  );
}
