// Router de la aplicación: rutas y guards exactos de docs/SPEC.md §10.3.

import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { AuthLayout } from "./templates/AuthLayout";
import { DashboardLayout } from "./templates/DashboardLayout";
import { HomeRedirect, ProtectedRoute } from "./templates/ProtectedRoute";

import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
const ForgotPasswordPage = lazy(() =>
  import("./pages/auth/PasswordRecoveryPage").then((module) => ({
    default: module.ForgotPasswordPage,
  })),
);
const ResetPasswordPage = lazy(() =>
  import("./pages/auth/PasswordRecoveryPage").then((module) => ({
    default: module.ResetPasswordPage,
  })),
);
import { NotFoundPage } from "./pages/NotFoundPage";

const PlayerDashboardPage = lazy(() =>
  import("./pages/player/PlayerDashboardPage").then((module) => ({
    default: module.PlayerDashboardPage,
  })),
);
import { MyInscriptionPage } from "./pages/player/MyInscriptionPage";
const MyUniformsPage = lazy(() =>
  import("./pages/player/MyUniformsPage").then((module) => ({
    default: module.MyUniformsPage,
  })),
);
const PlayerMatchesPage = lazy(() =>
  import("./pages/player/MatchesPage").then((module) => ({
    default: module.MatchesPage,
  })),
);
const MatchDetailPage = lazy(() =>
  import("./pages/player/MatchDetailPage").then((module) => ({
    default: module.MatchDetailPage,
  })),
);
import { MyProfilePage } from "./pages/player/MyProfilePage";
import { MyStatsPage } from "./pages/player/MyStatsPage";
import { MyAiPage } from "./pages/player/MyAiPage";

const AdminDashboardPage = lazy(() =>
  import("./pages/admin/AdminDashboardPage").then((module) => ({
    default: module.AdminDashboardPage,
  })),
);
const SquadPage = lazy(() =>
  import("./pages/SquadPage").then((module) => ({ default: module.SquadPage })),
);
const StandingsPage = lazy(() =>
  import("./pages/StandingsPage").then((module) => ({
    default: module.StandingsPage,
  })),
);
const PaymentsPage = lazy(() =>
  import("./pages/player/PaymentsPage").then((module) => ({
    default: module.PaymentsPage,
  })),
);
const PlayerDetailPage = lazy(() =>
  import("./pages/admin/PlayerDetailPage").then((module) => ({
    default: module.PlayerDetailPage,
  })),
);
import { InscriptionsPage } from "./pages/admin/InscriptionsPage";
const UniformsPage = lazy(() =>
  import("./pages/admin/UniformsPage").then((module) => ({
    default: module.UniformsPage,
  })),
);
const AdminMatchesPage = lazy(() =>
  import("./pages/admin/MatchesPage").then((module) => ({
    default: module.MatchesPage,
  })),
);
const MatchBuilderPage = lazy(() =>
  import("./pages/admin/MatchBuilderPage").then((module) => ({
    default: module.MatchBuilderPage,
  })),
);
import { SanctionsPage } from "./pages/admin/SanctionsPage";
import { StatsPage } from "./pages/admin/StatsPage";
const AiPage = lazy(() =>
  import("./pages/admin/AiPage").then((module) => ({ default: module.AiPage })),
);
const PaymentReceiptsPage = lazy(() =>
  import("./pages/admin/PaymentReceiptsPage").then((module) => ({
    default: module.PaymentReceiptsPage,
  })),
);
const NotificationsPage = lazy(() =>
  import("./pages/admin/NotificationsPage").then((module) => ({
    default: module.NotificationsPage,
  })),
);
const TournamentsPage = lazy(() =>
  import("./pages/TournamentsPage").then((module) => ({
    default: module.TournamentsPage,
  })),
);
const BroadcastsPage = lazy(() =>
  import("./pages/BroadcastsPage").then((module) => ({
    default: module.BroadcastsPage,
  })),
);
const broadcastsPage = () => (
  <Suspense
    fallback={<p className="py-10 text-center">Cargando transmisiones…</p>}
  >
    <BroadcastsPage />
  </Suspense>
);
const tournamentPage = () => (
  <Suspense fallback={<p className="py-10 text-center">Cargando torneos…</p>}>
    <TournamentsPage />
  </Suspense>
);
import { SettingsPage } from "./pages/admin/SettingsPage";

/** Guard de rol envolviendo el contenido de una ruta del dashboard. */
function playerRoute(element: ReactNode) {
  return <ProtectedRoute role="player">{element}</ProtectedRoute>;
}

function adminRoute(element: ReactNode) {
  return <ProtectedRoute role="admin">{element}</ProtectedRoute>;
}

/** Conserva los enlaces a fichas publicados antes de unificar la plantilla. */
function PlayersRedirect() {
  const { id } = useParams();
  return (
    <Navigate
      replace
      to={
        id
          ? `/admin/plantilla/${encodeURIComponent(id)}`
          : "/admin/plantilla?vista=management"
      }
    />
  );
}

/** Árbol de rutas (SPEC §10.3). `/` redirige por rol; `*` → 404. */
export function AppRouter() {
  return (
    <Routes>
      {/* Públicas */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/registro" element={<RegisterPage />} />
        <Route
          path="/recuperar-contrasena"
          element={
            <Suspense fallback={<p>Cargando recuperación…</p>}>
              <ForgotPasswordPage />
            </Suspense>
          }
        />
        <Route
          path="/restablecer-contrasena"
          element={
            <Suspense fallback={<p>Cargando recuperación…</p>}>
              <ResetPasswordPage />
            </Suspense>
          }
        />
      </Route>

      {/* Redirección por rol */}
      <Route path="/" element={<HomeRedirect />} />

      {/* Jugador */}
      <Route element={<DashboardLayout />}>
        <Route
          path="/jugador/torneos"
          element={playerRoute(tournamentPage())}
        />
        <Route
          path="/jugador/torneos/:id"
          element={playerRoute(tournamentPage())}
        />
        <Route
          path="/jugador/inicio"
          element={playerRoute(
            <Suspense
              fallback={<p className="py-10 text-center">Entrando al club…</p>}
            >
              <PlayerDashboardPage />
            </Suspense>,
          )}
        />
        <Route
          path="/jugador/posiciones"
          element={playerRoute(
            <Suspense
              fallback={<p className="py-10 text-center">Cargando la liga…</p>}
            >
              <StandingsPage />
            </Suspense>,
          )}
        />
        <Route
          path="/jugador/pagos"
          element={playerRoute(
            <Suspense
              fallback={
                <p className="py-10 text-center">Cargando tus pagos…</p>
              }
            >
              <PaymentsPage />
            </Suspense>,
          )}
        />
        <Route
          path="/jugador/inscripcion"
          element={playerRoute(<MyInscriptionPage />)}
        />
        <Route
          path="/jugador/uniformes"
          element={playerRoute(
            <Suspense
              fallback={<p className="py-10 text-center">Cargando tienda…</p>}
            >
              <MyUniformsPage />
            </Suspense>,
          )}
        />
        <Route
          path="/jugador/partidos"
          element={playerRoute(
            <Suspense fallback={<p>Cargando partido…</p>}>
              <PlayerMatchesPage />
            </Suspense>,
          )}
        />
        <Route
          path="/jugador/transmisiones"
          element={playerRoute(broadcastsPage())}
        />
        <Route
          path="/jugador/partidos/:id"
          element={playerRoute(
            <Suspense fallback={<p>Cargando partido…</p>}>
              <MatchDetailPage />
            </Suspense>,
          )}
        />
        <Route
          path="/jugador/perfil"
          element={playerRoute(<MyProfilePage />)}
        />
        <Route
          path="/jugador/estadisticas"
          element={playerRoute(<MyStatsPage />)}
        />
        <Route path="/jugador/ia" element={playerRoute(<MyAiPage />)} />

        <Route
          path="/jugador/plantilla"
          element={playerRoute(
            <Suspense fallback={<p>Cargando plantilla…</p>}>
              <SquadPage />
            </Suspense>,
          )}
        />
        <Route
          path="/admin/plantilla"
          element={adminRoute(
            <Suspense fallback={<p>Cargando plantilla…</p>}>
              <SquadPage />
            </Suspense>,
          )}
        />
        {/* Admin */}
        <Route path="/admin/torneos" element={adminRoute(tournamentPage())} />
        <Route
          path="/admin/torneos/:id"
          element={adminRoute(tournamentPage())}
        />
        <Route
          path="/admin/inicio"
          element={adminRoute(
            <Suspense
              fallback={<p className="py-10 text-center">Entrando al club…</p>}
            >
              <AdminDashboardPage />
            </Suspense>,
          )}
        />
        <Route
          path="/admin/posiciones"
          element={adminRoute(
            <Suspense
              fallback={<p className="py-10 text-center">Cargando la liga…</p>}
            >
              <StandingsPage />
            </Suspense>,
          )}
        />
        <Route
          path="/admin/plantilla/:id"
          element={adminRoute(
            <Suspense fallback={<p>Cargando ficha…</p>}>
              <PlayerDetailPage />
            </Suspense>,
          )}
        />
        <Route
          path="/admin/jugadores"
          element={adminRoute(<PlayersRedirect />)}
        />
        <Route
          path="/admin/jugadores/:id"
          element={adminRoute(<PlayersRedirect />)}
        />
        <Route
          path="/admin/inscripciones"
          element={adminRoute(<InscriptionsPage />)}
        />
        <Route
          path="/admin/uniformes"
          element={adminRoute(
            <Suspense
              fallback={
                <p className="py-10 text-center">Cargando colección…</p>
              }
            >
              <UniformsPage />
            </Suspense>,
          )}
        />
        <Route
          path="/admin/partidos"
          element={adminRoute(
            <Suspense fallback={<p>Cargando partido…</p>}>
              <AdminMatchesPage />
            </Suspense>,
          )}
        />
        <Route
          path="/admin/transmisiones"
          element={adminRoute(broadcastsPage())}
        />
        <Route
          path="/admin/partidos/:id"
          element={adminRoute(
            <Suspense fallback={<p>Cargando partido…</p>}>
              <MatchBuilderPage />
            </Suspense>,
          )}
        />
        <Route
          path="/admin/sanciones"
          element={adminRoute(<SanctionsPage />)}
        />
        <Route path="/admin/estadisticas" element={adminRoute(<StatsPage />)} />
        <Route
          path="/admin/ia"
          element={adminRoute(
            <Suspense fallback={<p>Cargando análisis…</p>}>
              <AiPage />
            </Suspense>,
          )}
        />
        <Route
          path="/admin/pagos-qr"
          element={adminRoute(
            <Suspense fallback={<p>Cargando soportes…</p>}>
              <PaymentReceiptsPage />
            </Suspense>,
          )}
        />
        <Route
          path="/admin/notificaciones"
          element={adminRoute(
            <Suspense fallback={<p>Cargando notificaciones…</p>}>
              <NotificationsPage />
            </Suspense>,
          )}
        />
        <Route
          path="/admin/configuracion"
          element={adminRoute(<SettingsPage />)}
        />
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
