import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../organisms/Sidebar';
import { Topbar } from '../organisms/Topbar';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';

/**
 * Layout autenticado (SPEC §10.3): drawer de DaisyUI con sidebar fijo
 * (`lg:drawer-open`), topbar y contenido con `<Outlet/>`.
 */
export function DashboardLayout() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const { settings } = useSettings();
  const role = user?.role ?? 'player';

  return (
    <div className="drawer lg:drawer-open min-h-full">
      <input
        type="checkbox"
        className="drawer-toggle"
        checked={open}
        onChange={(event) => setOpen(event.target.checked)}
        aria-label="Abrir o cerrar menú lateral"
      />

      <div className="drawer-content flex flex-col min-h-full bg-base-200">
        <Topbar onMenuClick={() => setOpen(true)} />
        <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 py-5">
          <Outlet />
        </main>
        <footer className="px-6 py-4 text-center text-xs text-base-content/40">
          {settings.teamName} · {settings.profile.name} ({settings.profile.matchMinutes}') · UI en español
          · datos del contrato API (SPEC §7 / §12)
        </footer>
      </div>

      <div className="drawer-side z-40">
        <label className="drawer-overlay" onClick={() => setOpen(false)} aria-label="Cerrar menú lateral" />
        <Sidebar role={role} onNavigate={() => setOpen(false)} />
      </div>
    </div>
  );
}
