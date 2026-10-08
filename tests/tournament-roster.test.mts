import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import type { TournamentInput } from '../backend/src/application/ports/out/tournament.repository';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'futapp-roster-'));
process.env.DB_PATH = path.join(directory, 'portal.db');
process.env.JWT_SECRET = 'isolated-roster-tests-secret-123456789012345';
process.env.NODE_ENV = 'test';
const { migrate } = await import('../backend/src/adapters/out/persistence/migrate');
const { getDb, closeDb } = await import('../backend/src/adapters/out/persistence/database');
const { createContainer } = await import('../backend/src/container');
const { createHttpServer } = await import('../backend/src/adapters/in/rest/http-server');
const { getFormation } = await import('../backend/src/domain/formations');
migrate();
const db = getDb(), c = createContainer(), password = 'Roster test passphrase 123!';
db.prepare("INSERT INTO users(email,password_hash,full_name,role) VALUES(?,?,?,'admin')").run('admin@roster.test', bcrypt.hashSync(password, 4), 'Admin');
const squad = ['POR','DEF','DEF','DEF','MED','MED','MED','DEL','POR'].map((position, i) => c.playerService.create({
  email: `player${i}@roster.test`, password, fullName: `Integrante ${i}`, position: position as any, shirtNumber: i + 1,
  eps: 'Información privada', phone: '+573000000000',
}));
const admin = c.authService.login({ email: 'admin@roster.test', password }).token;
const player = c.authService.login({ email: squad[0].user.email, password }).token;
const app = createHttpServer({ notifications:c.notificationService, qrPayments:c.qrPaymentService, tournaments:c.tournamentService,
  media:c.mediaService, auth:c.authService, me:c.meService, players:c.playerService, inscriptions:c.inscriptionService,
  uniforms:c.uniformService, matches:c.matchService, sanctions:c.sanctionService, stats:c.statsService,
  ai:c.aiService, dashboard:c.dashboardService, settings:c.settingsService });
const server = app.listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.once('listening', resolve));
const address = server.address(); assert(address && typeof address !== 'string');
async function request(method: string, url: string, body?: unknown, token = admin) {
  const res = await fetch(`http://127.0.0.1:${address.port}/api${url}`, { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  return { status: res.status, data: await res.json() };
}
function tournament(status: TournamentInput['status'] = 'publicado') {
  return c.tournamentService.save(null, { name:'Copa prueba', leagueName:'Liga local', season:'2099', status, notes:'',
    rules:{ format:8, periods:2, minutesPerPeriod:25, breakMinutes:5, maxSquad:8, maxSubstitutions:null,
      rollingSubstitutions:true, allowedFormations:['1-3-3-1','1-2-3-2'], tacticalStyle:'equilibrado' } });
}
function match(tournamentId: number | null) {
  return c.matchService.create({ opponent:'Rival', kickOff:'2099-01-01T18:00', tournamentId, format:8 });
}
const slots = () => getFormation('1-3-3-1', 8).slots.map((s, i) => ({ ...s, playerId:squad[i].player.id }));
after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); closeDb(); fs.rmSync(directory, { recursive:true, force:true }); });

test('only administrators enroll players, with separate rosters per tournament and safe public fields', async () => {
  const a = tournament(), b = tournament('borrador'), id = squad[0].player.id;
  assert.equal((await request('GET', `/tournaments/${a.id}/players`, undefined, '')).status, 401);
  assert.equal((await request('POST', `/tournaments/${a.id}/players`, { playerIds:[id] }, player)).status, 403);
  assert.equal((await request('DELETE', `/tournaments/${a.id}/players/${id}`, undefined, player)).status, 403);
  assert.equal((await request('GET', `/tournaments/${b.id}/players`, undefined, player)).status, 404);
  const enrolled = await request('POST', `/tournaments/${a.id}/players`, { playerIds:squad.map(row => row.player.id) });
  assert.equal(enrolled.status, 200); assert.equal(enrolled.data.players.length, 9); // Matchday cap is not a tournament cap.
  assert.equal((await request('POST', `/tournaments/${a.id}/players`, { playerIds:[id] })).data.players.length, 9);
  assert.equal((await request('GET', `/tournaments/${b.id}/players`)).data.players.length, 0);
  c.tournamentService.addPlayers(b.id, [id]);
  assert.equal((await request('GET', `/tournaments/${a.id}/players`, undefined, player)).data.myPlayerId, id);
  const keys = Object.keys(enrolled.data.players[0]).sort();
  assert.deepEqual(keys, ['active','playerId','playerName','position','registeredAt','secondaryPosition','shirtNumber'].sort());
  assert(!JSON.stringify(enrolled.data.players).includes('Información privada'));
  assert.equal((await request('DELETE', `/tournaments/${a.id}/players/${id}`)).status, 200);
  assert.equal(c.tournamentService.roster(b.id, true, 0).players.length, 1);
});

test('bulk enrollment validates every player and rejects invalid payloads without partial writes', async () => {
  const cup = tournament(), endpoint = `/tournaments/${cup.id}/players`, id = squad[0].player.id;
  for (const body of [{playerIds:[]}, {playerIds:[id,id]}, {playerIds:['1']}, {playerIds:[0]}, {playerIds:[1.5]}, {playerIds:[id],role:'admin'}]) {
    assert.equal((await request('POST', endpoint, body)).status, 400);
  }
  assert.equal((await request('POST', endpoint, {playerIds:[id,999999]})).status, 404);
  const inactive = squad[8].player.id; c.playerService.update(inactive, {active:false});
  assert.equal((await request('POST', endpoint, {playerIds:[id,inactive]})).status, 400);
  assert.equal((await request('GET', endpoint)).data.players.length, 0);
  c.playerService.update(inactive, {active:true});
  assert.equal((await request('POST', '/tournaments/999999/players', {playerIds:[id]})).status, 404);
});

test('tournament attendance, manual starters, substitutes and tactical AI require enrollment', async () => {
  const cup = tournament(), game = match(cup.id), empty = c.aiService.recommendXi(game.id);
  assert.equal(empty.lineup.length, 8); assert(empty.lineup.every(s => s.playerId === null)); assert.equal(empty.bench?.length, 0);
  assert.match(empty.explanation, /Agrega jugadores activos/);
  assert.equal((await request('PUT', `/me/matches/${game.id}/attendance`, {status:'confirmado'}, player)).status, 400);
  assert.equal((await request('PUT', `/matches/${game.id}/lineup`, {slots:slots()})).status, 400);
  assert.equal(c.matchService.attendance(game.id).length, 0);
  c.tournamentService.addPlayers(cup.id, squad.slice(0, 8).map(row => row.player.id));
  assert.equal(c.matchService.attendance(game.id).length, 8);
  assert.equal((await request('PUT', `/me/matches/${game.id}/attendance`, {status:'confirmado'}, player)).status, 200);
  assert.equal(c.aiService.recommendXi(game.id).lineup.filter(s => s.playerId !== null).length, 8);
  const plan = c.aiService.tacticalPlan(game.id);
  for (const formation of plan.formations) assert(formation.slots.every(s => s.playerId === null || s.playerId !== squad[8].player.id));
  assert.equal((await request('PUT', `/matches/${game.id}/lineup`, {slots:slots()})).status, 200);
  c.matchService.setAttendance(game.id, squad[0].user.id, 'no_disponible');
  assert.equal(c.aiService.recommendXi(game.id).lineup.find(s => s.role === 'POR')?.playerId, null);
  assert.throws(() => c.matchService.publishLineup(game.id), /no está disponible/);
  const independent = match(null);
  assert.equal(c.matchService.attendance(independent.id).length, squad.length);
});

test('removing a player clears pending drafts and publications while played match history survives', () => {
  const cup = tournament(), pending = match(cup.id), played = match(cup.id), id = squad[0].player.id;
  c.tournamentService.addPlayers(cup.id, squad.map(row => row.player.id));
  for (const game of [pending,played]) { c.matchService.setLineup(game.id, slots()); c.matchService.publishLineup(game.id); }
  c.matchService.saveStats(played.id, [{playerId:id,minutes:50,rating:8}]);
  c.matchService.update(played.id, {status:'jugado'});
  c.tournamentService.removePlayer(cup.id, id);
  assert.equal(c.matchService.get(pending.id).lineup[0].playerId, null);
  assert.equal(c.matchService.get(pending.id, true).lineup.length, 0);
  assert.equal(c.matchService.get(pending.id).match.lineupPublishedAt, null);
  assert.equal(c.matchService.get(played.id, true).lineup[0].playerId, id);
  assert.equal(c.matchService.getStats(played.id).entries[0].minutes, 50);
  assert.equal(c.matchService.attendance(pending.id).some(row => row.playerId === id), false);
});

test('switching tournament invalidates publication and removes starters outside the new roster', () => {
  const a = tournament(), b = tournament(), game = match(a.id);
  c.tournamentService.addPlayers(a.id, squad.slice(0,8).map(row => row.player.id));
  c.tournamentService.addPlayers(b.id, [squad[1].player.id]);
  c.matchService.setLineup(game.id, slots()); c.matchService.publishLineup(game.id);
  const updated = c.matchService.update(game.id, {tournamentId:b.id});
  assert.equal(updated.lineupPublishedAt, null);
  assert.deepEqual(c.matchService.get(game.id).lineup.filter(s => s.playerId !== null).map(s => s.playerId), [squad[1].player.id]);
  assert.throws(() => c.matchService.setLineup(game.id, slots()), /no está inscrito/);
});

test('individual preparation skips future tournaments where the player is not enrolled', async () => {
  const cup = tournament(), game = match(cup.id);
  assert.equal((await request('GET', `/me/ai?matchId=${game.id}`, undefined, player)).status, 404);
  c.tournamentService.addPlayers(cup.id, [squad[0].player.id]);
  const insight = await request('GET', `/me/ai?matchId=${game.id}`, undefined, player);
  assert.equal(insight.status, 200); assert.equal(insight.data.preparation.minutes, 50);
  c.tournamentService.removePlayer(cup.id, squad[0].player.id);
  assert.notEqual((await request('GET', '/me/ai', undefined, player)).data.preparation.matchId, game.id);
});

test('roster storage survives migration and enforces unique memberships and foreign keys', () => {
  const cup = tournament(), id = squad[0].player.id;
  c.tournamentService.addPlayers(cup.id, [id]); migrate();
  assert.equal(c.tournamentService.roster(cup.id, true, 0).players[0].playerId, id);
  assert.throws(() => db.prepare('INSERT INTO tournament_players(tournament_id,player_id) VALUES (?,?)').run(cup.id,id), /UNIQUE/);
  assert.throws(() => db.prepare('INSERT INTO tournament_players(tournament_id,player_id) VALUES (?,?)').run(cup.id,999999), /FOREIGN KEY/);
  db.prepare('DELETE FROM tournaments WHERE id=?').run(cup.id);
  assert.equal((db.prepare('SELECT COUNT(*) n FROM tournament_players WHERE tournament_id=?').get(cup.id) as any).n, 0);
});
