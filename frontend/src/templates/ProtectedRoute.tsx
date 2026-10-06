import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Spinner } from '../atoms/Spinner';

export interface ProtectedRouteProps {
  role?: 'admin' | 'player';
  children: ReactNode;
}

function homeFor(role: 'admin' | 'player' | undefined): string {
  return role === 'admin' ? '/admin/inicio' : '/jugador/inicio';
}

/**
 * Guard de sesión/rol (SPEC §10.3):
 * - cargando → spinner
 * - sin token → `/login`
 * - rol distinto → redirect al home del usuario
 */
export function ProtectedRoute({ role, children }: ProtectedRouteProps) {
  const { user, token, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-full grid place-items-center bg-base-200">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-base-content/60">Verificando sesión…</p>
        </div>
      </div>
    );
  }

  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (role && user.role !== role) {
    return <Navigate to={homeFor(user.role)} replace />;
  }

  return <>{children}</>;
}

/** Redirige `/` al home según rol (o a `/login` si no hay sesión). */
export function HomeRedirect() {
  const { user, token, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-full grid place-items-center bg-base-200">
        <Spinner size="lg" />
      </div>
    );
  }
  if (!token || !user) return <Navigate to="/login" replace />;
  return <Navigate to={homeFor(user.role)} replace />;
}
