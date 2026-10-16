import { NavLink } from "react-router-dom";
import { Icon, type IconName } from "../atoms/Icon";
import type { Role } from "../types/api";

export function ClubMobileNavigation({ role }: { role: Role }) {
  const base = role === "admin" ? "/admin" : "/jugador";
  const items: { path: string; title: string; icon: IconName }[] = [
    { path: "inicio", title: "Club", icon: "shield" },
    { path: "partidos", title: "Partidos", icon: "futbol" },
    {
      path: role === "admin" ? "pagos-qr" : "pagos",
      title: "Pagos",
      icon: "dinero",
    },
    { path: "uniformes", title: "Tienda", icon: "camiseta" },
    { path: "posiciones", title: "Tabla", icon: "trofeo" },
  ];
  return (
    <nav className="club-mobile-dock" aria-label="Accesos principales">
      {items.map((item) => (
        <NavLink
          key={item.path}
          to={`${base}/${item.path}`}
          className={({ isActive }) => (isActive ? "dock-active" : "")}
        >
          <Icon name={item.icon} size={20} />
          <span>{item.title}</span>
        </NavLink>
      ))}
    </nav>
  );
}
