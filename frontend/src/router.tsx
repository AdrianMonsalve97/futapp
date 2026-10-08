// Router de la aplicación: rutas y guards exactos de docs/SPEC.md §10.3.

import { lazy, Suspense, type ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AuthLayout } from './templates/AuthLayout';
import { DashboardLayout } from './templates/DashboardLayout';
import { HomeRedirect, ProtectedRoute } from './templates/ProtectedRoute';

import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { NotFoundPage } from './pages/NotFoundPage';

import { PlayerDashboardPage } from './pages/player/PlayerDashboardPage';
import { MyInscriptionPage } from './pages/player/MyInscriptionPage';
import { MyUniformsPage } from './pages/player/MyUniformsPage';
import { MatchesPage as PlayerMatchesPage } from './pages/player/MatchesPage';
import { MatchDetailPage } from './pages/player/MatchDetailPage';
import { MyProfilePage } from './pages/player/MyProfilePage';
import { MyStatsPage } from './pages/player/MyStatsPage';
import { MyAiPage } from './pages/player/MyAiPage';

import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { PlayersPage } from './pages/admin/PlayersPage';
import { PlayerDetailPage } from './pages/admin/PlayerDetailPage';
import { InscriptionsPage } from './pages/admin/InscriptionsPage';
import { UniformsPage } from './pages/admin/UniformsPage';
import { MatchesPage as AdminMatchesPage } from './pages/admin/MatchesPage';
import { MatchBuilderPage } from './pages/admin/MatchBuilderPage';
import { SanctionsPage } from './pages/admin/SanctionsPage';
import { StatsPage } from './pages/admin/StatsPage';
const AiPage = lazy(() => import('./pages/admin/AiPage').then(module=>({default:module.AiPage})));
const PaymentReceiptsPage = lazy(() => import('./pages/admin/PaymentReceiptsPage').then(module=>({default:module.PaymentReceiptsPage})));
const NotificationsPage = lazy(() => import('./pages/admin/NotificationsPage').then(module=>({default:module.NotificationsPage})));
const TournamentsPage = lazy(() => import('./pages/TournamentsPage').then(module => ({ default: module.TournamentsPage })));
const BroadcastsPage = lazy(() => import('./pages/BroadcastsPage').then(module => ({ default: module.BroadcastsPage })));
const broadcastsPage = () => <Suspense fallback={<p className="py-10 text-center">Cargando transmisiones…</p>}><BroadcastsPage /></Suspense>;
const tournamentPage = () => <Suspense fallback={<p className="py-10 text-center">Cargando torneos…</p>}><TournamentsPage /></Suspense>;
import { SettingsPage } from './pages/admin/SettingsPage';

/** Guard de rol envolviendo el contenido de una ruta del dashboard. */
function playerRoute(element: ReactNode) {
  return <ProtectedRoute role="player">{element}</ProtectedRoute>;
}

function adminRoute(element: ReactNode) {
  return <ProtectedRoute role="admin">{element}</ProtectedRoute>;
}

/** Árbol de rutas (SPEC §10.3). `/` redirige por rol; `*` → 404. */
export function AppRouter() {
  return (
    <Routes>
      {/* Públicas */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/registro" element={<RegisterPage />} />
      </Route>

      {/* Redirección por rol */}
      <Route path="/" element={<HomeRedirect />} />

      {/* Jugador */}
      <Route element={<DashboardLayout />}>
        <Route path="/jugador/torneos" element={playerRoute(tournamentPage())} />
        <Route path="/jugador/torneos/:id" element={playerRoute(tournamentPage())} />
        <Route path="/jugador/inicio" element={playerRoute(<PlayerDashboardPage />)} />
        <Route path="/jugador/inscripcion" element={playerRoute(<MyInscriptionPage />)} />
        <Route path="/jugador/uniformes" element={playerRoute(<MyUniformsPage />)} />
        <Route path="/jugador/partidos" element={playerRoute(<PlayerMatchesPage />)} />
        <Route path="/jugador/transmisiones" element={playerRoute(broadcastsPage())} />
        <Route path="/jugador/partidos/:id" element={playerRoute(<MatchDetailPage />)} />
        <Route path="/jugador/perfil" element={playerRoute(<MyProfilePage />)} />
        <Route path="/jugador/estadisticas" element={playerRoute(<MyStatsPage />)} />
        <Route path="/jugador/ia" element={playerRoute(<MyAiPage />)} />

        {/* Admin */}
        <Route path="/admin/torneos" element={adminRoute(tournamentPage())} />
        <Route path="/admin/torneos/:id" element={adminRoute(tournamentPage())} />
        <Route path="/admin/inicio" element={adminRoute(<AdminDashboardPage />)} />
        <Route path="/admin/jugadores" element={adminRoute(<PlayersPage />)} />
        <Route path="/admin/jugadores/:id" element={adminRoute(<PlayerDetailPage />)} />
        <Route path="/admin/inscripciones" element={adminRoute(<InscriptionsPage />)} />
        <Route path="/admin/uniformes" element={adminRoute(<UniformsPage />)} />
        <Route path="/admin/partidos" element={adminRoute(<AdminMatchesPage />)} />
        <Route path="/admin/transmisiones" element={adminRoute(broadcastsPage())} />
        <Route path="/admin/partidos/:id" element={adminRoute(<MatchBuilderPage />)} />
        <Route path="/admin/sanciones" element={adminRoute(<SanctionsPage />)} />
        <Route path="/admin/estadisticas" element={adminRoute(<StatsPage />)} />
        <Route path="/admin/ia" element={adminRoute(<Suspense fallback={<p>Cargando análisis…</p>}><AiPage /></Suspense>)} />
        <Route path="/admin/pagos-qr" element={adminRoute(<Suspense fallback={<p>Cargando soportes…</p>}><PaymentReceiptsPage /></Suspense>)} />
        <Route path="/admin/notificaciones" element={adminRoute(<Suspense fallback={<p>Cargando notificaciones…</p>}><NotificationsPage /></Suspense>)} />
        <Route path="/admin/configuracion" element={adminRoute(<SettingsPage />)} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
