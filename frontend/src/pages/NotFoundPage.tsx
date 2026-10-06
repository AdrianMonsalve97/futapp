import { Link } from 'react-router-dom';
import { Button } from '../atoms/Button';
import { EmptyState } from '../atoms/EmptyState';
import { useAuth } from '../context/AuthContext';

/** Ruta `*`: página no encontrada. */
export function NotFoundPage() {
  const { user } = useAuth();
  const home = user ? (user.role === 'admin' ? '/admin/inicio' : '/jugador/inicio') : '/login';

  return (
    <div className="min-h-full grid place-items-center bg-base-200 px-4">
      <div className="text-center">
        <p className="text-6xl font-bold text-primary">404</p>
        <EmptyState
          title="Página no encontrada"
          message="La ruta que intentás abrir no existe en el portal."
          icon="search"
          action={
            <Link to={home}>
              <Button>Volver al inicio</Button>
            </Link>
          }
        />
      </div>
    </div>
  );
}
