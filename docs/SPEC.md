# SPEC · Portal Administrativo de Equipo de Fútbol

> Contrato técnico único. **Backend (arquitectura hexagonal)** y **frontend (atomic design)** deben
> implementar EXACTAMENTE lo que aquí se define. Si algo no está en este documento, no existe.

---

## 1. Stack y decisiones

| Capa | Tecnología | Versión |
|---|---|---|
| Runtime | Node.js | >= 24 (instalado: 26) |
| Monorepo | npm workspaces | `backend/`, `frontend/` |
| Backend | Express **5** + TypeScript (CommonJS) | `express@5`, `typescript@5.9` |
| BD | SQLite con `better-sqlite3` | `13.x` (síncrono) |
| Auth | JWT (`jsonwebtoken`) + `bcryptjs` | HS256 |
| Frontend | React 19 + Vite 8 + TypeScript | `react@19`, `vite@8` |
| Routing | `react-router-dom` v7 | `7.x` |
| UI | **DaisyUI 5** sobre **Tailwind CSS 4** | `daisyui@5`, `tailwindcss@4` |
| Charts | **SVG propio** (sin librerías de gráficos) | — |

* **NO agregues dependencias.** Todas las dependencias ya están instaladas (`npm install` ya corrió).
  Si necesitas algo que no está, no lo instales: déjalo anotado en tu reporte final.
* Idioma de la UI, comentarios y mensajes de error: **español**. Identificadores de código: **inglés**.
* Dinero: números `REAL` (ej. `150000.5`), sin decimales de moneda en backend.
* Fechas: strings ISO (`YYYY-MM-DD` para fechas, `YYYY-MM-DDTHH:mm` para partidos).

### Comandos

```bash
npm run dev          # backend :4000 + frontend :5173 (raíz del monorepo)
npm run dev:api      # solo API
npm run dev:web      # solo Vite
npm run seed         # crea/recrea la BD con datos demo
npm run build        # tsc (backend) + tsc && vite build (frontend)
npm run typecheck    # ambos sin emitir
```

* Backend dev: `tsx watch src/main.ts` · Backend prod: `npm run build && npm start` (`node dist/main.js`).
* El frontend hace proxy de `/api` → `http://localhost:4000` (ya configurado en `vite.config.ts`).

---

## 2. Estructura de carpetas

```
futbol-portal/
├── package.json                  # workspaces + scripts (NO tocar dependencias)
├── scripts/dev.mjs
├── docs/SPEC.md                  # este documento
├── backend/
│   ├── package.json  tsconfig.json  .env(.example)
│   ├── data/                     # portal.db (gitignored) + model.json
│   └── src/
│       ├── main.ts               # bootstrap: env → migrate → app → listen
│       ├── container.ts          # composition root: wires ports → adapters → services → routes
│       ├── config/env.ts
│       ├── domain/
│       │   ├── entities.ts       # TODOS los tipos de dominio (ver §5)
│       │   ├── errors.ts         # AppError, ValidationError, NotFoundError, UnauthorizedError, ForbiddenError
│       │   ├── formations.ts     # catálogo FORMATIONS (ver §6)
│       │   └── model/
│       │       ├── features.ts   # extracción de features desde match_stats
│       │       └── performance-model.ts  # modelo lineal entrenable (ver §8)
│       ├── application/
│       │   ├── ports/in/*.ts     # interfaces de casos de uso (driving ports)
│       │   ├── ports/out/*.ts    # interfaces de repositorios (driven ports)
│       │   └── services/*.ts     # implementación de casos de uso (sin Express, sin SQL)
│       └── adapters/
│           ├── in/rest/
│           │   ├── http-server.ts        # crea la app Express, helmet, cors, json, /api, 404, errorHandler
│           │   ├── middleware/auth.ts    # requireAuth, requireRole('admin')
│           │   ├── middleware/error.ts   # errorHandler central (mapea AppError → status)
│           │   └── routes/*.ts           # un router por recurso
│           └── out/persistence/
│               ├── database.ts  # singleton better-sqlite3 + pragmas
│               ├── schema.sql   # DDL completo (ver §4)
│               ├── migrate.ts   # ejecuta schema.sql si hace falta
│               ├── seed.ts      # datos demo (ver §9)
│               ├── mappers.ts   # row → entidad (booleans, camelCase)
│               └── repositories/*.ts     # implementa ports/out
└── frontend/
    ├── package.json  tsconfig.json  vite.config.ts  index.html
    └── src/
        ├── main.tsx  App.tsx  index.css  router.tsx
        ├── types/api.ts          # espejo EXACTO de §5
        ├── services/api.ts       # apiFetch + token
        ├── hooks/useFetch.ts
        ├── context/AuthContext.tsx
        ├── data/formations.ts    # copia literal de §6
        ├── utils/format.ts       # fechas, dinero, calificación
        ├── atoms/  molecules/  organisms/  templates/  pages/
```

### Reglas de arquitectura hexagonal (backend)

1. `domain/` **no importa** de application, adapters ni de express/sqlite.
2. `application/services/` importa solo `domain/` y `application/ports/`. Recibe los puertos por
   constructor. **Nunca** importa `express`, `better-sqlite3` ni `bcryptjs`.
3. `application/ports/out/*.ts` define interfaces (`export interface UserRepository { ... }`).
4. `adapters/out/persistence/repositories/*.ts` las implementa (`export class SqliteUserRepository implements UserRepository`).
5. `adapters/in/rest/**` traduce HTTP ↔ casos de uso. Las rutas **solo** validan, llaman al servicio
   y devuelven JSON. La lógica de negocio vive en `application/services/`.
6. `container.ts` es el único punto que instancia clases concretas y las pasa a las rutas.
7. Las contraseñas se hashean/verifican **dentro de `AuthService`** (bcryptjs inyectable o importado
   ahí; los repositorios guardan solo el hash).

---

## 3. Configuración (`config/env.ts`)

```ts
export const env = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET ?? 'futbol-portal-dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '12h',
  dbPath: process.env.DB_PATH ?? './data/portal.db',
};
```
Carga `.env` con `dotenv/config` al inicio de `main.ts` (y también en `seed.ts`).
Pragmas SQLite: `journal_mode = WAL`, `foreign_keys = ON`.

---

## 4. Esquema SQL (`schema.sql`) — DEBE SER IDÉNTICO

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  phone         TEXT,
  avatar_url    TEXT,
  role          TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('admin','player')),
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS players (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id            INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  dni                TEXT,
  birth_date         TEXT,
  position           TEXT NOT NULL DEFAULT 'MED' CHECK (position IN ('POR','DEF','MED','DEL')),
  secondary_position TEXT CHECK (secondary_position IS NULL OR secondary_position IN ('POR','DEF','MED','DEL')),
  shirt_number       INTEGER,
  height_cm          INTEGER,
  weight_kg          INTEGER,
  foot               TEXT CHECK (foot IS NULL OR foot IN ('izq','der','ambos')),
  emergency_contact  TEXT,
  joined_at          TEXT NOT NULL DEFAULT (date('now'))
);

CREATE TABLE IF NOT EXISTS inscriptions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id  INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  season     TEXT NOT NULL,
  concept    TEXT NOT NULL DEFAULT 'Inscripción anual',
  amount     REAL NOT NULL,
  paid       REAL NOT NULL DEFAULT 0,
  due_date   TEXT,
  notes      TEXT,
  status     TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente','parcial','pagada')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payments (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  inscription_id INTEGER NOT NULL REFERENCES inscriptions(id) ON DELETE CASCADE,
  amount         REAL NOT NULL,
  method         TEXT NOT NULL DEFAULT 'efectivo' CHECK (method IN ('efectivo','transferencia','qr','tarjeta')),
  reference      TEXT,
  paid_at        TEXT NOT NULL DEFAULT (date('now')),
  notes          TEXT,
  registered_by  INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS uniforms (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('camiseta','pantalon','medias','buzo','entrenamiento','guantes')),
  variant    TEXT NOT NULL DEFAULT 'titular' CHECK (variant IN ('titular','alterna','entrenamiento')),
  price      REAL NOT NULL DEFAULT 0,
  stock      INTEGER NOT NULL DEFAULT 0,
  min_stock  INTEGER NOT NULL DEFAULT 3,
  active     INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS uniform_issues (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id  INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  uniform_id INTEGER NOT NULL REFERENCES uniforms(id),
  size       TEXT NOT NULL DEFAULT 'M',
  cost       REAL NOT NULL DEFAULT 0,
  condition  TEXT NOT NULL DEFAULT 'nuevo' CHECK (condition IN ('nuevo','bueno','regular','danado')),
  returned   INTEGER NOT NULL DEFAULT 0,
  notes      TEXT,
  issued_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS uniform_requests (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id    INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  uniform_id   INTEGER NOT NULL REFERENCES uniforms(id),
  size         TEXT NOT NULL DEFAULT 'M',
  reason       TEXT,
  status       TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente','aprobada','rechazada','entregada')),
  review_notes TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at  TEXT
);

CREATE TABLE IF NOT EXISTS matches (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  opponent      TEXT NOT NULL,
  competition   TEXT NOT NULL DEFAULT 'Amistoso',
  kick_off      TEXT NOT NULL,
  venue         TEXT,
  is_home       INTEGER NOT NULL DEFAULT 1,
  status        TEXT NOT NULL DEFAULT 'programado' CHECK (status IN ('programado','jugado','cancelado','pospuesto')),
  formation     TEXT NOT NULL DEFAULT '4-3-3',
  goals_for     INTEGER,
  goals_against INTEGER,
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS strategies (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id   INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'general' CHECK (kind IN ('general','ataque','defensa','pelota_parada','transicion')),
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lineups (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id   INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id  INTEGER REFERENCES players(id) ON DELETE SET NULL,
  slot_index INTEGER NOT NULL,
  x          REAL NOT NULL,
  y          REAL NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('POR','DEF','MED','DEL')),
  label      TEXT NOT NULL,
  UNIQUE (match_id, slot_index)
);

CREATE TABLE IF NOT EXISTS sanctions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id   INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  match_id    INTEGER REFERENCES matches(id) ON DELETE SET NULL,
  type        TEXT NOT NULL CHECK (type IN ('tarjeta_amarilla','tarjeta_roja','suspension','multa','amonestacion')),
  reason      TEXT NOT NULL,
  amount      REAL NOT NULL DEFAULT 0,
  points      INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'activa' CHECK (status IN ('activa','cumplida','anulada')),
  match_date  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS match_stats (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id          INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id         INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  minutes           INTEGER NOT NULL DEFAULT 0,
  goals             INTEGER NOT NULL DEFAULT 0,
  assists           INTEGER NOT NULL DEFAULT 0,
  shots             INTEGER NOT NULL DEFAULT 0,
  shots_on_target   INTEGER NOT NULL DEFAULT 0,
  passes            INTEGER NOT NULL DEFAULT 0,
  passes_completed  INTEGER NOT NULL DEFAULT 0,
  tackles           INTEGER NOT NULL DEFAULT 0,
  interceptions     INTEGER NOT NULL DEFAULT 0,
  recoveries        INTEGER NOT NULL DEFAULT 0,
  dribbles          INTEGER NOT NULL DEFAULT 0,
  fouls             INTEGER NOT NULL DEFAULT 0,
  yellow_cards      INTEGER NOT NULL DEFAULT 0,
  red_cards         INTEGER NOT NULL DEFAULT 0,
  rating            REAL NOT NULL DEFAULT 6.0,
  UNIQUE (match_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_players_user      ON players(user_id);
CREATE INDEX IF NOT EXISTS idx_inscriptions_pl   ON inscriptions(player_id);
CREATE INDEX IF NOT EXISTS idx_stats_match       ON match_stats(match_id);
CREATE INDEX IF NOT EXISTS idx_stats_player      ON match_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_sanctions_player  ON sanctions(player_id);
CREATE INDEX IF NOT EXISTS idx_lineups_match     ON lineups(match_id);
```

`migrate.ts`: crea `backend/data/` si no existe, abre la BD y ejecuta el script si la tabla
`users` no existe. `main.ts` lo llama antes de levantar el servidor.

**Cálculo de `inscriptions.status`** (siempre derivado, en la capa de aplicación):
`paid >= amount` → `pagada`; `paid > 0` → `parcial`; si no → `pendiente`. Nunca se guarda a mano
si se puede derivar (se recalcula tras cada pago y en lecturas).

---

## 5. Tipos de dominio (`domain/entities.ts` y espejo en `frontend/src/types/api.ts`)

```ts
export type Role = 'admin' | 'player';
export type Position = 'POR' | 'DEF' | 'MED' | 'DEL';
export type Foot = 'izq' | 'der' | 'ambos';
export type InscriptionStatus = 'pendiente' | 'parcial' | 'pagada';
export type PaymentMethod = 'efectivo' | 'transferencia' | 'qr' | 'tarjeta';
export type UniformKind = 'camiseta' | 'pantalon' | 'medias' | 'buzo' | 'entrenamiento' | 'guantes';
export type UniformVariant = 'titular' | 'alterna' | 'entrenamiento';
export type UniformCondition = 'nuevo' | 'bueno' | 'regular' | 'danado';
export type UniformRequestStatus = 'pendiente' | 'aprobada' | 'rechazada' | 'entregada';
export type MatchStatus = 'programado' | 'jugado' | 'cancelado' | 'pospuesto';
export type StrategyKind = 'general' | 'ataque' | 'defensa' | 'pelota_parada' | 'transicion';
export type SanctionType = 'tarjeta_amarilla' | 'tarjeta_roja' | 'suspension' | 'multa' | 'amonestacion';
export type SanctionStatus = 'activa' | 'cumplida' | 'anulada';

export interface User {
  id: number; email: string; fullName: string; phone: string | null;
  avatarUrl: string | null; role: Role; active: boolean; createdAt: string;
}
export interface Player {
  id: number; userId: number; dni: string | null; birthDate: string | null;
  position: Position; secondaryPosition: Position | null; shirtNumber: number | null;
  heightCm: number | null; weightKg: number | null; foot: Foot | null;
  emergencyContact: string | null; joinedAt: string;
}
export interface AuthPayload { token: string; user: User; player: Player | null; }

export interface Payment {
  id: number; inscriptionId: number; amount: number; method: PaymentMethod;
  reference: string | null; paidAt: string; notes: string | null;
}
export interface Inscription {
  id: number; playerId: number; playerName?: string; season: string; concept: string;
  amount: number; paid: number; status: InscriptionStatus;
  dueDate: string | null; notes: string | null; createdAt: string;
  payments?: Payment[];
}
export interface Uniform {
  id: number; name: string; kind: UniformKind; variant: UniformVariant;
  price: number; stock: number; minStock: number; active: boolean; issuedCount?: number;
}
export interface UniformIssue {
  id: number; playerId: number; playerName?: string; uniformId: number;
  uniformName?: string; kind?: UniformKind; variant?: UniformVariant;
  size: string; cost: number; condition: UniformCondition; returned: boolean;
  notes: string | null; issuedAt: string;
}
export interface UniformRequest {
  id: number; playerId: number; playerName?: string; uniformId: number;
  uniformName?: string; size: string; reason: string | null;
  status: UniformRequestStatus; reviewNotes: string | null;
  createdAt: string; reviewedAt: string | null;
}
export interface Match {
  id: number; opponent: string; competition: string; kickOff: string; venue: string | null;
  isHome: boolean; status: MatchStatus; formation: string;
  goalsFor: number | null; goalsAgainst: number | null; notes: string | null; createdAt: string;
}
export interface Strategy {
  id: number; matchId: number; title: string; kind: StrategyKind; content: string; createdAt: string;
}
export interface LineupSlot {
  slotIndex: number; playerId: number | null; playerName?: string | null;
  shirtNumber?: number | null; playerPosition?: Position | null;
  x: number; y: number; role: 'POR' | 'DEF' | 'MED' | 'DEL'; label: string;
}
export interface MatchStat {
  id?: number; matchId: number; playerId: number; playerName?: string; shirtNumber?: number | null;
  position?: Position; minutes: number; goals: number; assists: number; shots: number;
  shotsOnTarget: number; passes: number; passesCompleted: number; tackles: number;
  interceptions: number; recoveries: number; dribbles: number; fouls: number;
  yellowCards: number; redCards: number; rating: number;
}
export interface Sanction {
  id: number; playerId: number; playerName?: string; matchId: number | null;
  type: SanctionType; reason: string; amount: number; points: number;
  status: SanctionStatus; matchDate: string | null; createdAt: string;
}
export interface StatsSummary {
  appearances: number; minutes: number; goals: number; assists: number; shots: number;
  shotsOnTarget: number; passes: number; passesCompleted: number; tackles: number;
  interceptions: number; recoveries: number; dribbles: number; fouls: number;
  yellowCards: number; redCards: number; avgRating: number;
}
export interface PlayerListItem {
  user: User; player: Player;
  inscription: { season: string; status: InscriptionStatus; amount: number; paid: number; dueDate: string | null } | null;
  stats: StatsSummary;
  activeSanctions: number;
}
export interface TeamStats {
  topScorers: { playerId: number; playerName: string; shirtNumber: number | null; value: number }[];
  topAssists: { playerId: number; playerName: string; shirtNumber: number | null; value: number }[];
  topRated:   { playerId: number; playerName: string; shirtNumber: number | null; value: number }[];
  byPosition: { position: Position; count: number; avgRating: number }[];
  teamAverages: StatsSummary;
}
export interface ModelInfo {
  model: string;                     // 'regresion-lineal-gradiente-descendente'
  features: string[];                // nombres de features
  weights: number[];                 // w0 + w1..wn
  metrics: { samples: number; mae: number; rmse: number; r2: number };
  trainedAt: string;
}
export interface AiPlayerInsight {
  playerId: number; playerName: string; position: Position;
  forecast: { nextRating: number; confidence: number; trend: 'sube' | 'estable' | 'baja'; history: { matchId: number; opponent: string; rating: number }[] };
  strengths: { label: string; detail: string }[];
  weaknesses: { label: string; detail: string }[];
  recommendation: string;
}
export interface AiInsights {
  model: ModelInfo;
  teamRating: number;
  formTrend: { matchId: number; opponent: string; rating: number; result: string }[];
  nextMatchPrediction: {
    matchId: number; opponent: string; kickOff: string;
    winProbability: number; drawProbability: number; loseProbability: number;
    projectedGoalsFor: number; projectedGoalsAgainst: number; teamRating: number; opponentRating: number;
  } | null;
  topPlayers: { playerId: number; playerName: string; shirtNumber: number | null; predictedRating: number; avgRating: number }[];
  insights: { level: 'positivo' | 'alerta' | 'info'; title: string; message: string }[];
  recommendedXI: { formation: string; slots: LineupSlot[]; explanation: string };
}
export interface DashboardAdmin {
  playersCount: number; activePlayers: number;
  inscriptions: { season: string; total: number; collected: number; pending: number; paidCount: number; pendingCount: number };
  nextMatch: Match | null; recentSanctions: Sanction[];
  pendingUniformRequests: number; lowStockUniforms: Uniform[];
  teamStats: TeamStats; pendingInscriptionPlayers: { playerId: number; playerName: string; amount: number; paid: number; dueDate: string | null }[];
}
export interface DashboardPlayer {
  inscription: Inscription | null;
  upcomingMatch: (Match & { lineupSlot: LineupSlot | null }) | null;
  myStats: StatsSummary;
  myRecentStats: MatchStat[];
  mySanctions: Sanction[];
  uniforms: { issued: UniformIssue[]; pendingRequests: number };
  forecast: { nextRating: number; confidence: number; trend: string } | null;
}
```

---

## 6. Catálogo de formaciones (idéntico en backend y frontend)

`backend/src/domain/formations.ts` y `frontend/src/data/formations.ts` con el mismo contenido:

```ts
export type FormationRole = 'POR' | 'DEF' | 'MED' | 'DEL';
export interface FormationSlot { slotIndex: number; x: number; y: number; role: FormationRole; label: string }
export interface FormationDef { key: string; name: string; slots: FormationSlot[] }

export const FORMATIONS: Record<string, FormationDef> = {
  '4-3-3': { key: '4-3-3', name: '4-3-3', slots: [
    { slotIndex: 0, x: 50, y: 93, role: 'POR', label: 'POR' },
    { slotIndex: 1, x: 14, y: 74, role: 'DEF', label: 'LI'  },
    { slotIndex: 2, x: 37, y: 78, role: 'DEF', label: 'DFC' },
    { slotIndex: 3, x: 63, y: 78, role: 'DEF', label: 'DFC' },
    { slotIndex: 4, x: 86, y: 74, role: 'DEF', label: 'LD'  },
    { slotIndex: 5, x: 30, y: 56, role: 'MED', label: 'MC'  },
    { slotIndex: 6, x: 50, y: 62, role: 'MED', label: 'MC'  },
    { slotIndex: 7, x: 70, y: 56, role: 'MED', label: 'MCO' },
    { slotIndex: 8, x: 16, y: 30, role: 'DEL', label: 'EI'  },
    { slotIndex: 9, x: 50, y: 24, role: 'DEL', label: 'DC'  },
    { slotIndex: 10, x: 84, y: 30, role: 'DEL', label: 'ED'  },
  ]},
  '4-4-2': { key: '4-4-2', name: '4-4-2', slots: [
    { slotIndex: 0, x: 50, y: 93, role: 'POR', label: 'POR' },
    { slotIndex: 1, x: 14, y: 74, role: 'DEF', label: 'LI'  },
    { slotIndex: 2, x: 37, y: 78, role: 'DEF', label: 'DFC' },
    { slotIndex: 3, x: 63, y: 78, role: 'DEF', label: 'DFC' },
    { slotIndex: 4, x: 86, y: 74, role: 'DEF', label: 'LD'  },
    { slotIndex: 5, x: 14, y: 52, role: 'MED', label: 'MI'  },
    { slotIndex: 6, x: 38, y: 56, role: 'MED', label: 'MC'  },
    { slotIndex: 7, x: 62, y: 56, role: 'MED', label: 'MC'  },
    { slotIndex: 8, x: 86, y: 52, role: 'MED', label: 'MD'  },
    { slotIndex: 9, x: 38, y: 26, role: 'DEL', label: 'DC'  },
    { slotIndex: 10, x: 62, y: 26, role: 'DEL', label: 'DC'  },
  ]},
  '4-2-3-1': { key: '4-2-3-1', name: '4-2-3-1', slots: [
    { slotIndex: 0, x: 50, y: 93, role: 'POR', label: 'POR' },
    { slotIndex: 1, x: 14, y: 74, role: 'DEF', label: 'LI'  },
    { slotIndex: 2, x: 37, y: 78, role: 'DEF', label: 'DFC' },
    { slotIndex: 3, x: 63, y: 78, role: 'DEF', label: 'DFC' },
    { slotIndex: 4, x: 86, y: 74, role: 'DEF', label: 'LD'  },
    { slotIndex: 5, x: 38, y: 62, role: 'MED', label: 'MCD' },
    { slotIndex: 6, x: 62, y: 62, role: 'MED', label: 'MCD' },
    { slotIndex: 7, x: 16, y: 38, role: 'MED', label: 'MI'  },
    { slotIndex: 8, x: 50, y: 40, role: 'MED', label: 'MCO' },
    { slotIndex: 9, x: 84, y: 38, role: 'MED', label: 'MD'  },
    { slotIndex: 10, x: 50, y: 20, role: 'DEL', label: 'DC'  },
  ]},
  '3-5-2': { key: '3-5-2', name: '3-5-2', slots: [
    { slotIndex: 0, x: 50, y: 93, role: 'POR', label: 'POR' },
    { slotIndex: 1, x: 26, y: 78, role: 'DEF', label: 'DFC' },
    { slotIndex: 2, x: 50, y: 80, role: 'DEF', label: 'DFC' },
    { slotIndex: 3, x: 74, y: 78, role: 'DEF', label: 'DFC' },
    { slotIndex: 4, x: 10, y: 54, role: 'MED', label: 'MI'  },
    { slotIndex: 5, x: 34, y: 60, role: 'MED', label: 'MCD' },
    { slotIndex: 6, x: 50, y: 50, role: 'MED', label: 'MC'  },
    { slotIndex: 7, x: 66, y: 60, role: 'MED', label: 'MCO' },
    { slotIndex: 8, x: 90, y: 54, role: 'MED', label: 'MD'  },
    { slotIndex: 9, x: 38, y: 26, role: 'DEL', label: 'DC'  },
    { slotIndex: 10, x: 62, y: 26, role: 'DEL', label: 'DC'  },
  ]},
  '5-3-2': { key: '5-3-2', name: '5-3-2', slots: [
    { slotIndex: 0, x: 50, y: 93, role: 'POR', label: 'POR' },
    { slotIndex: 1, x: 8,  y: 70, role: 'DEF', label: 'LI'  },
    { slotIndex: 2, x: 29, y: 78, role: 'DEF', label: 'DFC' },
    { slotIndex: 3, x: 50, y: 80, role: 'DEF', label: 'DFC' },
    { slotIndex: 4, x: 71, y: 78, role: 'DEF', label: 'DFC' },
    { slotIndex: 5, x: 92, y: 70, role: 'DEF', label: 'LD'  },
    { slotIndex: 6, x: 32, y: 56, role: 'MED', label: 'MC'  },
    { slotIndex: 7, x: 50, y: 60, role: 'MED', label: 'MC'  },
    { slotIndex: 8, x: 68, y: 56, role: 'MED', label: 'MC'  },
    { slotIndex: 9, x: 38, y: 26, role: 'DEL', label: 'DC'  },
    { slotIndex: 10, x: 62, y: 26, role: 'DEL', label: 'DC'  },
  ]},
};

export const FORMATION_KEYS = Object.keys(FORMATIONS);
export function getFormation(key: string) { return FORMATIONS[key] ?? FORMATIONS['4-3-3']; }
```

Coordenadas en % de la cancha: `y=0` es el arco **del rival** (arriba) e `y=100` el arco **propio**
(abajo); `x=0` izquierda, `x=100` derecha. El portero siempre `y=93`.

---

## 7. Contrato API

* Prefijo: `/api`. Todo JSON. Header `Authorization: Bearer <token>` salvo login/registro.
* Errores: HTTP status + cuerpo `{ "error": { "message": "mensaje en español", "code"?: "CODIGO" } }`.
  * 400 validación (`ValidationError`), 401 no autenticado/token inválido, 403 sin permiso,
    404 `NotFoundError`, 500 interno (mensaje genérico, loguea el stack).
* El error handler es UNO solo (`adapters/in/rest/middleware/error.ts`) registrado al final.
* Los servicios lanzan errores de `domain/errors.ts`; las rutas NO hacen try/catch salvo para
  convertir errores de validación propios.

### 7.1 Auth (público)

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| POST | `/api/auth/login` | `{email, password}` | `AuthPayload` |
| POST | `/api/auth/register` | `{email, password, fullName, phone?, position?, shirtNumber?}` | `AuthPayload` (rol `player`) |
| GET | `/api/auth/me` | — | `{ user, player }` |

### 7.2 Yo / jugador (`requireAuth`)

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| GET | `/api/me` | — | `{ user, player, stats: StatsSummary, inscription: Inscription\|null, sanctions: Sanction[], issuedUniforms: UniformIssue[], pendingRequests: number, forecast: {nextRating, confidence, trend}\|null }` |
| PUT | `/api/me/profile` | campos editables de `Player` + `phone` | `{ user, player }` |
| PUT | `/api/me/password` | `{currentPassword, newPassword}` | `{ ok: true }` |
| GET | `/api/me/inscription` | — | `{ inscription: Inscription\|null, payments: Payment[] }` |
| GET | `/api/me/uniforms` | — | `{ issued: UniformIssue[], requests: UniformRequest[], catalog: Uniform[] }` |
| POST | `/api/me/uniform-requests` | `{uniformId, size, reason?}` | `{ request: UniformRequest }` |
| GET | `/api/me/matches` | — | `{ upcoming: MatchView[], finished: MatchView[] }` donde `MatchView = Match & { mySlot: LineupSlot\|null, strategiesCount: number, lineupFilled: number }` |
| GET | `/api/me/stats` | — | `{ summary: StatsSummary, matches: MatchStat[] }` |
| GET | `/api/me/ai` | — | `AiPlayerInsight` |

### 7.3 Partidos

| Método | Ruta | Rol | Body | Respuesta |
|---|---|---|---|---|
| GET | `/api/matches` | auth | — | `Match[]` (orden: próximos por fecha asc, luego jugados desc) |
| GET | `/api/matches/:id` | auth | — | `{ match, strategies, lineup: LineupSlot[], stats: MatchStat[] }` |
| POST | `/api/matches` | admin | `{opponent, competition, kickOff, venue?, isHome, formation, notes?}` | `Match` |
| PUT | `/api/matches/:id` | admin | mismos campos + `status`, `goalsFor`, `goalsAgainst` | `Match` |
| DELETE | `/api/matches/:id` | admin | — | `{ ok: true }` |
| PUT | `/api/matches/:id/formation` | admin | `{formation}` (clave del catálogo; reemplaza slots vacíos) | `{ match, lineup }` |
| POST | `/api/matches/:id/strategies` | admin | `{title, kind, content}` | `Strategy` |
| PUT | `/api/strategies/:id` | admin | `{title?, kind?, content?}` | `Strategy` |
| DELETE | `/api/strategies/:id` | admin | — | `{ ok: true }` |
| PUT | `/api/matches/:id/lineup` | admin | `{slots: {slotIndex, playerId: number\|null, x, y, role, label}[]}` (11 posiciones) | `{ lineup: LineupSlot[] }` |
| POST | `/api/matches/:id/lineup/auto` | admin | `{formation?}` | `{ lineup: LineupSlot[], explanation: string }` (XI sugerido por IA) |
| POST | `/api/matches/:id/stats` | admin | `{entries: Array<Partial<MatchStat> & {playerId}>}` | `{ entries: MatchStat[] }` (upsert por `match_id+player_id`) |
| GET | `/api/matches/:id/stats` | auth | — | `{ entries: MatchStat[] }` |

Al cambiar `formation` se conserva a los jugadores que sigan en pie (`slotIndex` coincidente) y se
limpian los que queden fuera. Al guardar el lineup, los `slot_index` deben coincidir con el catálogo
de la `match.formation`.

### 7.4 Jugadores (admin)

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| GET | `/api/players` | — | `PlayerListItem[]` (orden alfabético) |
| GET | `/api/players/:id` | — | `{ user, player, inscriptions, uniformIssues, sanctions, stats: MatchStat[], summary: StatsSummary, ai: AiPlayerInsight }` |
| POST | `/api/players` | `{email, password, fullName, phone?, dni?, position, shirtNumber?, ...campos Player}` | `{ user, player }` |
| PUT | `/api/players/:id` | `{fullName?, phone?, role?, active?, campos Player?}` | `{ user, player }` |
| DELETE | `/api/players/:id` | — | `{ ok: true }` (baja lógica: `active=false`; si era el último admin activo → 400) |

### 7.5 Inscripciones (admin)

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| GET | `/api/inscriptions?season=&status=&playerId=` | — | `Inscription[]` (con `playerName` y `payments`) |
| POST | `/api/inscriptions` | `{playerId, season, concept?, amount, dueDate?, notes?}` | `Inscription` |
| POST | `/api/inscriptions/:id/payments` | `{amount, method, reference?, paidAt?, notes?}` | `Inscription` (con payments y `status` recalculado) |
| PUT | `/api/inscriptions/:id` | `{amount?, dueDate?, notes?, concept?, season?}` | `Inscription` |
| DELETE | `/api/inscriptions/:id` | — | `{ ok: true }` |

`GET /api/inscriptions` debe poder filtrar `?season=2026&status=pendiente`. Devolver siempre
`paid` y `status` consistentes.

### 7.6 Uniformes (admin)

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| GET | `/api/uniforms` | — | `Uniform[]` (con `issuedCount`) |
| POST | `/api/uniforms` | `{name, kind, variant?, price, stock?, minStock?}` | `Uniform` |
| PUT | `/api/uniforms/:id` | campos | `Uniform` |
| DELETE | `/api/uniforms/:id` | — | `{ ok: true }` (baja lógica) |
| GET | `/api/uniform-issues?playerId=` | — | `UniformIssue[]` |
| POST | `/api/uniform-issues` | `{playerId, uniformId, size, cost?, condition?, notes?}` | `UniformIssue` (descuenta `stock`; error 400 si `stock<=0`) |
| PUT | `/api/uniform-issues/:id` | `{returned?, condition?, notes?}` | `UniformIssue` |
| GET | `/api/uniform-requests?status=` | — | `UniformRequest[]` |
| PUT | `/api/uniform-requests/:id` | `{status, reviewNotes?}` | `UniformRequest` |

Si `status` pasa a `entregada`: se crea un `uniform_issue` con `cost = uniform.price`, se descuenta
stock y se marca `reviewed_at`. Si pasa a `rechazada`, solo se actualiza.

### 7.7 Sanciones (admin)

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| GET | `/api/sanctions?playerId=&status=&type=` | — | `Sanction[]` (con `playerName`, ordenadas por `created_at` desc) |
| POST | `/api/sanctions` | `{playerId, matchId?, type, reason, amount?, points?, matchDate?}` | `Sanction` |
| PUT | `/api/sanctions/:id` | `{status?, reason?, amount?, points?}` | `Sanction` |
| DELETE | `/api/sanctions/:id` | — | `{ ok: true }` |

### 7.8 Estadísticas

| Método | Ruta | Rol | Respuesta |
|---|---|---|---|
| GET | `/api/stats?matchId=&playerId=` | auth | `MatchStat[]` |
| GET | `/api/team/stats` | auth | `TeamStats` |

### 7.9 Dashboard

| Método | Ruta | Rol | Respuesta |
|---|---|---|---|
| GET | `/api/dashboard/admin` | admin | `DashboardAdmin` |
| GET | `/api/dashboard/player` | auth | `DashboardPlayer` |

### 7.10 IA

| Método | Ruta | Rol | Body | Respuesta |
|---|---|---|---|---|
| GET | `/api/ai/insights` | auth | — | `AiInsights` |
| GET | `/api/ai/players/:id` | auth | — | `AiPlayerInsight` |
| GET | `/api/ai/model` | auth | — | `ModelInfo` |
| POST | `/api/ai/model/train` | admin | — | `ModelInfo` (reentrena y persiste `data/model.json`) |
| POST | `/api/ai/recommend-xi` | admin | `{matchId, formation}` | `{ lineup: LineupSlot[], explanation: string }` |

---

## 8. Modelo de IA (obligatorio, explicable y determinista)

Ubicación: `domain/model/features.ts` + `domain/model/performance-model.ts`,
orquestado por `AiService` (`application/services/ai-service.ts`).

### 8.1 Features por jugador (sobre `match_stats` históricos, normalizadas por 90 min)

```
f1  goles por 90            = goals * 90 / max(minutes,1)
f2  asistencias por 90      = assists * 90 / max(minutes,1)
f3  precisión de tiro       = shots_on_target / max(shots,1)
f4  precisión de pase       = passes_completed / max(passes,1)
f5  actions defensivas / 90 = (tackles + interceptions + recoveries) * 90 / max(minutes,1)
f6  regates por 90          = dribbles * 90 / max(minutes,1)
f7  continuidad             = minutes / max_minutes_del_plantel_en_un_partido (cap a 1)
f8  disciplina (negativa)   = (yellow_cards * 0.5 + red_cards * 1.5) * 90 / max(minutes,1)
f9  faltas (negativa)       = fouls * 90 / max(minutes,1)
f10 tendencia               = rating_este_partido - rating_promedio_anterior (0 si es el primero)
```

### 8.2 Modelo

* Modelo lineal: `rating_predicho = w0 + Σ wi * zi`, donde `zi` es la **feature i estandarizada**
  (z-score con media/desviación calculadas sobre el dataset; si `σ = 0` → `z = 0`).
* Entrenamiento: **gradiente descenso por lotes**, `épocas = 600`, `α = 0.05`,
  pérdida MSE, inicialización `w = 0` (salvo `w0`), sin regularización.
* Si hay `< 20` muestras: usar pesos iniciales por defecto (`[6.5, 0.35, 0.3, 0.25, 0.3, 0.3, 0.2, 0.15, -0.25, -0.15, 0.4]`)
  y reportar `metrics.samples` con el MAE/RMSE/R² igualmente calculados.
* Métricas: `mae`, `rmse`, `r2 = 1 - SSres/SStot` (si `SStot = 0` → `r2 = 0`).
* Persistencia: `backend/data/model.json` = `{ weights, mean, std, features, metrics, trainedAt }`.
  Si el archivo no existe, el servicio lo entrena al vuelo con los datos actuales.
* `POST /api/ai/model/train` reentrena y reescribe el archivo.

### 8.3 Rating predicho de un jugador

Se agrega por jugador: promedio simple de sus features por partido (o directamente la última
temporada). `predictedRating` se limita al rango `[1, 10]` y se redondea a 2 decimales.

### 8.4 Formación XI recomendada (greedy + mejora local)

Para cada `slot` del catálogo de la formación pedida y cada jugador disponible (activo y sin
sanción de suspensión activa):

```
fit(slotRole, playerPos) = 1.0  si coinciden exactamente
                         = 0.85 si están en la misma línea (DEF↔DEF, MED↔MED, DEL↔DEL)
                         = 0.55 si son líneas contiguas (DEF↔MED, MED↔DEL)
                         = 0.15 para cualquier otro caso (incluye POR con no-POR)
score = fit * predictedRating + 0.15 * (fit === 1 ? avgRating : avgRating - 1)
```

1. Ordenar slots de mayor a menor restricción (POR primero, luego DEF, MED, DEL).
2. Asignación greedy sin repetir jugador (elige el `score` más alto disponible; si un jugador ya
   está asignado a otro slot, se omite).
3. **Mejora local**: 100 iteraciones; probar todos los pares de slots con jugadores distintos y
   swap si `Σscore` mejora en `> 0.01`.
4. `explanation`: texto en español con el promedio de `predictedRating` del XI y 2-3 notas
   (ej. *"Se mantienen 8 titulares del último partido; Lucas M. (7.4) gana el puesto a Diego R. (6.8) por mejor rendimiento reciente."*).

### 8.5 Probabilidad de resultado (próximo partido)

```
oppRating = 6.40  (baseline; si hay stats de partidos anteriores contra el mismo rival, usar su promedio)
delta     = teamRating - oppRating + (isHome ? 0.15 : -0.15)
pWin      = 1 / (1 + Math.exp(-2.1 * delta - 0.15))
pLoss     = 1 / (1 + Math.exp( 2.1 * delta - 0.15))
pDraw     = max(0, 1 - pWin - pLoss)   → normalizar los tres a sumar 1
xgFor     = clamp(1.35 * Math.exp(0.6 * (teamRating - oppRating)), 0.15, 4.5)   (1 decimal)
xgAgainst = clamp(1.20 * Math.exp(-0.5 * (teamRating - oppRating)), 0.15, 4.5)  (1 decimal)
```
`teamRating` = promedio de `predictedRating` de los 11 titulares del XI sugerido (o de los 11
mejores del plantel si aún no hay lineup).

### 8.6 Forecast individual y fortalezas/debilidades

* `history`: últimos 5 partidos jugados (rating real) con `opponent`.
* `nextRating` = media ponderada `0.40·L1 + 0.25·L2 + 0.15·L3 + 0.10·L4 + 0.10·L5` (L1 = más
  reciente), limitada a `[1,10]`, redondeada a 2 decimales.
* `trend` = comparación del promedio de los últimos 3 vs los 3 anteriores: `+0.25` → `sube`,
  `-0.25` → `baja`, resto → `estable`.
* `confidence` = `min(0.95, 0.35 + 0.05 * appearances)`, redondeado a 2 decimales (mín. 0.2).
* `strengths` / `weaknesses`: comparar cada feature del jugador contra el **promedio del plantel**
  (z-score). `|z| >= 0.5` genera un ítem con label en español, p.ej.
  *"Defensa agresiva" · "2.1 recuperaciones cada 90 min (promedio del plantel: 1.4)"*.
  Máximo 4 fortalezas y 4 debilidades, ordenadas por `|z|`.
* `recommendation`: reglas simples en español (ej. *"Viene en racha de3 partidos con calificación
  ≥ 7.0: se recomienda titularidad."*, *"3 faltas por 90 min: bajar la intensidad en el primer tiempo."*).

### 8.7 `insights[]` del equipo (reglas sobre datos reales)

Generar 3 a 6 ítems con `level` (`positivo`/`alerta`/`info`), siempre con números reales, p.ej.:
* `alerta` · "3 inscripciones pendientes" · "Faltan $ 450.000 por cobrar de 2026 (vencen el 15/10)."
* `alerta` · "Racha de derrotas" · "2 derrotas seguidas; el modelo proyecta 1.8 goles a favor vs. Rivales FC."
* `positivo` · "Forma ascendente" · "El promedio de calificación subió de 6.6 a 7.1 en los últimos 3 partidos."
* `info` · "Sanciones" · "2 jugadores con 2 tarjetas amarillas (1 de suspensión)."

---

## 9. Seed (`seed.ts`) — datos demo

Ejecución: `npm run seed` → **borra y recrea** `backend/data/portal.db` (acepta `--reset` para
idéntico comportamiento). Debe imprimir un resumen con usuarios y contraseñas.

| Rol | Email | Password | Notas |
|---|---|---|---|
| admin | `admin@club.com` | `Admin123!` | "Carlos Duarte" |
| player | `jugador01@club.com` … `jugador14@club.com` | `Jugador123!` | 14 jugadores |

Contenido obligatorio:
* **14 jugadores** con distribución: 2 POR, 5 DEF, 5 MED, 2 DEL (más o menos), números de camiseta
  1–30, posiciones secundarias variadas, `dni`, `birth_date`, estatura/peso, pie.
* **Inscripciones 2026**: monto `$ 1.200.000` c/u; 8 `pagada`, 3 `parcial` (entre 400.000 y 900.000),
  3 `pendiente`; fechas de vencimiento cercanas; pagos en `payments` que sumen exactamente `paid`.
* **Uniformes** (8 ítems de catálogo: camiseta titular/alterna, pantalón, medias, buzo, chaleco de
  entrenamiento, guantes de arquero…) con precios 15.000–95.000 y stock; ~10 `uniform_issues`
  repartidos entre jugadores; 3 `uniform_requests` (2 pendientes, 1 aprobada).
* **Partidos**: **6 jugados** con `goals_for`/`goals_against` y `match_stats` REALISTAS para los 14
  jugadores (minutos variados, rating entre 5.0 y 9.5 con correlación lógica: quien mete goles suele
  calificar mejor). Esta data es la que entrena al modelo.
* **2 próximos** (sábado y domingo de la semana actual) con `formation` (4-3-3 y 4-2-3-1), 3 y 2
  `strategies` respectivamente, y `lineups` pre-cargados (al menos el primer partido con los 11 slots
  ocupados por jugadores coherentes con su posición).
* **Sanciones**: ~6 filas (2 amarillas activas que sumen acumulación, 1 roja cumplida,
  1 suspensión activa, 2 multas por uniforme con `amount`).
* `model.json` no se pre-genera (se entrena en runtime).

Los rates de `rating` deben quedar con desviación suficiente para que el R² del modelo sea
razonable (> 0.3).

---

## 10. Frontend — Atomic Design

### 10.1 Base

* `main.tsx` → `<StrictMode><BrowserRouter><AuthProvider><App /></AuthProvider></BrowserRouter></StrictMode>`.
* `App.tsx` → `router.tsx` con `useRoutes` o `<Routes>`.
* `index.css` YA existe con Tailwind 4 + DaisyUI 5 (`themes: emerald --default, dark --prefersdark`).
  Usa clases DaisyUI (`btn`, `card`, `table`, `badge`, `stat`, `modal`, `alert`, `drawer`, `navbar`,
  `progress`, `tooltip`, `join`, `steps`, `timeline`…). Tema: `data-theme="emerald"` en `index.html`.
  Acentos de marca con utilidades Tailwind (`text-primary`, `bg-primary/10`, `badge-success`…).
* Sin librerías de gráficos: `organisms/` incluye **`PerformanceChart.tsx`** (barras SVG),
  **`RatingTrendChart.tsx`** (línea SVG con ejes y tooltips simples) y **`ProbabilityBars.tsx`**.
* Todo texto de UI en **español**.

### 10.2 `services/api.ts`

```ts
export class ApiError extends Error { status: number; code?: string }
export async function api<T>(path: string, options?: RequestInit & { json?: unknown }): Promise<T>
```
* `Content-Type: application/json` cuando hay `json`.
* Token de `localStorage.getItem('token')` → header `Authorization`.
* `!res.ok` → lanza `ApiError` con `message` del cuerpo `error.message`.
* `401` → borra token y redirige a `/login` (event `auth:expired` escuchado por `AuthContext`).
* `hooks/useFetch.ts`: `const { data, loading, error, reload } = useFetch<T>(path, deps)`.
* `context/AuthContext.tsx`: `{ user, player, token, loading, login, register, logout, refresh }`;
  al montar, si hay token llama `GET /api/auth/me`; si falla, limpia.

### 10.3 Rutas (router.tsx)

| Ruta | Página | Rol |
|---|---|---|
| `/login` | `pages/auth/LoginPage` | público |
| `/registro` | `pages/auth/RegisterPage` | público |
| `/` | redirect → `/admin/inicio` o `/jugador/inicio` | auth |
| `/jugador/inicio` | `pages/player/PlayerDashboardPage` | player |
| `/jugador/inscripcion` | `pages/player/MyInscriptionPage` | player |
| `/jugador/uniformes` | `pages/player/MyUniformsPage` | player |
| `/jugador/partidos` | `pages/player/MatchesPage` | player |
| `/jugador/partidos/:id` | `pages/player/MatchDetailPage` | player |
| `/jugador/perfil` | `pages/player/MyProfilePage` | player |
| `/jugador/estadisticas` | `pages/player/MyStatsPage` | player |
| `/jugador/ia` | `pages/player/MyAiPage` | player |
| `/admin/inicio` | `pages/admin/AdminDashboardPage` | admin |
| `/admin/jugadores` | `pages/admin/PlayersPage` | admin |
| `/admin/jugadores/:id` | `pages/admin/PlayerDetailPage` | admin |
| `/admin/inscripciones` | `pages/admin/InscriptionsPage` | admin |
| `/admin/uniformes` | `pages/admin/UniformsPage` | admin |
| `/admin/partidos` | `pages/admin/MatchesPage` | admin |
| `/admin/partidos/:id` | `pages/admin/MatchBuilderPage` | admin |
| `/admin/sanciones` | `pages/admin/SanctionsPage` | admin |
| `/admin/estadisticas` | `pages/admin/StatsPage` | admin |
| `/admin/ia` | `pages/admin/AiPage` | admin |
| `*` | `pages/NotFoundPage` | — |

Guards: `templates/ProtectedRoute.tsx` con prop `role?: 'admin' | 'player'`; si no hay token →
`/login`; si el rol no coincide → redirect a su home. Layout `DashboardLayout` (drawer de DaisyUI
con sidebar + topbar + `<Outlet/>`), `AuthLayout` para login/registro.

### 10.4 Catálogo de componentes

**`atoms/`** (una idea visual): `Button.tsx` (variant: `primary|secondary|ghost|danger|outline`, `size`, `loading`), `Input.tsx`, `Select.tsx`, `Textarea.tsx`, `Card.tsx` (`Card`, `CardBody`, `CardTitle`), `Badge.tsx`, `Avatar.tsx`, `Spinner.tsx`, `Alert.tsx`, `Modal.tsx` (abierto/cerrado controlado con `modal-box`), `StatTile.tsx`, `ProgressBar.tsx`, `Icon.tsx` (SVG inline: `futbol`, `tarjeta`, `camiseta`, `trofeo`, `dorsal`, `usuario`, `dinero`, `calendar`, `chart`), `EmptyState.tsx`.

**`molecules/`**: `FormField.tsx` (label + control + error), `SearchInput.tsx`, `StatusBadge.tsx`
(inscripción/uniforme/sanción/estado de partido → color DaisyUI correcto), `PositionBadge.tsx`
(POR/DEF/MED/DEL con color propio), `RatingBadge.tsx` (rating 1–10 con color por rango),
`MatchMeta.tsx`, `SanctionChip.tsx` (tipo de tarjeta/multa), `Money.tsx` (formato `$ 1.200.000`),
`DateLabel.tsx`, `ConfirmAction.tsx`.

**`organisms/`**: `Sidebar.tsx` (menú según rol, activo con `menu-active`), `Topbar.tsx`,
`StatCardsRow.tsx`, `PlayersTable.tsx`, `PlayerFormModal.tsx`, `InscriptionsTable.tsx`,
`PaymentModal.tsx`, `UniformCatalog.tsx`, `UniformIssueList.tsx`, `UniformRequestsPanel.tsx`,
`MatchList.tsx`, `StrategyList.tsx`, `FormationPitch.tsx` (SVG: cancha vertical, líneas, slots en
`x/y` %, jugador con dorsal, estado vacío; props `slots`, `variant?: 'view'|'edit'`, `onSlotClick`),
`LineupEditor.tsx` (selector de formación + click en slot → modal para elegir jugador + botón
"Sugerir XI con IA" + "Guardar"), `StatsEntryForm.tsx` (tabla editable por jugador del partido),
`SanctionsTable.tsx` + `SanctionFormModal.tsx`, `PerformanceChart.tsx`, `RatingTrendChart.tsx`,
`AiInsightsPanel.tsx`, `AiPlayerCard.tsx`, `ProbabilityBars.tsx`, `ProfileForm.tsx`.

**`templates/`**: `AuthLayout.tsx`, `DashboardLayout.tsx` (drawer: sidebar izquierdo fijo + topbar
con nombre/rol y botón cerrar sesión + contenido con `PageHeader`), `PageHeader.tsx`
(título, subtítulo, acciones a la derecha), `ProtectedRoute.tsx`.

**`pages/`** — contenido obligatorio por página:

* **LoginPage**: tarjeta centrada, email/password, botón "Ingresar", link a registro, credenciales
  demo visibles en un `alert-info`.
* **RegisterPage**: nombre, email, teléfono, contraseña, posición y dorsal; redirige a `/jugador/inicio`.
* **PlayerDashboardPage**: `GET /api/dashboard/player` → 4 `StatTile` (estado de inscripción,
  próximo partido, calificación promedio, sanciones), tarjeta "Próximo partido" con fecha/rival y
  posición asignada en el pitch, últimos 5 ratings (`RatingTrendChart`), alerta si la inscripción no
  está saldada y atajo "Pedir uniforme".
* **MyInscriptionPage**: estado grande (badge + barra de progreso `paid/amount`), desglose de
  cuotas, tabla de pagos (fecha, método, referencia, monto), monto pendiente, condición de pago.
* **MyUniformsPage**: pestañas "Mis uniformes" (issues con estado/devolución) y "Solicitar" (catálogo
  con precio/stock + formulario de talla/motivo + lista de mis solicitudes con estado).
* **MatchesPage**: próximos (con formación y si estoy en el XI) y jugados (resultado) usando `MatchList`.
* **MatchDetailPage** (jugador): cabecera del partido, `FormationPitch` en modo vista con MI posición
  destacada, estrategias (`StrategyList` tipo timeline), mis stats de ese partido si existen.
* **MyProfilePage**: `ProfileForm` (teléfono, DNI, nacimiento, posición, secundaria, dorsal, estatura,
  peso, pie, contacto de emergencia) + cambio de contraseña + tarjeta de ficha (avatar, dorsal,
  antigüedad).
* **MyStatsPage**: resumen (`StatsSummary` en `StatTile`s), tabla de partidos con minutos/goles/
  asistencias/calificación, `PerformanceChart` de goles+asistencias por partido y
  `RatingTrendChart`.
* **MyAiPage**: `GET /api/me/ai` → `AiPlayerCard` (forecast con confianza y tendencia), fortalezas
  (`badge-success`) y debilidades (`badge-warning`), recomendación, y `RatingTrendChart`.
* **AdminDashboardPage**: `GET /api/dashboard/admin` → 4-6 `StatTile` (jugadores activos, cobrado,
  por cobrar, solicitudes pendientes), próximo partido, tabla "Inscripciones pendientes" con botón
  de cobro, sanciones recientes, stock bajo, `teamStats.topRated`.
* **PlayersPage**: buscador + tabla (`dorsal`, nombre, posición, edad, inscripción, calificación,
  sanciones) + botón "Nuevo jugador" (`PlayerFormModal`) + acciones editar/bajar.
* **PlayerDetailPage**: ficha + pestañas (Inscripciones, Uniformes, Sanciones, Estadísticas con
  charts + IA con `AiPlayerCard`).
* **InscriptionsPage**: filtros (temporada/estado) + tabla con barra de progreso + modal de cobro
  (`PaymentModal`) + crear inscripción + anotar pago; totales arriba (cobrado/pendiente).
* **UniformsPage**: pestañas "Catálogo" (CRUD + alerta de stock bajo), "Entregas" (issues con
  devolución) y "Solicitudes" (aprobar/rechazar/entregar con `ConfirmAction`).
* **MatchesPage (admin)**: lista con estado + formulario "Nuevo partido".
* **MatchBuilderPage**: el más importante. 3 zonas: (1) datos del partido + resultado/estado;
  (2) `LineupEditor` con formación (5 opciones), pitch editable, XI sugerido por IA y guardado;
  (3) estrategias (CRUD) y pestaña "Estadísticas" con `StatsEntryForm` (minutos, goles, asistencias,
  tiros, pases, tackles, tarjetas, rating por jugador) que guarda en `POST /api/matches/:id/stats`.
  Al guardar resultado con `status = 'jugado'`, mostrar el resultado.
* **SanctionsPage**: filtros + tabla + `SanctionFormModal` (jugador, tipo, motivo, monto, puntos,
  partido) + cambiar estado (activa/cumplida/anulada) + totales de multas.
* **StatsPage**: `GET /api/team/stats` → top goleadores/assistences/mejor valorado (`PerformanceChart`),
  promedios por posición, y tabla para editar stats de cualquier partido (selector de partido →
  `StatsEntryForm`).
* **AiPage**: `GET /api/ai/insights` → `ProbabilityBars` del próximo partido, `recommendedXI` en
  `FormationPitch` con botón "Aplicar al partido" (`POST /api/ai/recommend-xi` + `PUT .../lineup`),
  `AiInsightsPanel`, tabla `topPlayers` con rating predicho, métricas del modelo (MAE/RMSE/R²/muestras)
  y botón "Reentrenar modelo".

### 10.5 Calidad exigida

* `npm run build -w frontend` debe pasar: `tsc --noEmit` **sin errores** y `vite build` sin errores.
* `noUnusedLocals` y `noUnusedParameters` están activos: no dejes imports ni parámetros sin usar.
* Estados de carga (`Spinner`), vacío (`EmptyState`) y error (`Alert`) en cada página que consuma API.
* Responsive: sidebar colapsa en móvil (drawer de DaisyUI).

---

## 11. Definition of Done (verificación)

```bash
# Backend
npm run typecheck -w backend     # 0 errores
npm run build -w backend         # emite dist/
npm run seed -w backend          # crea data/portal.db con el resumen
node dist/main.js                # (o npm run dev) levanta :4000

# End-to-end (curl)
POST /api/auth/login {admin@club.com, Admin123!}  → 200 + token
GET  /api/dashboard/admin con token admin          → 200 + JSON
POST /api/auth/login {jugador01@club.com, Jugador123!} → 200
GET  /api/dashboard/player con token jugador       → 200
GET  /api/ai/insights sin token                    → 401
GET  /api/players con token de jugador             → 403
POST /api/ai/model/train con token admin           → 200 con metrics

# Frontend
npm run build -w frontend        # tsc + vite build sin errores
```

Reglas finales:
1. **No agregues ni quites dependencias** de ningún `package.json`.
2. No toques `vite.config.ts`, `index.html`, `tsconfig.json` ni `package.json` salvo para añadir
   scripts propios del backend (`seed` ya está).
3. Nada de `any` explícito salvo que sea imposible evitarlo; `strict` está activo.
4. Comentarios de código en español donde aporten.

---

# §12 · FORMATOS DE JUEGO (f5 / f7 / f8 / f11) — Extensión obligatoria

El portal debe servir a equipos de **fútbol 5, 7, 8 y 11**. El formato cambia todo:
jugadores en cancha, catálogo de formaciones, duración del partido (base de las métricas "por
partido"), cantidad de goles esperados y por lo tanto **la calibración del modelo de IA**.

**Decisiones del cliente:**
1. El formato se define en **Configuración global** (`team_settings.format`) y **cada partido puede
   sobreescribirlo** (`matches.format`). La IA usa **el formato del partido** cuando hay un partido
   concreto (XI, proyección) y el **formato del equipo** para las vistas de plantel.
2. La demo/seed arranca en **fútbol 8**.

---

## 12.1 Perfil de formato (fuente única de verdad)

Definir en `backend/src/domain/formats.ts` y espejar en `frontend/src/data/formations.ts`:

| | **f5** | **f7** | **f8** | **f11** |
|---|---|---|---|---|
| `format` | `5` | `7` | `8` | `11` |
| Jugadores en cancha | 5 (1 POR + 4) | 7 (1 POR + 6) | 8 (1 POR + 7) | 11 (1 POR + 10) |
| Minutos por partido (`matchMinutes`) | 40 | 50 | 60 | 90 |
| Formación por defecto | `1-2-1` | `1-2-3-1` | `1-3-3-1` | `4-3-3` |
| Plantel sugerido (`squadHint`) | `10-12` | `14-16` | `16-18` | `22-25` |
| Nombre (`name`) | `Fútbol 5` | `Fútbol 7` | `Fútbol 8` | `Fútbol 11` |
| **IA · goles a favor base** (`baselineFor`) | 7.0 | 6.0 | 5.0 | 1.45 |
| **IA · goles en contra base** (`baselineAgainst`) | 6.5 | 5.5 | 4.5 | 1.30 |
| **IA · tope de goles proyectados** (`xgClampMax`) | 14 | 12 | 10 | 5 |
| **IA · k logística** (`winProbK`) | 0.9 | 1.0 | 1.1 | 1.6 |
| **IA · log-peso del empate** (`drawLogWeight`) | -1.05 | -0.69 | -0.51 | 0.10 |
| **IA · bonus de localía** (`homeBonus`) | 0.10 | 0.12 | 0.15 | 0.15 |
| **IA · muestras mínimas** (`minSamples`) | 15 | 25 | 30 | 40 |

```ts
export type TeamFormat = 5 | 7 | 8 | 11;
export interface FormatProfile {
  format: TeamFormat; key: 'f5' | 'f7' | 'f8' | 'f11'; name: string;
  playersOnPitch: number; matchMinutes: number;
  defaultFormation: string; squadHint: string;
  ai: { baselineFor: number; baselineAgainst: number; xgClampMax: number;
        winProbK: number; drawLogWeight: number; homeBonus: number; minSamples: number };
}
export const FORMATS: Record<TeamFormat, FormatProfile>;   // y FORMAT_LIST: FormatProfile[]
export function getFormat(f: number): FormatProfile;       // fallback a f11 si no existe
```

**Normalización de métricas (CRÍTICO):** donde hoy se hace "por 90 min", ahora se calcula
**"por partido completo del formato"** de ese partido:

```
rate(value, minutes, formatMinutes) = value * formatMinutes / max(minutes, 1)
```

Es decir, `f1..f9` de §8.1 usan `formatMinutes` (40/50/60/90) en lugar del 90 fijo. En la UI de
estadísticas, para f5/f7/f8 la etiqueta es **"por partido"** y para f11 **"por 90'"** (o simplemente
"promedio por partido" en todos).

---

## 12.2 Catálogo de formaciones por formato

`backend/src/domain/formations.ts` y `frontend/src/data/formations.ts` deben exportar el **catálogo
entero** con esta forma:

```ts
export interface FormationSlot { slotIndex: number; x: number; y: number; role: 'POR'|'DEF'|'MED'|'DEL'; label: string }
export interface FormationDef  { key: string; name: string; format: TeamFormat; slots: FormationSlot[] }
// FORMATIONS pasa a ser FormationDef[]  (o Record<string, FormationDef>)
export function formationsFor(format: number): FormationDef[];
export function getFormation(key: string, format?: number): FormationDef; // fallback: defaultFormation del formato
```

Mismas coordenadas que §6 (`y=0` arco rival arriba, `y=100` arco propio abajo, portero `y=93`).
Las 5 formaciones de f11 de §6 **no cambian**. Las nuevas:

### f5 — 5 slots (default `1-2-1`)
```
1-2-1: 0 POR(50,93) POR · 1 DEF(30,74) LI · 2 DEF(70,74) LD · 3 MED(50,50) MED · 4 DEL(50,24) DC
1-1-2: 0 POR(50,93) POR · 1 DEF(50,76) LIB · 2 MED(50,52) MED · 3 DEL(34,26) DC · 4 DEL(66,26) DC
1-2-2: 0 POR(50,93) POR · 1 DEF(30,75) LI · 2 DEF(70,75) LD · 3 DEL(32,26) DC · 4 DEL(68,26) DC
```

### f7 — 7 slots (default `1-2-3-1`)
```
1-2-3-1: 0 POR(50,93) POR · 1 DEF(30,77) LI · 2 DEF(70,77) LD · 3 MED(20,56) MI · 4 MED(50,58) MC · 5 MED(80,56) MD · 6 DEL(50,26) DC
1-3-2-1: 0 POR(50,93) POR · 1 DEF(24,78) LI · 2 DEF(50,80) DFC · 3 DEF(76,78) LD · 4 MED(34,55) MC · 5 MED(66,55) MC · 6 DEL(50,26) DC
1-2-2-2: 0 POR(50,93) POR · 1 DEF(30,77) LI · 2 DEF(70,77) LD · 3 MED(30,54) MI · 4 MED(70,54) MD · 5 DEL(34,25) DC · 6 DEL(66,25) DC
```

### f8 — 8 slots (default `1-3-3-1`) ← **formato de la demo**
```
1-3-3-1: 0 POR(50,93) POR · 1 DEF(26,78) LI · 2 DEF(50,80) DFC · 3 DEF(76,78) LD · 4 MED(22,56) MI · 5 MED(50,58) MC · 6 MED(78,56) MD · 7 DEL(50,26) DC
1-2-3-2: 0 POR(50,93) POR · 1 DEF(32,78) LI · 2 DEF(68,78) LD · 3 MED(22,58) MI · 4 MED(50,56) MC · 5 MED(78,58) MD · 6 DEL(36,25) DC · 7 DEL(64,25) DC
1-3-2-2: 0 POR(50,93) POR · 1 DEF(26,78) LI · 2 DEF(50,80) DFC · 3 DEF(76,78) LD · 4 MED(34,56) MC · 5 MED(66,56) MC · 6 DEL(36,25) DC · 7 DEL(64,25) DC
```

### f11 — 11 slots (default `4-3-3`) — §6 sin cambios

**Validación obligatoria:** una formación solo es válida **dentro de su formato** (`slots.length`
debe ser igual a `profile.playersOnPitch`). `PUT /api/matches/:id/formation` y
`POST /api/ai/recommend-xi` deben devolver **400** si la formación no pertenece al formato del
partido.

---

## 12.3 Cambios de datos (SQLite)

Nueva tabla (agregar al final de `schema.sql`, antes de los índices):

```sql
CREATE TABLE IF NOT EXISTS team_settings (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  team_name  TEXT    NOT NULL DEFAULT 'Club Portal',
  format     INTEGER NOT NULL DEFAULT 8 CHECK (format IN (5,7,8,11)),
  season     TEXT    NOT NULL DEFAULT '2026',
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

`matches` gana dos columnas:

```sql
format  INTEGER NOT NULL DEFAULT 8 CHECK (format IN (5,7,8,11)),
minutes INTEGER NOT NULL DEFAULT 60
```

**Migración de BDs existentes** (la actual `portal.db` es f11): en `migrate.ts`, además de crear
tablas faltantes, hacer `ALTER TABLE ... ADD COLUMN` cuando `pragma_table_info` diga que no existe
la columna (`format`/`minutes` en `matches`; crear `team_settings` si falta y hacer `INSERT OR
IGNORE` con el formato por defecto `8`). El seed **recrea la BD completa** con formato 8.

---

## 12.4 Nuevos endpoints

| Método | Ruta | Rol | Body | Respuesta |
|---|---|---|---|---|
| GET | `/api/settings` | auth | — | `TeamSettings = { teamName, format: TeamFormat, season, profile: FormatProfile }` |
| PUT | `/api/settings` | admin | `{ teamName?, format?, season? }` | `TeamSettings` (valida `format ∈ {5,7,8,11}`) |
| GET | `/api/formations` | auth | — | `{ formats: FormatProfile[] , formations: FormationDef[] }` (catálogo completo, el front filtra por `format`) |

Modificados (§7):
* `POST /api/matches` y `PUT /api/matches/:id`: aceptan **`format`** (opcional; default
  `team_settings.format`) y **`minutes`** (opcional; default `profile.matchMinutes` del formato
  elegido). Si llega `format` y no `minutes`, `minutes` se deriva del perfil. La respuesta `Match`
  incluye `format` y `minutes`.
* `GET /api/matches/:id` → `{ match, strategies, lineup, stats }` igual, pero `lineup` debe tener
  exactamente `profile.playersOnPitch` slots (si no hay lineup, devolver los slots vacíos de la
  formación por defecto del formato).
* `PUT /api/matches/:id/lineup` → validar `slots.length === profile.playersOnPitch` (400 si no).
* `POST /api/ai/recommend-xi` → usa el formato del partido (no el global).
* `GET /api/ai/insights` → agrega **`format: TeamFormat`** y `nextMatchPrediction.format`; los
  `insights[]` pueden mencionar el formato ("en fútbol 8 se esperan ~5 goles por partido").
* `GET /api/dashboard/*` → `nextMatch` y `upcomingMatch` ya traen `format`/`minutes`.

Extender `Match` en §5 (y su espejo en `frontend/src/types/api.ts`):

```ts
export interface Match {
  /* ...campos actuales... */
  format: TeamFormat;   // 5 | 7 | 8 | 11
  minutes: number;      // duración efectiva del partido
}
```

---

## 12.5 IA recalibrada por formato (reemplaza §8.4 y §8.5)

Mantener §8.1 (features), §8.2 (entrenamiento) y §8.6/§8.7, **cambiando**:

1. **Normalización** → `rate(v, minutes, formatMinutes)` de §12.1 (no más 90 fijo).
2. **`minSamples`** → usar `profile.ai.minSamples` en lugar del `20` fijo de §8.2.
3. **XI recomendado** → slots de `formationsFor(match.format)`; `playersOnPitch` del perfil.
   El greedy y la mejora local de §8.4 se mantienen igual.
4. **Probabilidad de resultado** → **softmax de 3 vías** (siempre suma 1, empate real):

   ```
   δ = teamRating - oppRating + (isHome ? profile.ai.homeBonus : -profile.ai.homeBonus)
   eWin  = exp(  k · δ )
   eDraw = exp(  d0 )            // d0 = profile.ai.drawLogWeight  (constante por formato)
   eLoss = exp( -k · δ )
   k = profile.ai.winProbK
   pWin  = eWin / (eWin + eDraw + eLoss)
   pDraw = eDraw / (eWin + eDraw + eLoss)
   pLoss = eLoss / (eWin + eDraw + eLoss)      // suman 1 exacto, sin clamp ni renormalizar
   ```
   `oppRating` sigue igual que §8.5 (baseline 6.40 o promedio de enfrentamientos previos).
5. **Goles proyectados** → por formato:

   ```
   xgFor     = clamp(profile.ai.baselineFor     * exp(0.6 * (teamRating - oppRating)), 0.15, profile.ai.xgClampMax)
   xgAgainst = clamp(profile.ai.baselineAgainst * exp(-0.5 * (teamRating - oppRating)), 0.15, profile.ai.xgClampMax)
   ```
   Redondear a 1 decimal.
6. **`model.json`** → guardar `format` entrenado y `formatMinutes` usados. Si cambia el formato del
   equipo, el modelo se reentrena con los datos existentes (las features ya están normalizadas por el
   formato de cada partido, por lo que son comparables entre formatos).
7. **`teamRating`** → promedio de los `predictedRating` de los titulares del XI (o de los
   `playersOnPitch` mejores del plantel si no hay lineup).

Expectativa de verificación: con el seed f8, `POST /api/ai/model/train` debe dar `r2 > 0.3`,
`POST /api/ai/recommend-xi` debe devolver **8 slots** (no 11) y las probabilidades deben sumar 1.

---

## 12.6 Seed en fútbol 8

* `team_settings`: `team_name = 'Club Portal'`, `format = 8`, `season = '2026'`.
* Los **8 partidos** (6 jugados + 2 próximos): `format = 8`, `minutes = 60`,
  `formation = '1-3-3-1'` (y uno de los próximos en `1-2-3-2` para mostrar variedad).
* `lineups`: **8 slots** por partido (el primero de los próximos, completo con titulares coherentes
  con su posición).
* `match_stats`: **≥ 8 filas por partido** (rotaciones) → ≥ 60 filas en total, ratings 5.0–9.5
  correlacionados con su rendimiento; los minutos deben respetar `minutes = 60` (nunca > 60).
* Estrategias, inscripciones, uniformes, sanciones y usuarios: **sin cambios** (14 jugadores,
  `jugador01..jugador14@club.com` / `Jugador123!`, admin `admin@club.com` / `Admin123!`).
* El resto de la lógica del seed (§9) se mantiene.

---

## 12.7 Frontend

1. **`data/formations.ts`** → catálogo por formato (§12.2) + perfiles `FORMATS` de §12.1 (mismos
   números que el backend).
2. **`FormationPitch`** → prop opcional `format`; **relación de aspecto del lienzo según formato**
   (coordenadas x/y siguen en 0–100, solo cambia el contenedor):
   | formato | clase de aspecto | orientación |
   |---|---|---|
   | f5 | `aspect-[2/1]` | ancho y bajo |
   | f7 | `aspect-[3/2]` | — |
   | f8 | `aspect-[7/5]` | — |
   | f11 | `aspect-[2/3]` | alto (vertical) |
3. **`LineupEditor`** → formaciones filtradas por `match.format`; el editor pide exactamente
   `playersOnPitch` jugadores y muestra el contador "8 / 8 en cancha".
4. **Página nueva `/admin/configuracion`** (`pages/admin/SettingsPage.tsx`):
   * `GET /api/settings` → editar nombre del club, **selector de formato** (4 tarjetas f5/f7/f8/f11
     con jugadores en cancha, duración y formaciones disponibles), temporada.
   * Guarda con `PUT /api/settings` y recarga. Enlace en el sidebar de admin.
   * Explicación visible: *"El formato global es el valor por defecto de los nuevos partidos; cada
     partido puede cambiarlo al crearlo."*
5. **`MatchesPage` (admin)** → al crear/editar partido, selector de **formato** (default = el del
   equipo) y duración derivada.
6. **`MatchBuilderPage`** → mostrar badge `Fútbol 8 · 60'` y usar el formato del partido en
   `LineupEditor` y en "Sugerir XI con IA".
7. **`StatsEntryForm`** → el campo minutos no puede superar `match.minutes` (validación + texto
   "máx. 60'").
8. **`AiPage`** → proyección de goles coherente con el formato (f8 ≈ 5 goles, no 1.3), mostrar
   formato en el título, y usar formaciones del formato.
9. **`MyStatsPage` / `StatsPage` / `MyAiPage`** → etiquetas "por partido" (o "por 90'" solo en f11).
10. El resto de rutas y páginas no cambian.

---

## 12.8 Definition of Done (§11 ampliada)

```bash
npm run typecheck && npm run build        # 0 errores
npm run seed -w backend                   # BD en fútbol 8: team_settings.format = 8
# smoke:
GET  /api/settings (admin)                → 200 { format: 8, profile.playersOnPitch: 8 }
PUT  /api/settings {"format":5}           → 200 (luego volver a 8 para la demo)
GET  /api/formations                      → 200 con 4 formatos y 14 formaciones en total
POST /api/ai/recommend-xi (match f8)      → 200 con EXACTAMENTE 8 slots
POST /api/ai/model/train                  → 200 con r2 > 0.3
GET  /api/ai/insights                     → probabilidades suman 1 y xg coherente con f8 (~5 goles)
PUT  /api/matches/:id/formation {"formation":"4-3-3"} sobre un partido f8  → 400 (formación de f11)
PUT  /api/matches/:id/lineup con 11 slots sobre partido f8                 → 400
```
