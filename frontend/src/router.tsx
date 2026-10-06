// Router de la aplicación: rutas y guards exactos de docs/SPEC.md §10.3.

import type { ReactNode } from 'react';
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
import { AiPage } from './pages/admin/AiPage';
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
        <Route path="/jugador/inicio" element={playerRoute(<PlayerDashboardPage />)} />
        <Route path="/jugador/inscripcion" element={playerRoute(<MyInscriptionPage />)} />
        <Route path="/jugador/uniformes" element={playerRoute(<MyUniformsPage />)} />
        <Route path="/jugador/partidos" element={playerRoute(<PlayerMatchesPage />)} />
        <Route path="/jugador/partidos/:id" element={playerRoute(<MatchDetailPage />)} />
        <Route path="/jugador/perfil" element={playerRoute(<MyProfilePage />)} />
        <Route path="/jugador/estadisticas" element={playerRoute(<MyStatsPage />)} />
        <Route path="/jugador/ia" element={playerRoute(<MyAiPage />)} />

        {/* Admin */}
        <Route path="/admin/inicio" element={adminRoute(<AdminDashboardPage />)} />
        <Route path="/admin/jugadores" element={adminRoute(<PlayersPage />)} />
        <Route path="/admin/jugadores/:id" element={adminRoute(<PlayerDetailPage />)} />
        <Route path="/admin/inscripciones" element={adminRoute(<InscriptionsPage />)} />
        <Route path="/admin/uniformes" element={adminRoute(<UniformsPage />)} />
        <Route path="/admin/partidos" element={adminRoute(<AdminMatchesPage />)} />
        <Route path="/admin/partidos/:id" element={adminRoute(<MatchBuilderPage />)} />
        <Route path="/admin/sanciones" element={adminRoute(<SanctionsPage />)} />
        <Route path="/admin/estadisticas" element={adminRoute(<StatsPage />)} />
        <Route path="/admin/ia" element={adminRoute(<AiPage />)} />
        <Route path="/admin/configuracion" element={adminRoute(<SettingsPage />)} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
