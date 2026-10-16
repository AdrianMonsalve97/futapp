import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { useAppearance } from "../context/AppearanceContext";
import { useClubNavigation } from "../hooks/useClubNavigation";
import { MENU_BY_ROLE } from "../data/navigation";
import { ClubLogo } from "../atoms/ClubLogo";
import { Icon } from "../atoms/Icon";

const PRIMARY = ["inicio", "plantilla", "partidos", "posiciones", "uniformes"];
const SHORT_LABELS: Record<string, string> = {
  inicio: "Inicio",
  plantilla: "Plantilla",
  partidos: "Partidos",
  posiciones: "La liga",
  uniformes: "Tienda",
};

export function ClubNavigation() {
  const { user, logout } = useAuth(),
    { settings } = useSettings(),
    appearance = useAppearance();
  const state = useClubNavigation(),
    base = user?.role === "admin" ? "/admin" : "/jugador";
  const items = MENU_BY_ROLE[user?.role ?? "player"];
  const primary = PRIMARY.map(
    (key) => items.find((item) => item.to === `${base}/${key}`)!,
  );
  const secondary = items.filter(
    (item) => !PRIMARY.includes(item.to.split("/")[2]),
  );
  return (
    <header className="club-navigation" ref={state.header}>
      <div className="club-navigation-inner">
        <Link
          className="club-navigation-brand"
          to={`${base}/inicio`}
          onClick={state.close}
        >
          <ClubLogo className="w-11 h-11" />
          <span>
            <strong>{settings.teamName}</strong>
            <small>FÚTBOL · AMISTAD · PASIÓN</small>
          </span>
        </Link>
        <button
          type="button"
          className="club-navigation-toggle btn btn-ghost btn-sm"
          aria-label={state.open ? "Cerrar navegación" : "Abrir navegación"}
          aria-expanded={state.open}
          aria-controls="club-navigation-links"
          onClick={() => state.setOpen(!state.open)}
        >
          <Icon name={state.open ? "close" : "menu"} size={22} />
        </button>
        <nav
          id="club-navigation-links"
          className={`club-navigation-links ${state.open ? "is-open" : ""}`}
          aria-label="Navegación principal"
        >
          {primary.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={state.close}
              className={({ isActive }) => (isActive ? "is-active" : "")}
            >
              {SHORT_LABELS[item.to.split("/")[2]]}
            </NavLink>
          ))}
          <details className="club-navigation-more" ref={state.more}>
            <summary>
              Más <span aria-hidden="true">⌄</span>
            </summary>
            <div className="club-navigation-menu">
              <p>
                {user?.role === "admin"
                  ? "Administrar el club"
                  : "Mi club y mi cuenta"}
              </p>
              {secondary.map((item) => (
                <NavLink key={item.to} to={item.to} onClick={state.close}>
                  <Icon name={item.icon} size={16} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </details>
        </nav>
        <div className="club-navigation-account">
          <span className="club-navigation-user" title={user?.fullName}>
            {user?.fullName.split(" ")[0]}
            <small>{user?.role === "admin" ? "ADMIN" : "JUGADOR"}</small>
          </span>
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            onClick={appearance.toggleMotion}
            aria-label={
              appearance.motion ? "Pausar animaciones" : "Activar animaciones"
            }
            aria-pressed={!appearance.motion}
          >
            {appearance.motion ? "Ⅱ" : "▷"}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            onClick={appearance.toggleNight}
            aria-label={
              appearance.night ? "Activar modo día" : "Activar modo noche"
            }
          >
            {appearance.night ? "☀" : "☾"}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            onClick={logout}
            aria-label="Cerrar sesión"
          >
            <Icon name="logout" size={17} />
          </button>
        </div>
      </div>
    </header>
  );
}
