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
  eps                TEXT,
  prepaid_health     TEXT,
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
  kind       TEXT NOT NULL CHECK (kind IN ('completo','camiseta','pantalon','medias','buzo','entrenamiento','guantes')),
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
  format        INTEGER NOT NULL DEFAULT 8 CHECK (format IN (5,7,8,11)),
  minutes       INTEGER NOT NULL DEFAULT 50,
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

CREATE TABLE IF NOT EXISTS team_settings (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  team_name  TEXT    NOT NULL DEFAULT 'Club Portal',
  format     INTEGER NOT NULL DEFAULT 8 CHECK (format IN (5,7,8,11)),
  season     TEXT    NOT NULL DEFAULT '2026',
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_players_user      ON players(user_id);
CREATE INDEX IF NOT EXISTS idx_inscriptions_pl   ON inscriptions(player_id);
CREATE INDEX IF NOT EXISTS idx_stats_match       ON match_stats(match_id);
CREATE INDEX IF NOT EXISTS idx_stats_player      ON match_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_sanctions_player  ON sanctions(player_id);
CREATE INDEX IF NOT EXISTS idx_lineups_match     ON lineups(match_id);
