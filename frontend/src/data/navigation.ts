import type { IconName } from "../atoms/Icon";
import type { Role } from "../types/api";

export interface MenuItem {
  to: string;
  label: string;
  icon: IconName;
}

export const MENU_BY_ROLE: Record<Role, MenuItem[]> = {
  admin: [
    { to: "/admin/inicio", label: "Inicio", icon: "chart" },
    {
      to: "/admin/plantilla",
      label: "Plantilla y rendimiento",
      icon: "usuarios",
    },
    { to: "/admin/jugadores", label: "Jugadores", icon: "usuarios" },
    { to: "/admin/inscripciones", label: "Inscripciones", icon: "dinero" },
    { to: "/admin/pagos-qr", label: "Pagos QR y soportes", icon: "dinero" },
    {
      to: "/admin/notificaciones",
      label: "Notificaciones y bot",
      icon: "clipboard",
    },
    { to: "/admin/uniformes", label: "Uniformes", icon: "camiseta" },
    { to: "/admin/torneos", label: "Torneos y normativa", icon: "trofeo" },
    { to: "/admin/partidos", label: "Partidos", icon: "futbol" },
    { to: "/admin/posiciones", label: "Tabla de posiciones", icon: "chart" },
    { to: "/admin/transmisiones", label: "Transmisiones", icon: "video" },
    { to: "/admin/sanciones", label: "Sanciones", icon: "tarjeta" },
    { to: "/admin/estadisticas", label: "Estadísticas", icon: "clipboard" },
    { to: "/admin/ia", label: "Inteligencia artificial", icon: "sparkles" },
    { to: "/admin/configuracion", label: "Configuración", icon: "settings" },
  ],
  player: [
    { to: "/jugador/inicio", label: "Inicio", icon: "chart" },
    {
      to: "/jugador/plantilla",
      label: "Plantilla y rendimiento",
      icon: "usuarios",
    },
    { to: "/jugador/torneos", label: "Torneos y normativa", icon: "trofeo" },
    { to: "/jugador/partidos", label: "Partidos", icon: "futbol" },
    { to: "/jugador/posiciones", label: "Tabla de posiciones", icon: "chart" },
    { to: "/jugador/pagos", label: "Mis pagos y soportes", icon: "dinero" },
    { to: "/jugador/transmisiones", label: "Transmisiones", icon: "video" },
    {
      to: "/jugador/estadisticas",
      label: "Mis estadísticas",
      icon: "clipboard",
    },
    { to: "/jugador/ia", label: "Rendimiento IA", icon: "sparkles" },
    { to: "/jugador/inscripcion", label: "Mi inscripción", icon: "dinero" },
    { to: "/jugador/uniformes", label: "Tienda y pedidos", icon: "camiseta" },
    { to: "/jugador/perfil", label: "Mi perfil", icon: "usuario" },
  ],
};
