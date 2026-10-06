import { Outlet } from 'react-router-dom';
import { Icon } from '../atoms/Icon';

/** Layout de rutas públicas: tarjeta centrada con marca del club. */
export function AuthLayout() {
  return (
    <div className="min-h-full flex flex-col items-center justify-center bg-base-200 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary text-primary-content grid place-items-center shadow-lg mb-3">
            <Icon name="futbol" size={34} />
          </div>
          <h1 className="text-2xl font-bold">Club Portal</h1>
          <p className="text-sm text-base-content/60">
            Portal administrativo del equipo · inscripciones, partidos, IA y más
          </p>
        </div>

        <Outlet />

        <p className="text-center text-xs text-base-content/50 mt-6">
          © {new Date().getFullYear()} Club Portal · Sistema interno del equipo
        </p>
      </div>
    </div>
  );
}
