import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { ClubNavigation } from "../organisms/ClubNavigation";
import { useSettings } from "../context/SettingsContext";

export function DashboardLayout() {
  const { settings } = useSettings(),
    location = useLocation();
  const main = useRef<HTMLElement>(null),
    previousPath = useRef(location.pathname);
  useEffect(() => {
    if (previousPath.current !== location.pathname) {
      window.scrollTo({ top: 0, behavior: "instant" });
      main.current?.focus({ preventScroll: true });
      previousPath.current = location.pathname;
    }
  }, [location.pathname]);
  return (
    <div className="club-shell dashboard-surface">
      <a href="#club-content" className="club-skip-link">
        Saltar al contenido
      </a>
      <ClubNavigation />
      <main id="club-content" ref={main} tabIndex={-1} className="club-content">
        <div key={location.pathname} className="page-enter">
          <Outlet />
        </div>
      </main>
      <footer className="club-footer">
        {settings.teamName} · Temporada {settings.season} · Hecho para vivir el
        fútbol
      </footer>
    </div>
  );
}
