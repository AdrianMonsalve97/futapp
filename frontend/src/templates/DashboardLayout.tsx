import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../organisms/Sidebar';
import { Topbar } from '../organisms/Topbar';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useLocation } from 'react-router-dom';

/**
 * Layout autenticado (SPEC §10.3): drawer de DaisyUI con sidebar fijo
 * (`lg:drawer-open`), topbar y contenido con `<Outlet/>`.
 */
export function DashboardLayout() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const { settings } = useSettings();
  const role = user?.role ?? 'player';
  const location = useLocation();

  return (
    <div className="drawer lg:drawer-open min-h-full">
      <input
        type="checkbox"
        className="drawer-toggle"
        checked={open}
        onChange={(event) => setOpen(event.target.checked)}
        aria-label="Abrir o cerrar menú lateral"
      />

      <div className="drawer-content dashboard-surface flex flex-col min-h-full min-w-0">
        <Topbar onMenuClick={() => setOpen(true)} />
        <main className="flex-1 w-full min-w-0 max-w-[1500px] mx-auto px-4 sm:px-7 py-6">
          <div key={location.pathname} className="page-enter"><Outlet /></div>
        </main>
        <footer className="px-6 py-4 text-center text-xs text-base-content/40">
          {settings.teamName} · Temporada {settings.season} · Hecho para vivir el fútbol
        </footer>
      </div>

      <div className="drawer-side z-40">
        <label className="drawer-overlay" onClick={() => setOpen(false)} aria-label="Cerrar menú lateral" />
        <Sidebar role={role} onNavigate={() => setOpen(false)} />
      </div>
    </div>
  );
}
