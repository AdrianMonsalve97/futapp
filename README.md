# ⚽ Club Portal — Portal Administrativo de Equipo de Fútbol

Aplicación full-stack para gestionar un equipo de fútbol: inscripciones y cobros, uniformes,
formaciones y estrategias del fin de semana, sanciones y tarjetas, estadísticas y un **modelo de IA**
(explicable, entrenable) que sugiere el XI ideal, predice calificaciones y proyecta resultados.

| Capa | Tecnología |
|---|---|
| Frontend | **React 19 + TypeScript + Vite 8**, **DaisyUI 5 / Tailwind CSS 4**, arquitectura **Atomic Design** |
| Backend | **Node.js + TypeScript + Express 5**, **arquitectura hexagonal** (puertos y adaptadores) |
| Base de datos | **SQLite** (`better-sqlite3`), archivo en `backend/data/portal.db` |
| Auth | JWT (HS256) + bcryptjs, roles `admin` y `player` |
| IA | Regresión lineal entrenada con gradiente descenso sobre las estadísticas del plantel + XI recomendado (greedy + mejora local) + probabilidad de resultado (logística) |

---

## 🚀 Puesta en marcha

Requisitos: **Node.js >= 24**.

```bash
npm install          # instala workspaces (backend + frontend)
npm run seed         # crea backend/data/portal.db con datos de demostración
npm run dev          # backend :4000  +  frontend :5173
```

Abrí **http://localhost:5173**.

Otros comandos:

```bash
npm run dev:api      # solo API
npm run dev:web      # solo Vite
npm run build        # tsc (backend) + tsc && vite build (frontend)
npm run start        # API compilada (node dist/main.js)
npm run typecheck    # chequeo de tipos de ambos
```

### Usuarios demo

| Rol | Email | Contraseña |
|---|---|---|
| Administrador | `admin@club.com` | `Admin123!` |
| Jugador | `jugador01@club.com` … `jugador14@club.com` | `Jugador123!` |

También puedes registrar un jugador nuevo desde **/registro**.

---

## 🗂 Estructura

```
futbol-portal/
├── docs/SPEC.md          # Contrato técnico único (esquema SQL, API, modelo de IA, UI)
├── scripts/dev.mjs       # `npm run dev` sin dependencias externas
├── backend/              # API hexagonal
│   └── src/
│       ├── domain/            # entidades, errores, catálogo de formaciones, modelo de IA
│       ├── application/
│       │   ├── ports/in/       # puertos entrantes (casos de uso)
│       │   ├── ports/out/      # puertos salientes (repositorios)
│       │   └── services/       # lógica de negocio (sin Express ni SQL)
│       └── adapters/
│           ├── in/rest/        # Express: rutas, middlewares, error handler
│           └── out/persistence/ # SQLite: schema.sql, migrate, seed, repositorios
└── frontend/             # React + Atomic Design
    └── src/
        ├── atoms/        # botón, input, card, badge, modal…
        ├── molecules/    # form field, status badge, position badge…
        ├── organisms/    # sidebar, tablas, formation pitch, charts SVG, editors
        ├── templates/    # AuthLayout, DashboardLayout, PageHeader, ProtectedRoute
        └── pages/        # login, jugador/*, admin/*
```

### Reglas de la arquitectura hexagonal

1. `domain/` no depende de nadie.
2. `application/services/` depende solo de `domain/` y de los puertos; **nunca** de Express ni SQLite.
3. Los repositorios (`adapters/out`) **implementan** los puertos definidos en `application/ports/out`.
4. Las rutas (`adapters/in`) solo traducen HTTP ↔ casos de uso.
5. `container.ts` es el único lugar que une puertos con implementaciones concretas.

---

## 🔌 API (resumen)

Prefijo `/api`. Auth por `Authorization: Bearer <token>`. Errores: `{ "error": { "message": "..." } }`.

| Grupo | Ejemplos | Rol |
|---|---|---|
| Auth | `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/me` | público/auth |
| Yo (jugador) | `GET /api/me`, `PUT /api/me/profile`, `GET /api/me/inscription`, `GET /api/me/uniforms`, `POST /api/me/uniform-requests`, `GET /api/me/matches`, `GET /api/me/stats`, `GET /api/me/ai` | auth |
| Partidos | `GET/POST/PUT/DELETE /api/matches`, `PUT /api/matches/:id/lineup`, `POST /api/matches/:id/lineup/auto`, `POST /api/matches/:id/strategies`, `POST /api/matches/:id/stats` | auth / admin |
| Jugadores | `GET/POST/PUT/DELETE /api/players` | admin |
| Inscripciones | `GET /api/inscriptions`, `POST /api/inscriptions/:id/payments` | admin |
| Uniformes | `GET/POST/PUT /api/uniforms`, `POST /api/uniform-issues`, `PUT /api/uniform-requests/:id` | admin |
| Sanciones | `GET/POST/PUT/DELETE /api/sanctions` | admin |
| Estadísticas | `GET /api/stats`, `GET /api/team/stats` | auth |
| Dashboard | `GET /api/dashboard/admin`, `GET /api/dashboard/player` | admin / auth |
| IA | `GET /api/ai/insights`, `GET /api/ai/players/:id`, `GET /api/ai/model`, `POST /api/ai/model/train`, `POST /api/ai/recommend-xi` | auth / admin |

El contrato completo (paths, bodies, formas de respuesta, esquema SQL y modelo de IA) vive en
[`docs/SPEC.md`](docs/SPEC.md).

---

## 🤖 Modelo de IA

* **Features por jugador** normalizadas por 90 minutos: goles, asistencias, precisión de tiro/pase,
  acciones defensivas, regates, continuidad, disciplina, faltas y tendencia de calificación.
* **Entrenamiento**: regresión lineal con descenso de gradiente por lotes (600 épocas, α = 0.05) sobre
  las estadísticas históricas; métricas **MAE / RMSE / R²** visibles en la UI. Se reentrena con
  `POST /api/ai/model/train` o desde la página *Admin → IA*.
* **XI sugerido**: asignación *greedy* por restricción de posición (POR → DEF → MED → DEL) con
  mejora local por intercambios, excluyendo jugadores sancionados.
* **Próximo partido**: probabilidad victoria/empate/derrota por función logística y proyección de goles.
* **Forecast individual**: media ponderada de los últimos 5 ratings, tendencia, confianza,
  fortalezas y debilidades comparadas contra el promedio del plantel.

---

## 🧪 Verificación

```bash
npm run typecheck     # 0 errores TS en backend y frontend
npm run build         # dist/ (backend) + dist/ (frontend)
```

## 📄 Licencia

Proyecto privado de demostración.
