import { useAuth } from '../context/AuthContext';
import { Avatar } from '../atoms/Avatar';
import { Badge } from '../atoms/Badge';
import { Icon } from '../atoms/Icon';

export interface TopbarProps {
  /** Abre el drawer en móvil. */
  onMenuClick: () => void;
}

/** Barra superior: menú móvil, nombre/rol del usuario y cierre de sesión. */
export function Topbar({ onMenuClick }: TopbarProps) {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-base-100/95 backdrop-blur border-b border-base-200">
      <div className="navbar min-h-14 px-3 sm:px-4 max-w-7xl mx-auto">
        <div className="flex-1 gap-2">
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-circle lg:hidden"
            onClick={onMenuClick}
            aria-label="Abrir menú"
          >
            <Icon name="menu" size={20} />
          </button>
          <span className="hidden sm:inline font-semibold text-base-content/70">
            Portal del equipo
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <>
              <div className="hidden sm:flex items-center gap-2">
                <Avatar name={user.fullName} src={user.avatarUrl} size="sm" />
                <div className="leading-tight">
                  <p className="text-sm font-semibold">{user.fullName}</p>
                  <p className="text-xs text-base-content/50">{user.email}</p>
                </div>
                <Badge tone={user.role === 'admin' ? 'primary' : 'info'} size="xs">
                  {user.role === 'admin' ? 'Admin' : 'Jugador'}
                </Badge>
              </div>
              <div className="sm:hidden">
                <Avatar name={user.fullName} src={user.avatarUrl} size="sm" />
              </div>
            </>
          ) : null}
          <button type="button" className="btn btn-ghost btn-sm gap-2" onClick={logout}>
            <Icon name="logout" size={17} />
            <span className="hidden sm:inline">Cerrar sesión</span>
          </button>
        </div>
      </div>
    </header>
  );
}
