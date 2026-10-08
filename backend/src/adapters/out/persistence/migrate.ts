import fs from 'node:fs';
import path from 'node:path';
import type { Database } from 'better-sqlite3';
import { FORMATION_LIST } from '../../../domain/formations';
import { getFormat } from '../../../domain/formats';
import { getDb } from './database';
import { migrateNotifications } from './repositories/notification.repository';

/** Rutas candidatas para `schema.sql` (funciona con tsx desde src/ y con node desde dist/). */
function resolveSchemaPath(): string {
  const candidates = [
    path.join(__dirname, 'schema.sql'),
    path.resolve(__dirname, '../../../../src/adapters/out/persistence/schema.sql'),
    path.resolve(process.cwd(), 'src/adapters/out/persistence/schema.sql'),
    path.resolve(process.cwd(), 'dist/adapters/out/persistence/schema.sql'),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(
      `No se encontró schema.sql. Rutas probadas:\n${candidates.map((c) => ` - ${c}`).join('\n')}`,
    );
  }
  return found;
}

function hasTable(db: Database, table: string): boolean {
  const row = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
    .get(table);
  return Boolean(row);
}

/** true si la tabla tiene la columna (via `pragma_table_info`, §12.3). */
function hasColumn(db: Database, table: string, column: string): boolean {
  if (!hasTable(db, table)) return false;
  const rows = db.pragma(`table_info(${table})`) as Array<{ name: string }>;
  return rows.some((row) => row.name === column);
}

/**
 * Migración defensiva de BDs existentes (§12.3):
 * `ALTER TABLE ... ADD COLUMN` para `matches.format` / `matches.minutes`,
 * creación de `team_settings` si falta e `INSERT OR IGNORE` con formato 8.
 */
function ensureFormatSupport(db: Database): void {
  if (hasTable(db, 'matches')) {
    let addedFormat = false;
    if (!hasColumn(db, 'matches', 'format')) {
      db.exec(`ALTER TABLE matches ADD COLUMN format INTEGER NOT NULL DEFAULT 8 CHECK (format IN (5,7,8,11))`);
      addedFormat = true;
    }
    if (!hasColumn(db, 'matches', 'minutes')) {
      db.exec(`ALTER TABLE matches ADD COLUMN minutes INTEGER NOT NULL DEFAULT 50`);
    }

    // BD legada (los partidos existentes eran de fútbol 11): se deriva el
    // formato y la duración a partir de la formación, que es única por formato
    // en el catálogo (§12.2), para que los datos sigan siendo coherentes.
    if (addedFormat) {
      const update = db.prepare(`UPDATE matches SET format = ?, minutes = ? WHERE formation = ?`);
      for (const formation of FORMATION_LIST) {
        update.run(formation.format, getFormat(formation.format).matchMinutes, formation.key);
      }
    }
  }

  if (!hasTable(db, 'team_settings')) {
    db.exec(`CREATE TABLE IF NOT EXISTS team_settings (
      id         INTEGER PRIMARY KEY CHECK (id = 1),
      team_name  TEXT    NOT NULL DEFAULT 'Club Portal',
      format     INTEGER NOT NULL DEFAULT 8 CHECK (format IN (5,7,8,11)),
      season     TEXT    NOT NULL DEFAULT '2026',
      updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
    )`);
  }
  db.prepare(
    `INSERT OR IGNORE INTO team_settings (id, team_name, format, season) VALUES (1, 'Club Portal', 8, '2026')`,
  ).run();
}

/**
 * Crea `backend/data/` si no existe, abre la BD, ejecuta `schema.sql` cuando
 * la tabla `users` no existe (§4) y aplica la migración de formatos (§12.3)
 * tanto en BDs nuevas como en existentes.
 */
export function migrate(db: Database = getDb()): void {
  const table = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'`)
    .get();
  if (!table) {
    const script = fs.readFileSync(resolveSchemaPath(), 'utf8');
    db.exec(script);
  }
  ensureFormatSupport(db);
  db.exec(`CREATE TABLE IF NOT EXISTS registration_requests (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pendiente' CHECK(status IN ('pendiente','aprobada')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL, reviewed_at TEXT
  ); CREATE TABLE IF NOT EXISTS media_deletion_jobs (
    asset_id TEXT PRIMARY KEY, stored_name TEXT NOT NULL
  );`);
  const duplicateNumbers = db.prepare(`SELECT shirt_number FROM players WHERE shirt_number IS NOT NULL
    GROUP BY shirt_number HAVING COUNT(*) > 1`).all() as Array<{ shirt_number: number }>;
  if (duplicateNumbers.length) {
    throw new Error(`Hay dorsales repetidos (${duplicateNumbers.map(row => row.shirt_number).join(', ')}). Corrige sus asignaciones antes de activar la restricción de dorsales únicos.`);
  }
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_players_unique_shirt_number ON players(shirt_number) WHERE shirt_number IS NOT NULL');
  db.exec(`CREATE TABLE IF NOT EXISTS migration_state(id INTEGER PRIMARY KEY CHECK(id=1), enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)), imported_at TEXT);
    INSERT OR IGNORE INTO migration_state(id) VALUES(1);`);
  if(!hasColumn(db,'matches','stream_url'))db.exec('ALTER TABLE matches ADD COLUMN stream_url TEXT');
  db.exec(`CREATE TABLE IF NOT EXISTS auth_sessions(id TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,stamp TEXT NOT NULL,expires_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS auth_session_user ON auth_sessions(user_id);
    CREATE TABLE IF NOT EXISTS registration_invitation(id INTEGER PRIMARY KEY CHECK(id=1),digest TEXT NOT NULL,expires_at INTEGER NOT NULL);`);
  if (!hasColumn(db, 'players', 'eps')) db.exec('ALTER TABLE players ADD COLUMN eps TEXT');
  if (!hasColumn(db, 'players', 'prepaid_health')) db.exec('ALTER TABLE players ADD COLUMN prepaid_health TEXT');
  if (!hasColumn(db, 'team_settings', 'logo_url')) db.exec("ALTER TABLE team_settings ADD COLUMN logo_url TEXT DEFAULT '/brand/aag-logo.jpg'");
  if (!hasColumn(db, 'team_settings', 'brand_color')) db.exec("ALTER TABLE team_settings ADD COLUMN brand_color TEXT NOT NULL DEFAULT '#d8b86a'");
  if (!hasColumn(db, 'uniforms', 'image_url')) db.exec('ALTER TABLE uniforms ADD COLUMN image_url TEXT');
  ensureUniformOrders(db);
  db.exec(`CREATE TABLE IF NOT EXISTS tournaments (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, league_name TEXT NOT NULL,
    season TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('borrador','publicado','archivado')),
    rules_json TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS tournament_players (
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    registered_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (tournament_id, player_id)
  );
  CREATE INDEX IF NOT EXISTS idx_tournament_players_player ON tournament_players(player_id);
  CREATE TABLE IF NOT EXISTS media_assets (
    id TEXT PRIMARY KEY, owner_id INTEGER NOT NULL REFERENCES users(id),
    purpose TEXT NOT NULL CHECK(purpose IN ('logo','avatar','uniform','tournament')),
    file_name TEXT NOT NULL, stored_name TEXT NOT NULL, mime_type TEXT NOT NULL,
    size INTEGER NOT NULL, extracted_text TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS tournament_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT, tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    title TEXT NOT NULL, asset_id TEXT NOT NULL UNIQUE REFERENCES media_assets(id), file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL, extracted_text TEXT NOT NULL DEFAULT '',
    extraction_status TEXT NOT NULL CHECK(extraction_status IN ('extraido','requiere_texto')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`);
  if (!hasColumn(db, 'team_settings', 'default_tournament_id')) db.exec('ALTER TABLE team_settings ADD COLUMN default_tournament_id INTEGER REFERENCES tournaments(id)');
  if (!hasColumn(db, 'matches', 'tournament_id')) db.exec('ALTER TABLE matches ADD COLUMN tournament_id INTEGER REFERENCES tournaments(id)');
  if (!hasColumn(db, 'matches', 'tournament_rules')) db.exec('ALTER TABLE matches ADD COLUMN tournament_rules TEXT');
  if (!hasColumn(db, 'payments', 'idempotency_key')) {
    db.exec('ALTER TABLE payments ADD COLUMN idempotency_key TEXT');
  }
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_idempotency ON payments(inscription_id, idempotency_key) WHERE idempotency_key IS NOT NULL');
  const legacyLineups = !hasColumn(db, 'matches', 'lineup_published_at');
  if (legacyLineups) db.exec('ALTER TABLE matches ADD COLUMN lineup_published_at TEXT');
  if (!hasColumn(db, 'matches', 'published_formation')) db.exec('ALTER TABLE matches ADD COLUMN published_formation TEXT');
  ensureQrPayments(db);
  if (!hasColumn(db, 'tournaments', 'image_asset_id')) db.exec('ALTER TABLE tournaments ADD COLUMN image_asset_id TEXT REFERENCES media_assets(id)');
  db.exec(`CREATE TABLE IF NOT EXISTS published_lineups (
    match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    slot_index INTEGER NOT NULL, player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
    x REAL NOT NULL, y REAL NOT NULL, role TEXT NOT NULL, label TEXT NOT NULL,
    PRIMARY KEY(match_id, slot_index)
  );
  CREATE TABLE IF NOT EXISTS match_attendance (
    match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK(status IN ('pendiente','confirmado','no_disponible')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY(match_id, player_id)
  );`);
  db.exec(`CREATE TABLE IF NOT EXISTS match_referee_fees (
    match_id INTEGER PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
    total INTEGER NOT NULL DEFAULT 120000 CHECK(total>=0), settled_shares TEXT
  ); INSERT OR IGNORE INTO match_referee_fees(match_id) SELECT id FROM matches WHERE status IN ('programado','pospuesto');`);
  if (!hasColumn(db,'match_referee_fees','settled_shares')) db.exec('ALTER TABLE match_referee_fees ADD COLUMN settled_shares TEXT');
  db.exec(`CREATE TABLE IF NOT EXISTS match_referee_transfers (
    receipt_id INTEGER NOT NULL REFERENCES payment_receipts(id) ON DELETE CASCADE,
    match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL CHECK(amount>0), PRIMARY KEY(receipt_id,match_id)
  );`);
  if (legacyLineups) {
    db.exec(`INSERT OR IGNORE INTO published_lineups SELECT match_id, slot_index, player_id, x, y, role, label FROM lineups;
      UPDATE matches SET lineup_published_at = datetime('now'), published_formation = formation WHERE id IN (SELECT DISTINCT match_id FROM published_lineups);`);
  }
}

/** Extend the catalogue without changing existing columns, IDs or linked orders. */
function ensureUniformOrders(db:Database):void {
  const uniforms=db.prepare("SELECT sql FROM sqlite_master WHERE name='uniforms'").get() as {sql:string};
  if(!uniforms.sql.includes("'completo'")) {
    const extended=uniforms.sql.replace(/^CREATE TABLE\s+(?:IF NOT EXISTS\s+)?["`]?uniforms["`]?/i,'CREATE TABLE uniforms_extended').replace(/'guantes'\s*\)/,"'guantes','completo')");
    if(!extended.startsWith('CREATE TABLE uniforms_extended')||!extended.includes("'completo'"))throw new Error('Esquema de uniformes no compatible');
    db.pragma('foreign_keys = OFF');
    try {db.transaction(()=>{
      db.exec(extended);
      db.exec('INSERT INTO uniforms_extended SELECT * FROM uniforms; DROP TABLE uniforms; ALTER TABLE uniforms_extended RENAME TO uniforms;');
      if((db.pragma('foreign_key_check') as unknown[]).length)throw new Error('Referencias de uniformes inconsistentes');
    })();}finally{db.pragma('foreign_keys = ON');}
  }
  db.exec(`CREATE TABLE IF NOT EXISTS uniform_recipients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER UNIQUE REFERENCES uniform_requests(id) ON DELETE CASCADE,
    issue_id INTEGER UNIQUE REFERENCES uniform_issues(id) ON DELETE CASCADE,
    recipient_type TEXT NOT NULL CHECK(recipient_type IN ('pareja','hijo')),
    recipient_name TEXT NOT NULL CHECK(length(trim(recipient_name)) BETWEEN 1 AND 120),
    CHECK((request_id IS NULL) <> (issue_id IS NULL))
  );`);
}

/** Rebuild only the media CHECK constraint; retain IDs and document references. */
function ensureQrPayments(db: Database): void {
  const media = db.prepare("SELECT sql FROM sqlite_master WHERE name = 'media_assets'").get() as { sql: string };
  if (!media.sql.includes("'receipt'") || !media.sql.includes("'tournament_image'")) {
    db.pragma('foreign_keys = OFF');
    try {
      db.transaction(() => {
        db.exec(`CREATE TABLE media_assets_extended (
          id TEXT PRIMARY KEY, owner_id INTEGER NOT NULL REFERENCES users(id),
          purpose TEXT NOT NULL CHECK(purpose IN ('logo','avatar','uniform','tournament','tournament_image','receipt','payment_qr')),
          file_name TEXT NOT NULL, stored_name TEXT NOT NULL, mime_type TEXT NOT NULL,
          size INTEGER NOT NULL, extracted_text TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now'))
        ); INSERT INTO media_assets_extended SELECT * FROM media_assets;
        DROP TABLE media_assets; ALTER TABLE media_assets_extended RENAME TO media_assets;`);
        if ((db.pragma('foreign_key_check') as unknown[]).length) throw new Error('Referencias de archivos inconsistentes');
      })();
    } finally { db.pragma('foreign_keys = ON'); }
  }
  if (!hasColumn(db, 'uniform_requests', 'issue_id')) db.exec('ALTER TABLE uniform_requests ADD COLUMN issue_id INTEGER REFERENCES uniform_issues(id)');
  if (!hasColumn(db, 'uniform_requests', 'quoted_price')) db.exec('ALTER TABLE uniform_requests ADD COLUMN quoted_price REAL');
  db.exec(`CREATE TABLE IF NOT EXISTS qr_payment_settings (
    id INTEGER PRIMARY KEY CHECK(id=1), asset_id TEXT REFERENCES media_assets(id), recipient TEXT NOT NULL DEFAULT '', payment_key TEXT NOT NULL DEFAULT ''
  ); INSERT OR IGNORE INTO qr_payment_settings(id) VALUES(1);
  CREATE TABLE IF NOT EXISTS payment_receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT, player_id INTEGER NOT NULL REFERENCES players(id),
    kind TEXT NOT NULL CHECK(kind IN ('inscription','uniform_request','uniform_issue','referee')),
    target_id INTEGER NOT NULL, asset_id TEXT NOT NULL UNIQUE REFERENCES media_assets(id),
    amount REAL NOT NULL CHECK(amount>0), reference TEXT NOT NULL, paid_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendiente' CHECK(status IN ('pendiente','aprobado','rechazado')),
    review_notes TEXT NOT NULL DEFAULT '', reviewed_by INTEGER REFERENCES users(id), reviewed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    idempotency_key TEXT NOT NULL, file_hash TEXT NOT NULL, UNIQUE(player_id,idempotency_key)
  ); CREATE UNIQUE INDEX IF NOT EXISTS idx_receipt_approved_reference ON payment_receipts(reference) WHERE status='aprobado';`);
  if (!hasColumn(db, 'payment_receipts', 'file_hash')) db.exec("ALTER TABLE payment_receipts ADD COLUMN file_hash TEXT NOT NULL DEFAULT ''");
  const receipts = db.prepare("SELECT sql FROM sqlite_master WHERE name='payment_receipts'").get() as {sql:string};
  if (!receipts.sql.includes("'referee'")) {
    db.pragma('foreign_keys = OFF');
    try {
      db.transaction(()=>{
        db.exec(receipts.sql.replace('CREATE TABLE payment_receipts','CREATE TABLE payment_receipts_extended').replace("'uniform_issue')","'uniform_issue','referee')"));
        db.exec(`INSERT INTO payment_receipts_extended SELECT * FROM payment_receipts;
          DROP TABLE payment_receipts; ALTER TABLE payment_receipts_extended RENAME TO payment_receipts;
          CREATE UNIQUE INDEX idx_receipt_approved_reference ON payment_receipts(reference) WHERE status='aprobado';`);
        if ((db.pragma('foreign_key_check') as unknown[]).length) throw new Error('Referencias de pagos inconsistentes');
      })();
    } finally { db.pragma('foreign_keys = ON'); }
  }
  migrateNotifications(db);
}
