import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { spawnSync } from 'node:child_process';
import Database from 'better-sqlite3';
import { asyncFilter } from "../backend/src/application/services/shared";

// Never use the demo database: every run owns a fresh temporary directory.
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'futapp-tests-'));
process.env.DB_PATH = path.join(directory, 'portal.db');
process.env.JWT_SECRET = 'futapp-test-secret-isolated-1234567890';
process.env.NODE_ENV = 'test';
const { migrate } = await import('../backend/src/adapters/out/persistence/migrate');
const { getDb, closeDb } = await import('../backend/src/adapters/out/persistence/database');
const { createContainer } = await import('../backend/src/container');
const { createHttpServer } = await import('../backend/src/adapters/in/rest/http-server');
const { extractForecastSamples } = await import('../backend/src/domain/model/features');
const { getFormat: backendFormat } = await import('../backend/src/domain/formats');
const { getFormat: frontendFormat } = await import('../frontend/src/data/formations');
migrate();
const db = getDb();
const adminId = Number(db.prepare("INSERT INTO users(email,password_hash,full_name,role) VALUES (?,?,?,'admin')")
  .run('admin@test.com', bcrypt.hashSync('AdminTest123!', 4), 'Admin').lastInsertRowid);
const c = createContainer();
const users = new (await import('../backend/src/adapters/out/persistence/repositories/user.repository')).SqliteUserRepository(db);
const players = await Promise.all(Array.from({ length: 11 }, async (_, i) => (await c.playerService.create({
  email: `player${i}@test.com`, password: 'PlayerTest123456!', fullName: `Jugador ${i}`,
  position: i === 0 ? 'POR' : i < 5 ? 'DEF' : i < 8 ? 'MED' : 'DEL', shirtNumber: i + 1,
}))));
const adminToken = (await c.authService.login({ email: 'admin@test.com', password: 'AdminTest123!' })).token;
let playerToken = (await c.authService.login({ email: 'player0@test.com', password: 'PlayerTest123456!' })).token;
const app = createHttpServer({ notifications: c.notificationService, qrPayments: c.qrPaymentService, tournaments: c.tournamentService, media: c.mediaService, auth: c.authService, me: c.meService, players: c.playerService,
  inscriptions: c.inscriptionService, uniforms: c.uniformService, matches: c.matchService,
  sanctions: c.sanctionService, stats: c.statsService, ai: c.aiService,
  dashboard: c.dashboardService, settings: c.settingsService });
const server = app.listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.once('listening', resolve));
const address = server.address();
assert(address && typeof address !== 'string');
const base = `http://127.0.0.1:${address.port}`;
async function request(method: string, url: string, json?: unknown, token = adminToken, extra = {}) {
  const response = await fetch(base + '/api' + url, { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra },
    ...(json !== undefined ? { body: JSON.stringify(json) } : {}) });
  return { status: response.status, data: await response.json() };
}
async function fixtureMatch(format = 5) {
  const match=await c.matchService.create({ opponent: 'Prueba FC', competition: 'Prueba', kickOff: '2027-01-15T18:00', isHome: true, format });
  // These fixtures isolate lineup/attendance rules; charged fixtures are covered in referee.test.
  db.prepare('UPDATE match_referee_fees SET total=0 WHERE match_id=?').run(match.id);
  return match;
}

test('football 8 defaults to 50 minutes in the UI, API and AI while preserving explicit durations', async () => {
  assert.equal(backendFormat(8).matchMinutes, 50);
  assert.equal(frontendFormat(8).matchMinutes, 50);
  assert.equal(backendFormat(8).playersOnPitch, 8);
  const match = await request('POST', '/matches', { opponent: 'F8 default', kickOff: '2027-03-01T18:00', tournamentId: null, format: 8 });
  assert.equal(match.status, 200);
  assert.equal(match.data.minutes, 50);
  assert.equal((await request('POST', `/matches/${match.data.id}/stats`, { entries: [{ playerId: players[0].player.id, minutes: 51 }] })).status, 400);
  const custom = await request('POST', '/matches', { opponent: 'F8 custom', kickOff: '2027-03-02T18:00', tournamentId: null, format: 8, minutes: 60 });
  assert.equal(custom.data.minutes, 60);
  assert.equal((await request('PUT', `/matches/${custom.data.id}`, { venue: 'Otra cancha' })).data.minutes, 60);
  assert.equal((await c.aiService.getModelInfo()).formatMinutes, 50);
  assert.equal(backendFormat(11).matchMinutes, 90);
});

test('shirt numbers are unique across creation, registration, own profile and administrative edits', async () => {
  const before = (db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n;
  const duplicate = await request('POST', '/players', { email: 'duplicate-number@test.com', password: 'DuplicateNumber123!', fullName: 'Duplicado', position: 'DEF', shirtNumber: 5 });
  assert.equal(duplicate.status, 400);
  assert.equal(duplicate.data.error.code, 'SHIRT_NUMBER_TAKEN');
  assert.match(duplicate.data.error.message, /dorsal 5/);
  assert.equal((db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n, before);
  const oldName = (await c.playerService.get(players[1].player.id)).user.fullName;
  assert.equal((await request('PUT', `/players/${players[1].player.id}`, { fullName: 'No debe guardarse', shirtNumber: 1 })).status, 400);
  assert.equal((await c.playerService.get(players[1].player.id)).user.fullName, oldName);
  const oldPhone = (await c.authService.me(players[0].user.id)).user.phone;
  assert.equal((await request('PUT', '/me/profile', { phone: 'No debe guardarse', shirtNumber: 2 }, playerToken)).status, 400);
  assert.equal((await c.authService.me(players[0].user.id)).user.phone, oldPhone);
  assert.equal((await request('PUT', '/me/profile', { shirtNumber: 1 }, playerToken)).status, 200);
  assert.throws(() => db.prepare('UPDATE players SET shirt_number = 1 WHERE id = ?').run(players[1].player.id), /UNIQUE constraint failed/);
  // A disabled player still owns their number until it is explicitly cleared.
  (await users.update(players[10].user.id, { active: false }));
  try {
    assert.equal((await request('POST', '/players', { email: 'disabled-number@test.com', password: 'DuplicateNumber123!', fullName: 'Duplicado', position: 'DEF', shirtNumber: 11 })).status, 400);
  } finally { (await users.update(players[10].user.id, { active: true })); }
  const invitationCode = (await c.authService.createInvitation()).code;
  const competing = await Promise.all([0, 1].map(async i => (await request('POST', '/auth/register', { invitationCode, email: `number-race${i}@test.com`, password: 'DuplicateNumber123!', fullName: 'Registro de prueba', shirtNumber: 222 }, ''))));
  assert.deepEqual(competing.map(result => result.status).sort(), [200, 400]);
  assert.equal(competing.find(result => result.status === 400)!.data.error.code, 'SHIRT_NUMBER_TAKEN');
  const created = competing.find(result => result.status === 200)!.data;
  assert.equal((await request('PUT', `/players/${created.player.id}`, { shirtNumber: null })).status, 200);
  const released = (await c.playerService.create({ email: 'released-number@test.com', password: 'DuplicateNumber123!', fullName: 'Número liberado', position: 'DEF', shirtNumber: 222 }));
  assert.equal(released.player.shirtNumber, 222);
  for (const id of [created.player.id, released.player.id]) db.prepare('DELETE FROM players WHERE id = ?').run(id);
  for (const id of [created.user.id, released.user.id]) db.prepare('DELETE FROM users WHERE id = ?').run(id);
  assert.equal((db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n, before);
});

test('unique-shirt migration preserves legacy assignments and refuses duplicates without silently renumbering', () => {
  db.exec('DROP INDEX idx_players_unique_shirt_number');
  db.prepare('UPDATE players SET shirt_number = 1 WHERE id = ?').run(players[1].player.id);
  try {
    assert.throws(() => migrate(), /dorsales repetidos \(1\)/);
    assert.equal((db.prepare('SELECT COUNT(*) AS n FROM players WHERE shirt_number = 1').get() as { n: number }).n, 2);
  } finally {
    db.prepare('UPDATE players SET shirt_number = 2 WHERE id = ?').run(players[1].player.id);
    migrate();
  }
  assert.equal((db.prepare('SELECT "unique" AS n FROM pragma_index_list(\'players\') WHERE name = ?').get('idx_players_unique_shirt_number') as { n: number }).n, 1);
});

test('health coverage persists through admin and own profile edits without exposing another player', async () => {
  const created = await request('POST', '/players', {
    email: 'health@test.com', password: 'HealthTest123456!', fullName: 'Prueba salud', position: 'MED',
    phone: '3000000000', eps: ' EPS de prueba ', prepaidHealth: ' Plan de prueba ',
  });
  assert.equal(created.status, 200);
  const id = created.data.player.id;
  assert.equal(created.data.player.eps, 'EPS de prueba');
  assert.equal(created.data.player.prepaidHealth, 'Plan de prueba');
  const ownToken = (await c.authService.login({ email: 'health@test.com', password: 'HealthTest123456!' })).token;
  const edited = await request('PUT', '/me/profile', { eps: 'Otra EPS', prepaidHealth: null }, ownToken);
  assert.equal(edited.status, 200);
  assert.equal(edited.data.user.phone, '3000000000');
  assert.equal(edited.data.player.prepaidHealth, null);
  assert.equal((await request('GET', `/players/${id}`)).data.player.eps, 'Otra EPS');
  assert.equal((await request('GET', `/players/${id}`, undefined, playerToken)).status, 403);
  assert.equal((await request('PUT', `/players/${id}`, { eps: 'Cambio ajeno' }, playerToken)).status, 403);
  assert.equal((await request('PUT', '/me/profile', { playerId: id, eps: 'Cambio ajeno' }, playerToken)).status, 400);
  assert.equal((await request('PUT', '/me/profile', { eps: 'x'.repeat(121) }, ownToken)).status, 400);
  assert.equal((await request('PUT', '/me/profile', { prepaidHealth: true }, ownToken)).status, 400);
  assert.equal((await request('GET', '/me', undefined, '')).status, 401);
  const adminEdit = await request('PUT', `/players/${id}`, { prepaidHealth: 'Nueva prepagada', emergencyContact: 'Contacto de prueba' });
  assert.equal(adminEdit.status, 200);
  assert.equal((await request('GET', '/me', undefined, ownToken)).data.player.prepaidHealth, 'Nueva prepagada');
  assert.equal((await request('GET', '/me', undefined, playerToken)).data.player.eps, null);
  assert.equal((await request('PUT', '/me/profile', { eps: '   ', prepaidHealth: null }, ownToken)).data.player.eps, null);
  // Keep the existing team fixtures and forecasting samples unchanged for subsequent tests.
  db.prepare('DELETE FROM players WHERE id = ?').run(id);
  db.prepare('DELETE FROM users WHERE id = ?').run(created.data.user.id);
});

async function fileRequest(url: string, bytes: Uint8Array, name: string, token = adminToken) {
  const body = new FormData(); body.append('file', new Blob([Uint8Array.from(bytes)]), name);
  const response = await fetch(base + '/api' + url, { method: 'POST', body, headers: { Authorization: `Bearer ${token}` } });
  return { status: response.status, data: await response.json() };
}
function tournamentInput(status = 'publicado') {
  return { name: 'Copa de pruebas', leagueName: 'Liga de pruebas', season: '2027', status, notes: 'Reglamento confirmado por el entrenador',
    rules: { format: 8, periods: 2, minutesPerPeriod: 25, breakMinutes: 7, maxSquad: 10, maxSubstitutions: 3,
      rollingSubstitutions: false, allowedFormations: ['1-3-3-1'], tacticalStyle: 'equilibrado' } };
}
after(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
  closeDb();
  assert(path.dirname(directory) === os.tmpdir());
  fs.rmSync(directory, { recursive: true, force: true });
});

test('player IDs update the correct account and immediately revoke disabled sessions', async () => {
  const first = players[0];
  assert.notEqual(first.player.id, first.user.id);
  (await users.update(first.user.id, { fullName: 'Nombre nuevo', active: false }));
  assert.equal((await c.authService.me(adminId)).user.fullName, 'Admin');
  assert.equal((await c.authService.me(first.user.id)).user.fullName, 'Nombre nuevo');
  assert.equal((await request('GET', '/auth/me', undefined, playerToken)).status, 401);
  (await c.playerService.update(first.player.id, { active: true, fullName: 'Jugador 0' }));
  assert.equal((await request('GET','/auth/me',undefined,playerToken)).status,401);
  playerToken=(await c.authService.login({email:'player0@test.com',password:'PlayerTest123456!'})).token;
  assert.equal((await request('GET', '/players', undefined, playerToken)).status, 403);
});
test('changing a role revokes tokens issued for the previous role', async () => {
  (await c.playerService.update(players[0].player.id, { role: 'admin' }));
  assert.equal((await request('GET', '/auth/me', undefined, playerToken)).status, 401);
  (await c.playerService.update(players[0].player.id, { role: 'player' }));
  playerToken=(await c.authService.login({email:'player0@test.com',password:'PlayerTest123456!'})).token;
});
test('last administrator cannot be disabled', async () => {
  db.prepare('INSERT INTO players(user_id, position) VALUES (?, ?)').run(adminId, 'MED');
  const row = db.prepare('SELECT id FROM players WHERE user_id = ?').get(adminId) as { id: number };
  (await assert.rejects(async () => (await c.playerService.remove(row.id)), /administrador/i));
});
test('registration rolls back a new user when the player insert fails', async () => {
  db.exec("CREATE TRIGGER fail_registration BEFORE INSERT ON players BEGIN SELECT RAISE(ABORT,'test failure'); END");
  try {
    (await assert.rejects(async () => (await c.authService.register({ email: 'rollback@test.com', password: 'Rollback12345678!', fullName: 'Prueba',invitationCode:(await c.authService.createInvitation()).code })),/test failure/));
    assert.equal(db.prepare("SELECT id FROM users WHERE email = 'rollback@test.com'").get(), undefined);
  } finally { db.exec('DROP TRIGGER fail_registration'); }
});
const inscription = (await c.inscriptionService.create({ playerId: players[0].player.id, season: '2027', amount: 1000 }));
test('payment retries charge once and record the actual administrator', async () => {
  const payload = { amount: 200, method: 'transferencia', reference: 'REF-1' };
  const headers = { 'Idempotency-Key': 'test-payment-123' };
  assert.equal((await request('POST', `/inscriptions/${inscription.id}/payments`, payload, adminToken, headers)).status, 200);
  const retry = await request('POST', `/inscriptions/${inscription.id}/payments`, payload, adminToken, headers);
  assert.equal(retry.status, 200);
  assert.equal(retry.data.paid, 200);
  assert.equal(retry.data.payments.length, 1);
  assert.equal(retry.data.payments[0].registeredBy, adminId);
  assert.equal(retry.data.payments[0].registeredByName, 'Admin');
  assert.equal((await request('POST', `/inscriptions/${inscription.id}/payments`, { ...payload, amount: 300 }, adminToken, headers)).status, 400);
  assert.equal((await request('POST', `/inscriptions/${inscription.id}/payments`, payload)).status, 400);
  assert.equal((await request('POST', `/inscriptions/${inscription.id}/payments`, { ...payload, reference: '  REF-1  ' })).status, 400);
});
test('payment and balance roll back together on a database error', async () => {
  db.exec("CREATE TRIGGER fail_balance BEFORE UPDATE OF paid ON inscriptions BEGIN SELECT RAISE(ABORT,'test failure'); END");
  try {
    (await assert.rejects(async () => (await c.inscriptionService.addPayment(inscription.id, { amount: 100, method: 'efectivo' }))));
    const row = (await c.inscriptionService.list()).find(i => i.id === inscription.id)!;
    assert.equal(row.paid, 200); assert.equal(row.payments?.length, 1);
  } finally { db.exec('DROP TRIGGER fail_balance'); }
});
test('inscription totals cannot fall below payments already received', async () => {
  (await assert.rejects(async () => (await c.inscriptionService.update(inscription.id, { amount: 100 })), /pagado/i));
});
test('inventory rolls back failed delivery and replenishes a return only once', async () => {
  const uniform = (await c.uniformService.createUniform({ name: 'Camiseta', kind: 'camiseta', price: 100, stock: 2 }));
  db.exec("CREATE TRIGGER fail_stock BEFORE UPDATE OF stock ON uniforms BEGIN SELECT RAISE(ABORT,'test failure'); END");
  try {
    (await assert.rejects(async () => (await c.uniformService.createIssue({ playerId: players[0].player.id, uniformId: uniform.id, size: 'M' }))));
    assert.equal((await c.uniformService.listIssues()).length, 0);
    assert.equal((await c.uniformService.listUniforms())[0].stock, 2);
  } finally { db.exec('DROP TRIGGER fail_stock'); }
  const issue = (await c.uniformService.createIssue({ playerId: players[0].player.id, uniformId: uniform.id, size: 'M' }));
  (await c.uniformService.updateIssue(issue.id, { returned: true }));
  (await c.uniformService.updateIssue(issue.id, { returned: true }));
  assert.equal((await c.uniformService.listUniforms())[0].stock, 2);
  (await assert.rejects(async () => (await c.uniformService.updateIssue(issue.id, { returned: false })), /devolución/i));
});
test('delivered requests cannot be reopened or delivered twice', async () => {
  const uniform = (await c.uniformService.listUniforms())[0];
  const id = Number(db.prepare('INSERT INTO uniform_requests(player_id,uniform_id,size) VALUES (?,?,?)')
    .run(players[0].player.id, uniform.id, 'M').lastInsertRowid);
  (await c.uniformService.updateRequest(id, { status: 'entregada' }));
  (await c.uniformService.updateRequest(id, { status: 'entregada' }));
  assert.equal((await c.uniformService.listUniforms())[0].stock, 1);
  (await assert.rejects(async () => (await c.uniformService.updateRequest(id, { status: 'pendiente' })), /entregada/i));
});
test('invalid body types, unknown fields and impossible dates return 400', async () => {
  for (const body of [{ fullName: 42 }, { active: 'false' }, { role: 'root' }, { birthDate: '2026-02-30' }, { password_hash: 'x' }]) {
    assert.equal((await request('PUT', `/players/${players[0].player.id}`, body)).status, 400);
  }
  assert.equal((await request('PUT', `/inscriptions/${inscription.id}`, { amount: 100.123 })).status, 400);
  assert.equal((await request('POST', '/matches', { opponent: 'FC', kickOff: '2026-02-30T18:00' })).status, 400);
});
test('attendance belongs to the authenticated player and declined players cannot be selected', async () => {
  const match = (await fixtureMatch());
  const response = await request('PUT', `/me/matches/${match.id}/attendance`, { status: 'no_disponible' }, playerToken);
  assert.equal(response.status, 200); assert.equal(response.data.playerId, players[0].player.id);
  const own = await request('GET', `/me/matches/${match.id}/attendance`, undefined, playerToken);
  assert.equal(own.data.length, 1);
  const lineup = (await c.matchService.get(match.id)).lineup.map((slot, i) => ({ ...slot, playerId: players[i].player.id }));
  (await assert.rejects(async () => (await c.matchService.setLineup(match.id, lineup)), /disponible/i));
  (await c.matchService.setAttendance(match.id, players[0].user.id, 'confirmado'));
  (await users.update(players[1].user.id, { active: false }));
  (await assert.rejects(async () => (await c.matchService.setLineup(match.id, lineup)), /inactivo/i));
  (await users.update(players[1].user.id, { active: true }));
  (await c.sanctionService.create({ playerId: players[1].player.id, type: 'suspension', reason: 'Prueba' }));
  (await assert.rejects(async () => (await c.matchService.setLineup(match.id, lineup)), /disponible|suspensión/i));
  const sanction = (await c.sanctionService.list()).find(s => s.playerId === players[1].player.id)!;
  (await c.sanctionService.update(sanction.id, { status: 'cumplida' }));
});
test('drafts remain private, published snapshots survive edits, and format changes clear publication', async () => {
  const match = (await fixtureMatch());
  (await assert.rejects(async () => (await c.matchService.publishLineup(match.id)), /Completa/));
  const slots = (await c.matchService.get(match.id)).lineup.map((slot, i) => ({ ...slot, playerId: players[i].player.id }));
  (await c.matchService.setLineup(match.id, slots));
  assert.equal((await c.matchService.get(match.id, true)).lineup.length, 0);
  (await c.matchService.publishLineup(match.id));
  assert.equal((await c.matchService.get(match.id, true)).lineup.length, 5);
  (await c.matchService.setLineup(match.id, slots.map((slot, i) => i === 4 ? { ...slot, playerId: players[5].player.id } : slot)));
  assert.equal((await c.matchService.get(match.id, true)).lineup[4].playerId, players[4].player.id);
  assert.equal((await c.matchService.get(match.id)).lineup[4].playerId, players[5].player.id);
  const updated = (await c.matchService.update(match.id, { format: 7 }));
  assert.equal(updated.lineupPublishedAt, null);
  assert.equal((await c.matchService.get(match.id, true)).lineup.length, 0);
  assert.equal((await c.matchService.get(match.id)).lineup.length, 7);
});
test('duplicate stats, mismatched match IDs and impossible ratios are rejected', async () => {
  const match = (await fixtureMatch()); const playerId = players[0].player.id;
  for (const entries of [[{ playerId }, { playerId }], [{ playerId, shots: 1, shotsOnTarget: 2 }], [{ playerId, minutes: 41 }], [{ playerId, matchId: match.id + 1 }]]) {
    assert.equal((await request('POST', `/matches/${match.id}/stats`, { entries })).status, 400);
  }
});
test('forecast inputs contain only previous matches, not the rating or goals being predicted', () => {
  const baseStat = { id: 1, playerId: 1, minutes: 40, goals: 1, assists: 0, shots: 1, shotsOnTarget: 1, passes: 1, passesCompleted: 1, tackles: 0, interceptions: 0, recoveries: 0, dribbles: 0, fouls: 0, yellowCards: 0, redCards: 0 };
  const rows = [{ ...baseStat, matchId: 1, rating: 6 }, { ...baseStat, matchId: 2, rating: 7 }, { ...baseStat, matchId: 3, rating: 8 }];
  const original = extractForecastSamples(rows);
  const altered = extractForecastSamples(rows.map(row => row.matchId === 2 ? { ...row, rating: 1, goals: 99 } : row));
  assert.deepEqual(original[0].features, altered[0].features);
  assert.notEqual(original[0].rating, altered[0].rating);
  assert.notDeepEqual(original[1].features, altered[1].features);
});
test('AI reserves later matches for validation and invalidates artifacts after editing history', async () => {
  for (let i = 0; i < 6; i++) {
    const match = (await c.matchService.create({ opponent: 'Historia', competition: 'Prueba', kickOff: `2026-09-0${i + 1}T18:00`, isHome: true, format: 5 }));
    (await c.matchService.update(match.id, { status: 'jugado' }));
    (await c.matchService.saveStats(match.id, players.slice(0, 5).map((p, j) => ({ playerId: p.player.id, minutes: 40, rating: 5 + ((i + j) % 4), goals: i % 2 }))));
  }
  const model = (await c.aiService.train());
  assert.equal(model.metrics.samples, 20); assert.equal(model.validation?.samples, 5);
  assert(Number.isFinite(model.validation?.mae));
  const artifact = path.join(directory, 'model.json');
  const before = fs.readFileSync(artifact, 'utf8');
  db.prepare('UPDATE match_stats SET rating = 9 WHERE id = (SELECT MIN(id) FROM match_stats)').run();
  (await c.aiService.getModelInfo());
  assert.notEqual(fs.readFileSync(artifact, 'utf8'), before);
  (await c.settingsService.update({ format: 7 }));
  assert.equal((await c.aiService.getModelInfo()).format, 7);
});
test('failed login attempts are limited', async () => {
  for (let i = 0; i < 10; i++) assert.equal((await request('POST', '/auth/login', { email: 'none@test.com', password: 'wrong' }, '')).status, 401);
  assert.equal((await request('POST', '/auth/login', { email: 'none@test.com', password: 'wrong' }, '')).status, 429);
});

test('backup captures a consistent database while WAL is active', () => {
  const result = spawnSync(process.execPath, ['scripts/backup.mjs'], { cwd: path.resolve('.'), env: process.env, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const folder = fs.readdirSync(path.join(directory, 'backups'))[0];
  const snapshot = new Database(path.join(directory, 'backups', folder, 'portal.db'), { readonly: true });
  try {
    assert.equal(snapshot.pragma('integrity_check', { simple: true }), 'ok');
    assert.deepEqual(snapshot.prepare('SELECT paid FROM inscriptions WHERE id = ?').get(inscription.id), { paid: 200 });
    assert.deepEqual(snapshot.prepare('SELECT COUNT(*) AS count FROM payments').get(), { count: 1 });
  } finally { snapshot.close(); }
});

test('dashboard follows the season configured by the club', async () => {
  (await c.settingsService.update({ season: '2027' }));
  assert.equal((await c.dashboardService.admin()).inscriptions.total, 1000);
  (await c.settingsService.update({ season: '2028' }));
  assert.equal((await c.dashboardService.admin()).inscriptions.total, 0);
  assert.equal((await c.dashboardService.admin()).pendingInscriptionPlayers.length, 0);
});

test('removing a player deletes their account without affecting the administrator', async () => {
  const removed = await c.playerService.create({ email:'removed@test.com',password:'Removed test passphrase 123!',fullName:'Jugador por eliminar',position:'DEF' });
  (await c.playerService.remove(removed.player.id));
  await assert.rejects(()=>c.authService.me(removed.user.id),/no encontrado/i);
  assert.equal(db.prepare('SELECT id FROM players WHERE id=?').get(removed.player.id),undefined);
  assert.equal((await c.authService.me(adminId)).user.active, true);
});

test('demo seed refuses to overwrite an existing database', async () => {
  const before = db.prepare('SELECT COUNT(*) AS count FROM users').get();
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'backend/src/adapters/out/persistence/seed.ts'], { cwd: path.resolve('.'), env: process.env, encoding: 'utf8' });
  assert.equal(result.status, 1); assert(result.stderr.includes('La base ya existe'));
  assert.deepEqual(db.prepare('SELECT COUNT(*) AS count FROM users').get(), before);
  assert.equal((await c.inscriptionService.list())[0].paid, 200);
});

test('public branding exposes only club identity and color changes persist', async () => {
  const response = await request('GET', '/branding', undefined, '');
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(response.data).sort(), ['brandColor', 'logoUrl', 'teamName']);
  assert.equal((await request('PUT', '/settings', { brandColor: 'url(javascript:test)' })).status, 400);
  assert.equal((await request('PUT', '/settings', { brandColor: '#d8b86a' })).status, 200);
});

test('image uploads validate contents, hide player photos and enforce administrative permissions', async () => {
  const { default: sharp } = await import('sharp');
  const image = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#d8b86a' } }).png().toBuffer();
  assert.equal((await fileRequest('/me/avatar', Buffer.from('<svg></svg>'), 'fake.png', playerToken)).status, 400);
  const photo = await fileRequest('/me/avatar', image, 'foto.png', playerToken);
  assert.equal(photo.status, 200);
  assert.equal((await c.authService.me(players[0].user.id)).user.avatarUrl, photo.data.url);
  const privateFile = await fetch(base + photo.data.url);
  assert.equal(privateFile.status, 401);
  const otherToken = (await c.authService.login({ email: 'player1@test.com', password: 'PlayerTest123456!' })).token;
  assert.equal((await fetch(base + photo.data.url, { headers: { Authorization: `Bearer ${otherToken}` } })).status, 200);
  const loaded = await fetch(base + photo.data.url, { headers: { Authorization: `Bearer ${playerToken}` } });
  assert.equal(loaded.status, 200); assert.equal(loaded.headers.get('content-type'), 'image/webp');
  assert.equal((await fileRequest('/settings/logo', image, 'logo.png', playerToken)).status, 403);
  assert.equal((await fileRequest('/settings/logo', image, 'logo.png')).status, 200);
  const publicLogo = await fetch(base + '/api/branding/logo');
  assert.equal(publicLogo.status, 200); assert.equal(publicLogo.headers.get('content-type'), 'image/webp');
  const uniform = (await c.uniformService.createUniform({ name: 'Prenda con referencia', kind: 'camiseta', price: 0 }));
  assert.equal((await fileRequest(`/uniforms/${uniform.id}/image`, image, 'titular.png', playerToken)).status, 403);
  const reference = await fileRequest(`/uniforms/${uniform.id}/image`, image, 'titular.png');
  assert.equal(reference.status, 200);
  assert.equal((await c.uniformService.listUniforms()).find(row => row.id === uniform.id)?.imageUrl, reference.data.url);
  assert.equal((await fetch(base + reference.data.url, { headers: { Authorization: `Bearer ${playerToken}` } })).status, 200);
  assert.equal((await request('DELETE', '/me/avatar', undefined, playerToken)).status, 200);
  assert.equal((await c.authService.me(players[0].user.id)).user.avatarUrl, null);
});

test('draft tournament documents remain private and publication shares original and extracted text', async () => {
  const draft = await request('POST', '/tournaments', tournamentInput('borrador'));
  assert.equal(draft.status, 200);
  const id = draft.data.id;
  assert.equal((await request('POST', '/tournaments', tournamentInput(), playerToken)).status, 403);
  assert.equal((await request('GET', `/tournaments/${id}`, undefined, playerToken)).status, 404);
  const document = await fileRequest(`/tournaments/${id}/documents`, Buffer.from('Liga: fútbol 8. Dos tiempos de 25 minutos. Tres cambios.'), 'reglamento.txt');
  assert.equal(document.status, 200); assert.equal(document.data.extractionStatus, 'extraido');
  const path = `/api/media/${document.data.assetId}`;
  assert.equal((await fetch(base + path, { headers: { Authorization: `Bearer ${playerToken}` } })).status, 404);
  assert.equal((await request('PUT', `/tournaments/${id}`, tournamentInput())).status, 200);
  const published = await request('GET', `/tournaments/${id}`, undefined, playerToken);
  assert.equal(published.status, 200); assert.match(published.data.documents[0].extractedText, /25 minutos/);
  const download = await fetch(base + path, { headers: { Authorization: `Bearer ${playerToken}` } });
  assert.equal(download.status, 200); assert.match(download.headers.get('content-disposition') ?? '', /attachment/);
});

test('tournament photos migrate safely, persist separately from documents and follow tournament visibility', async () => {
  // Recreate the previously deployed media constraint before applying the new migration.
  const original = db.prepare("SELECT sql FROM sqlite_master WHERE name='media_assets'").get() as {sql:string};
  const legacy = original.sql.replace(/CREATE TABLE ["]?media_assets["]?/, 'CREATE TABLE media_assets_legacy').replace(",'tournament_image'", '');
  const before = db.prepare('SELECT * FROM media_assets ORDER BY id').all();
  db.pragma('foreign_keys = OFF');
  try { db.transaction(() => { db.exec(legacy + '; INSERT INTO media_assets_legacy SELECT * FROM media_assets; DROP TABLE media_assets; ALTER TABLE media_assets_legacy RENAME TO media_assets;'); })(); }
  finally { db.pragma('foreign_keys = ON'); }
  migrate(); assert.deepEqual(db.prepare('SELECT * FROM media_assets ORDER BY id').all(), before);
  assert.deepEqual(db.pragma('foreign_key_check'), []);
  const {default:sharp} = await import('sharp');
  const image = await sharp({create:{width:100,height:180,channels:3,background:'#428d52'}}).png().toBuffer();
  const tournament = (await request('POST','/tournaments',tournamentInput('borrador'))).data;
  const endpoint = `/tournaments/${tournament.id}/image`;
  assert.equal((await fileRequest(endpoint,image,'torneo.png',playerToken)).status,403);
  assert.equal((await fileRequest('/tournaments/999999/image',image,'torneo.png')).status,404);
  assert.equal((await fileRequest(endpoint,Buffer.from('<svg>fake image</svg>'),'fake.png')).status,400);
  assert.equal((await fileRequest(endpoint,Buffer.from('%PDF-1.4'),'reglamento.pdf')).status,400);
  const upload = await fileRequest(endpoint,image,'afiche.png'); assert.equal(upload.status,200);
  assert.equal((await request('GET',`/tournaments/${tournament.id}`)).data.imageUrl,upload.data.url);
  assert.equal((await fetch(base+upload.data.url)).status,401);
  assert.equal((await fetch(base+upload.data.url,{headers:{Authorization:'Bearer '+playerToken}})).status,404);
  const adminImage = await fetch(base+upload.data.url,{headers:{Authorization:'Bearer '+adminToken}});
  assert.equal(adminImage.headers.get('content-type'),'image/webp');
  assert.equal(adminImage.headers.get('content-disposition'),null);
  await request('PUT',`/tournaments/${tournament.id}`,tournamentInput());
  const published = (await request('GET',`/tournaments/${tournament.id}`,undefined,playerToken)).data;
  assert.equal(published.imageUrl,upload.data.url);assert.equal(published.documents.length,0);
  assert.equal((await request('GET','/tournaments',undefined,playerToken)).data.find((t:any)=>t.id===tournament.id).imageUrl,upload.data.url);
  assert.equal((await fetch(base+upload.data.url,{headers:{Authorization:'Bearer '+playerToken}})).status,200);
  migrate();assert.equal((await c.tournamentService.get(tournament.id,true)).imageUrl,upload.data.url);
  assert.equal((await request('PUT',`/tournaments/${tournament.id}`,{...tournamentInput(),imageUrl:'https://evil.example/image.jpg'})).status,400);
  const replacement = await fileRequest(endpoint,image,'otro-afiche.png');assert.equal(replacement.status,200);assert.notEqual(replacement.data.url,upload.data.url);
  assert.equal((await fetch(base+upload.data.url,{headers:{Authorization:'Bearer '+playerToken}})).status,404);
  assert.equal((await request('DELETE',endpoint,undefined,playerToken)).status,403);
  assert.equal((await request('DELETE',endpoint)).status,200);
  assert.equal((await c.tournamentService.get(tournament.id,true)).imageUrl,null);
  assert.equal((await fetch(base+replacement.data.url,{headers:{Authorization:'Bearer '+playerToken}})).status,404);
  assert.deepEqual(db.pragma('foreign_key_check'),[]);
});

test('PDF uploads extract actual text and scanned references require manual rules', async () => {
  const tournament = await request('POST', '/tournaments', tournamentInput('borrador'));
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  const stream = 'BT /F1 12 Tf 50 700 Td (Reglamento: dos tiempos de 25 minutos.) Tj ET';
  objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object,i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i+1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => String(offset).padStart(10,'0') + ' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const parsed = await fileRequest(`/tournaments/${tournament.data.id}/documents`, Buffer.from(pdf), 'normativa.pdf');
  assert.equal(parsed.status, 200); assert.match(parsed.data.extractedText, /dos tiempos de 25 minutos/);
  const sentence = 'Reglamento: dos tiempos de 25 minutos.';
  const blank = await fileRequest(`/tournaments/${tournament.data.id}/documents`, Buffer.from(pdf.replace(sentence, ' '.repeat(sentence.length))), 'escaneado.pdf');
  assert.equal(blank.status, 200); assert.equal(blank.data.extractionStatus, 'requiere_texto');
  const { default: sharp } = await import('sharp');
  const image = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#fff' } }).png().toBuffer();
  const scanned = await fileRequest(`/tournaments/${tournament.data.id}/documents`, image, 'normativa.png');
  assert.equal(scanned.status, 200); assert.equal(scanned.data.extractionStatus, 'requiere_texto');
  assert.equal((await fileRequest(`/tournaments/${tournament.data.id}/documents`, Buffer.from('%PDF-corrupt'), 'corrupt.pdf')).status, 400);
});

async function receiptUpload(input: Record<string,unknown>, bytes: Uint8Array, key: string, token=playerToken) {
  const body=new FormData();body.append('file',new Blob([Uint8Array.from(bytes)]),'soporte.png');
  for(const [field,value] of Object.entries(input))body.append(field,String(value));
  const response=await fetch(base+'/api/me/payment-receipts',{method:'POST',body,headers:{Authorization:'Bearer '+token,'Idempotency-Key':key}});
  return {status:response.status,data:await response.json()};
}

test('tactical plans always contain the match-format initial and adapt plays without mixing matches', async()=>{
  for(const format of [5,7,8,11]){
    const match=(await fixtureMatch(format));
    const plan=(await request('POST','/ai/tactical-plan',{matchId:match.id,style:'ofensivo'})).data;
    assert.equal(plan.match.id,match.id);assert.equal(plan.match.format,format);
    assert.equal(plan.recommendation.lineup.length,format);
    assert.equal(new Set(plan.recommendation.lineup.filter(s=>s.playerId!==null).map(s=>s.playerId)).size,plan.recommendation.lineup.filter(s=>s.playerId!==null).length);
    assert.equal(plan.recommendation.lineup.filter(s=>s.role==='POR').length,1);
    for(const play of plan.plays) assert(play.route.every(index=>plan.recommendation.lineup.some(s=>s.slotIndex===index)));
    assert(plan.plays.some(p=>p.id==='presion'));
    const defensive=(await c.aiService.tacticalPlan(match.id,'defensivo'));assert(defensive.plays.some(p=>p.id==='transicion'));
  }
  const tournament=(await request('POST','/tournaments',tournamentInput())).data;
  (await c.tournamentService.addPlayers(tournament.id,(await asyncFilter(players,async row=>(await c.playerService.get(row.player.id)).user.active)).map(row=>row.player.id)));
  const match=(await request('POST','/matches',{opponent:'Plan F8',kickOff:'2027-05-10T17:00',tournamentId:tournament.id})).data;
  const plan=(await request('POST','/ai/tactical-plan',{matchId:match.id})).data;
  assert.equal(plan.match.minutes,50);assert.equal(plan.recommendation.lineup.length,8);assert.equal(plan.formations.length,1);
  assert.equal((await request('POST','/ai/tactical-plan',{matchId:match.id,formation:'1-2-3-2'})).status,400);
  assert.equal((await request('POST','/ai/tactical-plan',{matchId:match.id},playerToken)).status,403);
  assert.equal((await request('GET','/ai/insights',undefined,playerToken)).status,403);
});

test('QR receipts require ownership, stay pending and approval credits the inscription once',async()=>{
  const {default:sharp}=await import('sharp');const image=await sharp({create:{width:16,height:16,channels:3,background:'#fff'}}).png().toBuffer();
  const debt=(await c.inscriptionService.create({playerId:players[0].player.id,season:'2028',amount:500}));
  const input={kind:'inscription',targetId:debt.id,amount:200,reference:'QR-INSCRIPTION-1',paidAt:'2027-05-01'};
  const row=await receiptUpload(input,image,'receipt_test_1');assert.equal(row.status,200);assert.equal(row.data.status,'pendiente');
  assert.equal((await c.inscriptionService.list()).find(d=>d.id===debt.id)?.paid,0);
  assert.equal((await receiptUpload(input,image,'receipt_test_1')).data.id,row.data.id);
  assert.equal((await receiptUpload({...input,amount:201},image,'receipt_test_1')).status,400);
  assert.equal((await receiptUpload(input,image,'receipt_duplicate')).status,400);
  const otherToken=(await c.authService.login({email:'player1@test.com',password:'PlayerTest123456!'})).token;
  assert.equal((await receiptUpload({...input,reference:'OTHER'},image,'receipt_foreign',otherToken)).status,404);
  assert.equal((await request('GET','/payment-receipts',undefined,playerToken)).status,403);
  assert.equal((await request('PUT',`/payment-receipts/${row.data.id}/review`,{status:'aprobado',notes:''},playerToken)).status,403);
  assert.equal((await fetch(base+'/api/media/'+row.data.assetId,{headers:{Authorization:'Bearer '+otherToken}})).status,404);
  assert.equal((await fetch(base+'/api/media/'+row.data.assetId)).status,401);
  assert.equal((await fetch(base+'/api/media/'+row.data.assetId,{headers:{Authorization:'Bearer '+playerToken}})).status,200);
  assert.equal((await request('GET','/me/payment-receipts',undefined,otherToken)).data.receipts.some(r=>r.id===row.data.id),false);
  for(let retry=0;retry<2;retry++)assert.equal((await request('PUT',`/payment-receipts/${row.data.id}/review`,{status:'aprobado',notes:'Validado'})).status,200);
  const updated=(await c.inscriptionService.list()).find(d=>d.id===debt.id)!;assert.equal(updated.paid,200);assert.equal(updated.payments?.length,1);assert.equal(updated.payments?.[0].method,'qr');
  assert.equal(updated.payments?.[0].registeredBy,adminId);
  assert.equal((await receiptUpload({...input,reference:'QR-OVERPAY',amount:301},image,'receipt_overpay')).status,400);
  assert.equal((await receiptUpload({...input,reference:'ZERO',amount:0},image,'receipt_zero')).status,400);
  assert.equal((await receiptUpload({...input,reference:'BAD-FILE'},Buffer.from('<script>bad</script>'),'receipt_bad_file')).status,400);
  assert.equal((await receiptUpload({...input,reference:'BAD-FIELD',playerId:players[1].player.id},image,'receipt_bad_field')).status,400);
  const rejected=await receiptUpload({...input,reference:'QR-REJECT-1',amount:100},image,'receipt_reject');assert.equal(rejected.status,200);
  assert.equal((await request('PUT',`/payment-receipts/${rejected.data.id}/review`,{status:'rechazado',notes:'Documento ilegible'})).status,200);
  assert.equal((await c.inscriptionService.list()).find(d=>d.id===debt.id)?.paid,200);
  assert.equal((await request('PUT',`/payment-receipts/${rejected.data.id}/review`,{status:'aprobado',notes:''})).status,400);
});

test('concurrent receipts cannot reserve more than the outstanding balance and retries keep one asset',async()=>{
  const {default:sharp}=await import('sharp');const image=await sharp({create:{width:8,height:8,channels:3,background:'#eee'}}).png().toBuffer();
  const debt=(await c.inscriptionService.create({playerId:players[0].player.id,season:'2029',amount:1000}));
  const input={kind:'inscription',targetId:debt.id,amount:700,reference:'CONCURRENT-QR',paidAt:'2027-05-02'};
  const repeated=await Promise.all([(await receiptUpload(input,image,'receipt_concurrent_same')),(await receiptUpload(input,image,'receipt_concurrent_same'))]);
  assert.deepEqual(repeated.map(r=>r.status),[200,200]);assert.equal(repeated[0].data.id,repeated[1].data.id);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM payment_receipts WHERE target_id=? AND kind=?').get(debt.id,'inscription').n,1);
  const remaining={...input,amount:250};
  const competing=await Promise.all([(await receiptUpload({...remaining,reference:'COMPETE-A'},image,'receipt_compete_A')),(await receiptUpload({...remaining,reference:'COMPETE-B'},image,'receipt_compete_B'))]);
  assert.deepEqual(competing.map(r=>r.status).sort(),[200,400]);
  assert.equal((await c.qrPaymentService.view(players[0].user.id,false)).debts.find(d=>d.kind==='inscription'&&d.targetId===debt.id)?.pending,950);
});

test('receipt approval rolls back the credit when saving the review fails',async()=>{
  const {default:sharp}=await import('sharp');const image=await sharp({create:{width:8,height:8,channels:3,background:'#abc'}}).png().toBuffer();
  const debt=(await c.inscriptionService.create({playerId:players[0].player.id,season:'2030',amount:100}));
  const row=await receiptUpload({kind:'inscription',targetId:debt.id,amount:100,reference:'ATOMIC-QR',paidAt:'2027-05-03'},image,'receipt_atomic');
  db.exec("CREATE TRIGGER fail_receipt_review BEFORE UPDATE OF status ON payment_receipts BEGIN SELECT RAISE(ABORT,'test failure'); END");
  try{(await assert.rejects(async ()=>(await c.qrPaymentService.review(row.data.id,adminId,'aprobado',''))));assert.equal((await c.inscriptionService.list()).find(d=>d.id===debt.id)?.paid,0);assert.equal((await c.inscriptionService.list()).find(d=>d.id===debt.id)?.payments?.length,0);}
  finally{db.exec('DROP TRIGGER fail_receipt_review');}
  assert.equal((await (await c.qrPaymentService.view(players[0].user.id,false)).receipts.find(r=>r.id===row.data.id))?.status,'pendiente');
});

test('uniform QR payments preserve the quoted price and follow the request through delivery',async()=>{
  const {default:sharp}=await import('sharp');const image=await sharp({create:{width:8,height:8,channels:3,background:'#ccc'}}).png().toBuffer();
  const uniform=(await c.uniformService.createUniform({name:'Uniforme QR',kind:'camiseta',price:100,stock:2}));
  const {request:order}=(await c.meService.createUniformRequest(players[0].user.id,{uniformId:uniform.id,size:'M'}));
  const row=await receiptUpload({kind:'uniform_request',targetId:order.id,amount:100,reference:'UNIFORM-QR',paidAt:'2027-05-04'},image,'receipt_uniform');
  assert.equal(row.status,200);(await c.uniformService.updateUniform(uniform.id,{price:200}));
  const delivered=(await c.uniformService.updateRequest(order.id,{status:'entregada'}));assert(delivered.issueId);
  assert.equal((await c.uniformService.listIssues()).find(i=>i.id===delivered.issueId)?.cost,100);
  assert.equal((await request('PUT',`/payment-receipts/${row.data.id}/review`,{status:'aprobado',notes:''})).status,200);
  const debts=(await c.qrPaymentService.view(players[0].user.id,false)).debts;
  assert.equal(debts.find(d=>d.kind==='uniform_request'&&d.targetId===order.id)?.paid,100);
  assert.equal(debts.some(d=>d.kind==='uniform_issue'&&d.targetId===delivered.issueId),false);
});

test('media migrations retain existing documents and the QR is authenticated and lossless PNG',async()=>{
  const before=db.prepare('SELECT * FROM media_assets ORDER BY id').all();migrate();assert.deepEqual(db.prepare('SELECT * FROM media_assets ORDER BY id').all(),before);
  assert.deepEqual(db.pragma('foreign_key_check'),[]);
  const {default:sharp}=await import('sharp');const image=await sharp({create:{width:16,height:16,channels:3,background:'#fff'}}).png().toBuffer();
  const body=new FormData();body.append('file',new Blob([Uint8Array.from(image)]),'qr.png');body.append('recipient','Titular de prueba');body.append('paymentKey','@prueba');
  const result=await fetch(base+'/api/settings/payment-qr',{method:'POST',body,headers:{Authorization:'Bearer '+adminToken}});assert.equal(result.status,200);const qr=await result.json();
  const response=await fetch(base+'/api/media/'+qr.assetId,{headers:{Authorization:'Bearer '+playerToken}});assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');
  assert.equal((await fetch(base+'/api/media/'+qr.assetId)).status,401);
});

test('coaching research searches the official library by style and reports actual network availability',async()=>{
  const {researchCoaching}=await import('../backend/src/application/services/coaching-research');
  const realFetch=globalThis.fetch;const urls:string[]=[];
  try{
    globalThis.fetch=(async(input)=>{const url=String(input);urls.push(url);return new Response(url.includes('talent_development.php')?'<html><a href="/en/practice/talent-coach-programme/test/defending-support.php">Defending in small groups</a><a href="https://bad.example/attack.php">bad link</a></html>':'<html>Official coaching article</html>',{status:200});}) as typeof fetch;
    const result=await researchCoaching('defensivo');assert.equal(result.status,'consultado');assert(result.sources.some(s=>s.url.includes('defending-support.php')));assert(urls.every(url=>new URL(url).hostname==='www.fifatrainingcentre.com'));
    globalThis.fetch=(async()=>{throw new Error('offline');}) as typeof fetch;
    assert.equal((await researchCoaching('ofensivo')).status,'no_disponible');
  }finally{globalThis.fetch=realFetch;}
});

test('league durations override generic formats and match snapshots survive tournament edits', async () => {
  const created = await request('POST', '/tournaments', tournamentInput());
  assert.equal(created.status, 200); const tournament = created.data;
  const match = await request('POST', '/matches', { opponent: 'Otra duración FC', kickOff: '2027-02-20T17:00', tournamentId: tournament.id });
  assert.equal(match.status, 200); assert.equal(match.data.minutes, 50); assert.equal(match.data.format, 8); assert.equal(match.data.tournamentId, tournament.id);
  assert.equal((await request('POST', '/matches', { opponent: 'Inválido FC', kickOff: '2027-02-20T17:00', tournamentId: tournament.id, minutes: 60 })).status, 400);
  assert.equal((await request('POST', `/matches/${match.data.id}/stats`, { entries: [{ playerId: players[0].player.id, minutes: 51 }] })).status, 400);
  const changed = tournamentInput(); changed.rules.minutesPerPeriod = 30;
  assert.equal((await request('PUT', `/tournaments/${tournament.id}`, changed)).status, 200);
  assert.equal((await c.matchService.get(match.data.id)).match.minutes, 50);
  assert.equal((await c.matchService.get(match.data.id)).match.tournamentRules?.minutesPerPeriod, 25);
  assert.equal((await request('PUT', `/matches/${match.data.id}`, { tournamentId: tournament.id })).data.minutes, 60);
  (await c.matchService.saveStats(match.data.id, [{ playerId: players[0].player.id, minutes: 60 }]));
  assert.equal((await request('PUT', `/matches/${match.data.id}`, { tournamentId: null, minutes: 50 })).status, 400);
  assert.equal((await request('PUT', '/settings', { defaultTournamentId: tournament.id })).status, 200);
  assert.equal((await request('POST', '/matches', { opponent: 'Por defecto FC', kickOff: '2027-02-21T17:00' })).data.minutes, 60);
  await request('PUT', '/settings', { defaultTournamentId: null });
});

test('AI and manual lineups respect enabled formations and squad limits', async () => {
  const tournament = (await request('POST', '/tournaments', tournamentInput())).data;
  (await c.tournamentService.addPlayers(tournament.id,(await asyncFilter(players,async row=>(await c.playerService.get(row.player.id)).user.active)).map(row=>row.player.id)));
  const match = (await request('POST', '/matches', { opponent: 'Táctica FC', kickOff: '2027-03-10T17:00', tournamentId: tournament.id })).data;
  const suggestion = await request('POST', '/ai/recommend-xi', { matchId: match.id });
  assert.equal(suggestion.status, 200); assert.equal(suggestion.data.formation, '1-3-3-1');
  assert.equal(suggestion.data.leagueContext.minutes, 50); assert.equal(suggestion.data.leagueContext.maxSubstitutions, 3);
  assert(suggestion.data.bench.length + suggestion.data.lineup.filter(row => row.playerId !== null).length <= 10);
  assert.equal((await request('PUT', `/matches/${match.id}/formation`, { formation: '1-2-3-2' })).status, 400);
  assert.equal((await request('POST', '/ai/recommend-xi', { matchId: match.id, formation: '1-2-3-2' })).status, 400);
});

test('secondary positions improve fit and missing goalkeepers remain vacant', async () => {
  const { slotScore, selectXi } = await import('../backend/src/domain/model/performance-model');
  const { getFormation } = await import('../backend/src/domain/formations');
  const formation = getFormation('1-2-1', 5); const defender = formation.slots.find(slot => slot.role === 'DEF')!;
  const candidate = { playerId: 1, playerName: 'Polivalente', shirtNumber: 8, position: 'MED' as const, predictedRating: 7, avgRating: 7 };
  assert(slotScore(defender, { ...candidate, secondaryPosition: 'DEF' }) > slotScore(defender, candidate));
  assert.equal(selectXi(formation, [candidate]).assignments.find(row => row.slotIndex === formation.slots.find(slot => slot.role === 'POR')!.slotIndex)?.playerId, null);
});

test('50-minute tournaments with unlimited substitutions preserve unknown re-entry and squad rules', async () => {
  const input = tournamentInput();
  const rules = { ...input.rules, maxSubstitutions: null, maxSquad: null, breakMinutes: null, rollingSubstitutions: null };
  const tournament = await request('POST', '/tournaments', { ...input, rules });
  assert.equal(tournament.status, 200);
  const match = await request('POST', '/matches', { opponent: 'Cambios ilimitados FC', kickOff: '2027-03-15T17:00', tournamentId: tournament.data.id });
  (await c.tournamentService.addPlayers(tournament.data.id,(await asyncFilter(players,async row=>(await c.playerService.get(row.player.id)).user.active)).map(row=>row.player.id)));
  assert.equal(match.status, 200); assert.equal(match.data.minutes, 50);
  const suggestion = await request('POST', '/ai/recommend-xi', { matchId: match.data.id });
  assert.equal(suggestion.status, 200);
  assert.equal(suggestion.data.leagueContext.minutes, 50);
  assert.equal(suggestion.data.leagueContext.maxSubstitutions, null);
  assert.equal(suggestion.data.leagueContext.rollingSubstitutions, null);
  assert.match(suggestion.data.explanation, /Cambios: sin límite numérico; reingreso por confirmar/);
  assert.doesNotMatch(suggestion.data.explanation, /sin reingreso/);
});
