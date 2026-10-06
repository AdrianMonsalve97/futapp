/**
 * Seed de datos demo (§9 del SPEC).
 * Ejecución: `npm run seed -w backend` (acepta `--reset`, mismo comportamiento).
 * Borra y recrea `backend/data/portal.db` e imprime un resumen con credenciales.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import * as bcrypt from 'bcryptjs';
import type { Foot, Position, StrategyKind } from '../../../domain/entities';
import { getFormation } from '../../../domain/formations';
import { env } from '../../../config/env';
import { closeDb, getDb } from './database';
import { migrate } from './migrate';

/* ------------------------------------------------------------------ */
/* §12.6 · La demo arranca en fútbol 8: 8 en cancha, 60' por partido  */
/* ------------------------------------------------------------------ */
const SEED_FORMAT = 8;
const MATCH_MINUTES = 60;

/* ------------------------------------------------------------------ */
/* RNG determinista (misma data en cada ejecución)                    */
/* ------------------------------------------------------------------ */
let rngState = 20261006;
function rand(): number {
  rngState = (rngState * 1664525 + 1013904223) >>> 0;
  return rngState / 4294967296;
}
function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}
function pad2(value: number): string {
  return String(value).padStart(2, '0');
}
function localDate(date: Date, hhmm: string): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${hhmm}`;
}
function dateOnly(kickOff: string): string {
  return kickOff.slice(0, 10);
}
function daysAgo(days: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}
function currentWeekDay(target: 0 | 1 | 2 | 3 | 4 | 5 | 6): Date {
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  const delta = (target - now.getDay() + 7) % 7;
  now.setDate(now.getDate() + delta);
  return now;
}

/* ------------------------------------------------------------------ */
/* Plantel (2 POR · 5 DEF · 5 MED · 2 DEL)                            */
/* ------------------------------------------------------------------ */
interface SeedPlayer {
  idx: number;
  email: string;
  fullName: string;
  phone: string;
  position: Position;
  secondaryPosition: Position | null;
  shirtNumber: number;
  dni: string;
  birthDate: string;
  heightCm: number;
  weightKg: number;
  foot: Foot;
  emergencyContact: string;
  joinedAt: string;
  skill: number;
  userId: number;
  playerId: number;
}

const PLAYER_DEFS: Array<Omit<SeedPlayer, 'idx' | 'email' | 'userId' | 'playerId'>> = [
  { fullName: 'Marco Ríos', phone: '+54 9 11 5555 0101', position: 'POR', secondaryPosition: 'DEF', shirtNumber: 1, dni: '27891034', birthDate: '1992-03-14', heightCm: 187, weightKg: 84, foot: 'der', emergencyContact: 'Laura Ríos · +54 9 11 5555 0001', joinedAt: '2023-02-06', skill: 0.75 },
  { fullName: 'Lucas Cabrera', phone: '+54 9 11 5555 0102', position: 'DEF', secondaryPosition: 'MED', shirtNumber: 2, dni: '30122478', birthDate: '1995-07-22', heightCm: 176, weightKg: 74, foot: 'izq', emergencyContact: 'Ana Cabrera · +54 9 11 5555 0002', joinedAt: '2023-02-06', skill: 0.78 },
  { fullName: 'Diego Ferreyra', phone: '+54 9 11 5555 0103', position: 'DEF', secondaryPosition: 'MED', shirtNumber: 3, dni: '29455612', birthDate: '1994-01-09', heightCm: 181, weightKg: 78, foot: 'der', emergencyContact: 'Paula Ferreyra · +54 9 11 5555 0003', joinedAt: '2023-03-15', skill: 0.7 },
  { fullName: 'Andrés Molina', phone: '+54 9 11 5555 0104', position: 'DEF', secondaryPosition: 'DEL', shirtNumber: 4, dni: '31788901', birthDate: '1996-11-30', heightCm: 179, weightKg: 76, foot: 'der', emergencyContact: 'Héctor Molina · +54 9 11 5555 0004', joinedAt: '2024-02-10', skill: 0.72 },
  { fullName: 'Tomás Aguirre', phone: '+54 9 11 5555 0105', position: 'DEF', secondaryPosition: 'MED', shirtNumber: 5, dni: '28670155', birthDate: '1993-05-18', heightCm: 183, weightKg: 80, foot: 'der', emergencyContact: 'Silvia Aguirre · +54 9 11 5555 0005', joinedAt: '2023-02-06', skill: 0.8 },
  { fullName: 'Bruno Salas', phone: '+54 9 11 5555 0106', position: 'DEF', secondaryPosition: 'MED', shirtNumber: 15, dni: '32455890', birthDate: '1998-08-02', heightCm: 174, weightKg: 71, foot: 'ambos', emergencyContact: 'Verónica Salas · +54 9 11 5555 0006', joinedAt: '2024-08-01', skill: 0.68 },
  { fullName: 'Facundo Herrera', phone: '+54 9 11 5555 0107', position: 'MED', secondaryPosition: 'DEF', shirtNumber: 6, dni: '30988421', birthDate: '1995-12-05', heightCm: 178, weightKg: 73, foot: 'der', emergencyContact: 'Mónica Herrera · +54 9 11 5555 0007', joinedAt: '2023-02-06', skill: 0.85 },
  { fullName: 'Iván Castro', phone: '+54 9 11 5555 0108', position: 'MED', secondaryPosition: 'DEL', shirtNumber: 7, dni: '31234567', birthDate: '1997-04-27', heightCm: 172, weightKg: 68, foot: 'izq', emergencyContact: 'Rubén Castro · +54 9 11 5555 0008', joinedAt: '2023-07-20', skill: 0.82 },
  { fullName: 'Matías Ledesma', phone: '+54 9 11 5555 0109', position: 'MED', secondaryPosition: 'DEF', shirtNumber: 8, dni: '29877310', birthDate: '1994-09-11', heightCm: 180, weightKg: 75, foot: 'der', emergencyContact: 'Carla Ledesma · +54 9 11 5555 0009', joinedAt: '2023-02-06', skill: 0.74 },
  { fullName: 'Gonzalo Paredes', phone: '+54 9 11 5555 0110', position: 'MED', secondaryPosition: 'DEL', shirtNumber: 10, dni: '28999104', birthDate: '1993-02-19', heightCm: 175, weightKg: 70, foot: 'ambos', emergencyContact: 'Nora Paredes · +54 9 11 5555 0010', joinedAt: '2023-02-06', skill: 0.88 },
  { fullName: 'Raúl Ojeda', phone: '+54 9 11 5555 0111', position: 'MED', secondaryPosition: 'DEF', shirtNumber: 14, dni: '32100455', birthDate: '1999-06-08', heightCm: 177, weightKg: 72, foot: 'der', emergencyContact: 'Elsa Ojeda · +54 9 11 5555 0011', joinedAt: '2024-02-10', skill: 0.72 },
  { fullName: 'Emilio Vargas', phone: '+54 9 11 5555 0112', position: 'DEL', secondaryPosition: 'MED', shirtNumber: 9, dni: '27555678', birthDate: '1992-10-03', heightCm: 184, weightKg: 79, foot: 'der', emergencyContact: 'Jorge Vargas · +54 9 11 5555 0012', joinedAt: '2023-02-06', skill: 0.92 },
  { fullName: 'Joaquín Suárez', phone: '+54 9 11 5555 0113', position: 'DEL', secondaryPosition: 'MED', shirtNumber: 11, dni: '30444891', birthDate: '1996-01-25', heightCm: 171, weightKg: 67, foot: 'izq', emergencyContact: 'Diana Suárez · +54 9 11 5555 0013', joinedAt: '2023-08-14', skill: 0.86 },
  { fullName: 'Nicolás Vera', phone: '+54 9 11 5555 0114', position: 'POR', secondaryPosition: 'DEF', shirtNumber: 12, dni: '31666002', birthDate: '1997-07-16', heightCm: 190, weightKg: 86, foot: 'der', emergencyContact: 'Omar Vera · +54 9 11 5555 0014', joinedAt: '2024-02-10', skill: 0.66 },
];

/* ------------------------------------------------------------------ */
/* Datos de partidos jugados (§9)                                     */
/* ------------------------------------------------------------------ */
interface PlayedDef {
  opponent: string;
  competition: string;
  venue: string;
  isHome: boolean;
  goalsFor: number;
  goalsAgainst: number;
  formation: string;
  kickOff: string;
  notes: string | null;
}

interface StatRow {
  playerIdx: number;
  minutes: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  passes: number;
  passesCompleted: number;
  tackles: number;
  interceptions: number;
  recoveries: number;
  dribbles: number;
  fouls: number;
  yellowCards: number;
  redCards: number;
  rating: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function scaled(min: number, max: number, factor: number): number {
  return Math.max(0, Math.round(randInt(min, max) * factor));
}

function buildBaseRow(playerIdx: number, minutes: number, skill: number): StatRow {
  const player = PLAYER_DEFS[playerIdx] as Omit<SeedPlayer, 'idx' | 'email' | 'userId' | 'playerId'>;
  // §12.1: el factor escala los volúmenes con los minutos del formato (f8: 60').
  const factor = minutes / MATCH_MINUTES;
  let passes: number;
  let shots: number;
  let tackles: number;
  let interceptions: number;
  let recoveries: number;
  let dribbles: number;

  if (player.position === 'POR') {
    passes = scaled(8, 16, factor);
    shots = 0;
    tackles = scaled(0, 1, factor);
    interceptions = scaled(0, 1, factor);
    recoveries = scaled(1, 3, factor);
    dribbles = 0;
  } else if (player.position === 'DEF') {
    passes = scaled(24, 46, factor);
    shots = scaled(0, 1, factor);
    tackles = scaled(2, 6, factor);
    interceptions = scaled(1, 5, factor);
    recoveries = scaled(3, 7, factor);
    dribbles = scaled(0, 2, factor);
  } else if (player.position === 'MED') {
    passes = scaled(32, 62, factor);
    shots = scaled(0, 3, factor);
    tackles = scaled(1, 4, factor);
    interceptions = scaled(1, 3, factor);
    recoveries = scaled(3, 7, factor);
    dribbles = scaled(1, 4, factor);
  } else {
    passes = scaled(14, 32, factor);
    shots = scaled(1, 4, factor);
    tackles = scaled(0, 2, factor);
    interceptions = scaled(0, 2, factor);
    recoveries = scaled(1, 4, factor);
    dribbles = scaled(1, 5, factor);
  }

  // El skill del jugador se proyecta sobre los features (precisión, tiro, defensa).
  const passAccuracy = clamp(0.68 + 0.18 * skill + (rand() - 0.5) * 0.07, 0.5, 0.95);
  const passesCompleted = Math.min(passes, Math.round(passes * passAccuracy));
  const shotAccuracy = clamp(0.32 + 0.3 * skill + (rand() - 0.5) * 0.18, 0, 1);
  const shotsOnTarget = Math.min(shots, Math.round(shots * shotAccuracy));
  const fouls = scaled(0, 3, factor) + (rand() < 0.25 ? 1 : 0);

  return {
    playerIdx,
    minutes,
    goals: 0,
    assists: 0,
    shots,
    shotsOnTarget,
    passes,
    passesCompleted,
    tackles,
    interceptions,
    recoveries,
    dribbles,
    fouls,
    yellowCards: 0,
    redCards: 0,
    rating: 6,
  };
}

function weightedPick(rows: StatRow[], weightOf: (row: StatRow) => number): StatRow {
  const weights = rows.map(weightOf);
  const total = weights.reduce((a, b) => a + b, 0);
  let ticket = rand() * total;
  for (let i = 0; i < rows.length; i++) {
    ticket -= weights[i] as number;
    if (ticket <= 0) return rows[i] as StatRow;
  }
  return rows[rows.length - 1] as StatRow;
}

function skillOf(playerIdx: number): number {
  return (PLAYER_DEFS[playerIdx] as { skill: number }).skill;
}

function positionOf(playerIdx: number): Position {
  return (PLAYER_DEFS[playerIdx] as { position: Position }).position;
}

function assignGoalsAndAssists(rows: StatRow[], targetGoals: number): void {
  const fieldRows = rows.filter((r) => positionOf(r.playerIdx) !== 'POR');
  const goalRows: StatRow[] = [];
  for (let g = 0; g < targetGoals; g++) {
    const scorer = weightedPick(fieldRows, (r) => {
      const pos = positionOf(r.playerIdx);
      const base = pos === 'DEL' ? 6 : pos === 'MED' ? 3 : 1;
      return base * (0.5 + skillOf(r.playerIdx));
    });
    scorer.goals += 1;
    goalRows.push(scorer);
  }
  for (const scorer of goalRows) {
    if (rand() < 0.75) {
      const candidates = fieldRows.filter((r) => r.playerIdx !== scorer.playerIdx);
      const provider = weightedPick(candidates, (r) => {
        const pos = positionOf(r.playerIdx);
        const base = pos === 'MED' ? 4 : pos === 'DEL' ? 3 : 1.5;
        return base * (0.5 + skillOf(r.playerIdx));
      });
      provider.assists += 1;
    }
  }
  for (const row of rows) {
    row.shotsOnTarget = Math.max(row.shotsOnTarget, row.goals);
    row.shots = Math.max(row.shots, row.shotsOnTarget);
  }
}

/** §9: correlación lógica — más goles/asistencias/acciones → mejor calificación.
 *  Los rates van normalizados por el partido completo del formato (f8: 60', §12.1). */
function computeRating(row: StatRow): number {
  const minutes = Math.max(row.minutes, 1);
  const defActionsMatch = ((row.tackles + row.interceptions + row.recoveries) * MATCH_MINUTES) / minutes;
  const dribblesMatch = (row.dribbles * MATCH_MINUTES) / minutes;
  const foulsMatch = (row.fouls * MATCH_MINUTES) / minutes;
  const passAccuracy = row.passesCompleted / Math.max(row.passes, 1);

  let rating =
    5.55 +
    0.38 * row.goals +
    0.19 * row.assists +
    0.035 * Math.min(defActionsMatch, 24) +
    0.6 * (passAccuracy - 0.74) +
    0.1 * Math.min(row.shotsOnTarget, 5) +
    0.08 * Math.min(dribblesMatch, 9) +
    0.18 * (row.minutes >= MATCH_MINUTES ? 1 : 0) -
    0.05 * Math.min(foulsMatch, 10) -
    0.35 * row.yellowCards -
    0.7 * row.redCards +
    (rand() - 0.5) * 0.55;

  return Math.round(clamp(rating, 5, 9.5) * 10) / 10;
}

/* ------------------------------------------------------------------ */
/* Seed                                                                */
/* ------------------------------------------------------------------ */
function main(): void {
  const reset = process.argv.includes('--reset');
  const dbPath = path.isAbsolute(env.dbPath) ? env.dbPath : path.resolve(process.cwd(), env.dbPath);

  // Borra la BD (y sus archivos WAL) + modelo previo: `seed` siempre recrea.
  for (const suffix of ['', '-wal', '-shm']) {
    const file = `${dbPath}${suffix}`;
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
  const modelPath = path.resolve(path.dirname(dbPath), 'model.json');
  if (fs.existsSync(modelPath)) fs.unlinkSync(modelPath);

  migrate();
  const db = getDb();

  const adminHash = bcrypt.hashSync('Admin123!', 10);
  const playerHash = bcrypt.hashSync('Jugador123!', 10);

  const insertUser = db.prepare(
    `INSERT INTO users (email, password_hash, full_name, phone, avatar_url, role, active)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
  );
  const insertPlayer = db.prepare(
    `INSERT INTO players (user_id, dni, birth_date, position, secondary_position, shirt_number,
                          height_cm, weight_kg, foot, emergency_contact, joined_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertInscription = db.prepare(
    `INSERT INTO inscriptions (player_id, season, concept, amount, paid, due_date, notes, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertPayment = db.prepare(
    `INSERT INTO payments (inscription_id, amount, method, reference, paid_at, notes, registered_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertUniform = db.prepare(
    `INSERT INTO uniforms (name, kind, variant, price, stock, min_stock, active) VALUES (?, ?, ?, ?, ?, ?, 1)`,
  );
  const insertIssue = db.prepare(
    `INSERT INTO uniform_issues (player_id, uniform_id, size, cost, condition, returned, notes, issued_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertRequest = db.prepare(
    `INSERT INTO uniform_requests (player_id, uniform_id, size, reason, status, review_notes, created_at, reviewed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertMatch = db.prepare(
    `INSERT INTO matches (opponent, competition, kick_off, venue, is_home, status, formation,
                          format, minutes, goals_for, goals_against, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertStrategy = db.prepare(
    `INSERT INTO strategies (match_id, title, kind, content) VALUES (?, ?, ?, ?)`,
  );
  const insertLineup = db.prepare(
    `INSERT INTO lineups (match_id, player_id, slot_index, x, y, role, label) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertSanction = db.prepare(
    `INSERT INTO sanctions (player_id, match_id, type, reason, amount, points, status, match_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertStat = db.prepare(
    `INSERT INTO match_stats (match_id, player_id, minutes, goals, assists, shots, shots_on_target,
                              passes, passes_completed, tackles, interceptions, recoveries, dribbles,
                              fouls, yellow_cards, red_cards, rating)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const seedAll = db.transaction(() => {
    /* 1) Usuarios ------------------------------------------------- */
    const adminId = Number(
      insertUser.run('admin@club.com', adminHash, 'Carlos Duarte', '+54 9 11 5555 0000', null, 'admin')
        .lastInsertRowid,
    );

    const players: SeedPlayer[] = PLAYER_DEFS.map((def, index) => {
      const email = `jugador${pad2(index + 1)}@club.com`;
      const userId = Number(insertUser.run(email, playerHash, def.fullName, def.phone, null, 'player').lastInsertRowid);
      const playerId = Number(
        insertPlayer.run(
          userId,
          def.dni,
          def.birthDate,
          def.position,
          def.secondaryPosition,
          def.shirtNumber,
          def.heightCm,
          def.weightKg,
          def.foot,
          def.emergencyContact,
          def.joinedAt,
        ).lastInsertRowid,
      );
      return { ...def, idx: index, email, userId, playerId };
    });

    /* 2) Inscripciones 2026: 8 pagadas · 3 parciales · 3 pendientes */
    const paidByIndex = [1200000, 1200000, 1200000, 1200000, 1200000, 1200000, 1200000, 1200000, 450000, 700000, 850000, 0, 0, 0];
    const dueDates = ['2026-09-30', '2026-10-15', '2026-10-31'];
    const methods = ['efectivo', 'transferencia', 'qr', 'tarjeta'] as const;

    players.forEach((player, index) => {
      const amount = 1200000;
      const paid = paidByIndex[index] as number;
      const status = paid >= amount ? 'pagada' : paid > 0 ? 'parcial' : 'pendiente';
      const dueDate = dueDates[index % dueDates.length] as string;
      const inscriptionId = Number(
        insertInscription.run(
          player.playerId,
          '2026',
          'Inscripción anual',
          amount,
          paid,
          dueDate,
          status === 'pagada'
            ? null
            : status === 'parcial'
              ? 'Se acordó pagar en dos cuotas.'
              : 'Sin pago registrado: contactar al jugador.',
          status,
        ).lastInsertRowid,
      );
      if (paid >= amount) {
        const first = index % 2 === 0 ? 600000 : paid;
        const second = paid - first;
        insertPayment.run(inscriptionId, first, methods[index % 4], `REF-${2026}A${index + 1}`, '2026-04-12', null, adminId);
        if (second > 0) {
          insertPayment.run(inscriptionId, second, methods[(index + 2) % 4], `REF-2026B${index + 1}`, '2026-08-05', null, adminId);
        }
      } else if (paid > 0) {
        insertPayment.run(inscriptionId, paid, methods[index % 4], `REF-2026C${index + 1}`, '2026-07-20', 'Cuota inicial.', adminId);
      }
    });

    /* 3) Uniformes (8 ítems, 15.000–95.000) ------------------------ */
    const uniformDefs: Array<[string, string, string, number, number, number]> = [
      ['Camiseta titular 2026', 'camiseta', 'titular', 38000, 20, 5],
      ['Camiseta alterna 2026', 'camiseta', 'alterna', 38000, 14, 5],
      ['Pantalón de juego', 'pantalon', 'titular', 30000, 18, 5],
      ['Medias titular', 'medias', 'titular', 15000, 40, 10],
      ['Buzo de equipo', 'buzo', 'entrenamiento', 95000, 7, 4],
      ['Chaleco de entrenamiento', 'entrenamiento', 'entrenamiento', 55000, 3, 6],
      ['Guantes de arquero', 'guantes', 'titular', 45000, 2, 3],
      ['Remera de entrenamiento', 'entrenamiento', 'entrenamiento', 25000, 12, 6],
    ];
    const uniformIds = uniformDefs.map(
      ([name, kind, variant, price, stock, minStock]) =>
        Number(insertUniform.run(name, kind, variant, price, stock, minStock).lastInsertRowid),
    );

    /* 4) Entregas (~10) y solicitudes (2 pendientes · 1 aprobada) -- */
    const sizes = ['S', 'M', 'L', 'M', 'XL', 'L', 'M', 'S', 'L', 'M'];
    const issuePlan = [
      { p: 0, u: 0, cond: 'nuevo', returned: 0 },
      { p: 1, u: 0, cond: 'bueno', returned: 1 },
      { p: 2, u: 2, cond: 'nuevo', returned: 0 },
      { p: 3, u: 3, cond: 'bueno', returned: 0 },
      { p: 4, u: 0, cond: 'nuevo', returned: 0 },
      { p: 5, u: 7, cond: 'nuevo', returned: 0 },
      { p: 6, u: 4, cond: 'regular', returned: 0 },
      { p: 7, u: 3, cond: 'nuevo', returned: 1 },
      { p: 8, u: 0, cond: 'bueno', returned: 1 },
      { p: 9, u: 5, cond: 'nuevo', returned: 0 },
    ] as const;
    issuePlan.forEach((plan, i) => {
      const uniform = uniformDefs[plan.u] as [string, string, string, number, number, number];
      insertIssue.run(
        (players[plan.p] as SeedPlayer).playerId,
        uniformIds[plan.u] as number,
        sizes[i] as string,
        uniform[3],
        plan.cond,
        plan.returned,
        null,
        `2026-0${(i % 6) + 1}-1${(i % 9) + 1} 10:00:00`,
      );
    });

    insertRequest.run(
      (players[10] as SeedPlayer).playerId,
      uniformIds[1] as number,
      'L',
      'Necesito camiseta alterna porque la mía quedó chica.',
      'pendiente',
      null,
      '2026-09-28 09:15:00',
      null,
    );
    insertRequest.run(
      (players[11] as SeedPlayer).playerId,
      uniformIds[6] as number,
      'M',
      'Se rompió la abertura de mis guantes.',
      'pendiente',
      null,
      '2026-10-01 18:40:00',
      null,
    );
    insertRequest.run(
      (players[12] as SeedPlayer).playerId,
      uniformIds[2] as number,
      'S',
      'Pantalón nuevo para la temporada.',
      'aprobada',
      'Aprobado, pendiente de entrega en el próximo entrenamiento.',
      '2026-09-20 12:00:00',
      '2026-09-22 12:30:00',
    );

    /* 5) 6 partidos jugados con stats realistas -------------------- */
    // §12.6: los 6 jugados también en fútbol 8 (1-3-3-1, 60').
    const playedDefs: PlayedDef[] = [
      { opponent: 'Deportivo Norte', competition: 'Liga Amateur', venue: 'Estadio Municipal', isHome: true, goalsFor: 3, goalsAgainst: 1, formation: '1-3-3-1', kickOff: localDate(daysAgo(42), '18:00'), notes: 'Buen arranque de temporada.' },
      { opponent: 'Atlético Sur', competition: 'Liga Amateur', venue: 'Campo del Sur', isHome: false, goalsFor: 1, goalsAgainst: 1, formation: '1-3-3-1', kickOff: localDate(daysAgo(35), '16:00'), notes: null },
      { opponent: 'Club Ferroviario', competition: 'Liga Amateur', venue: 'Estadio Municipal', isHome: true, goalsFor: 4, goalsAgainst: 1, formation: '1-3-3-1', kickOff: localDate(daysAgo(28), '11:00'), notes: 'Mejor partido ofensivo del año.' },
      { opponent: 'Real Esperanza', competition: 'Copa Municipal', venue: 'La Esperanza', isHome: false, goalsFor: 2, goalsAgainst: 0, formation: '1-3-3-1', kickOff: localDate(daysAgo(21), '18:00'), notes: null },
      { opponent: 'Unión Vecinal', competition: 'Liga Amateur', venue: 'Estadio Municipal', isHome: true, goalsFor: 1, goalsAgainst: 2, formation: '1-3-3-1', kickOff: localDate(daysAgo(14), '16:00'), notes: 'Se escapó en el tramo final.' },
      { opponent: 'Sportivo Belgrano', competition: 'Liga Amateur', venue: 'Cancha Norte', isHome: false, goalsFor: 0, goalsAgainst: 2, formation: '1-3-3-1', kickOff: localDate(daysAgo(7), '11:00'), notes: 'Segunda derrota seguida: corregir defensa.' },
    ];

    const defPool = [1, 2, 3, 4, 5];
    const medPool = [6, 7, 8, 9, 10];
    const delPool = [11, 12];
    const gkIdx = [0, 13];
    const matchIds: number[] = [];
    const yellowTotals = new Map<number, number>();
    const redTotals = new Map<number, number>();

    playedDefs.forEach((def, k) => {
      // §12.6: rotación por posición coherente con 1-3-3-1 (3 DEF · 3 MED · 1 DEL).
      const startersDef = [0, 1, 2].map((o) => defPool[(k + o) % defPool.length] as number);
      const startersMed = [0, 1, 2].map((o) => medPool[(k + o) % medPool.length] as number);
      const starterDel = delPool[k % delPool.length] as number;
      const starters = [...startersDef, ...startersMed, starterDel];
      const bench = [...defPool, ...medPool, ...delPool].filter((idx) => !starters.includes(idx));
      const restIdx = bench[k % bench.length] as number;
      const subs = bench.filter((idx) => idx !== restIdx);
      const gk = gkIdx[k % gkIdx.length] as number;

      // Los sancionados de §9 deben tener fila en su partido (tarjetas).
      const forcedIdx = k === 2 ? 8 : k === 4 ? 6 : k === 3 ? 4 : null;
      if (forcedIdx !== null && !starters.includes(forcedIdx) && !subs.includes(forcedIdx)) {
        const at = subs.findIndex((idx) => positionOf(idx) === positionOf(forcedIdx));
        if (at >= 0) subs.splice(at, 1, forcedIdx);
      }

      // §12.6: 12 filas por partido (≥ 8 c/u → 72 ≥ 60 en total); minutos nunca > 60'.
      const rows: StatRow[] = [];
      rows.push(buildBaseRow(gk, MATCH_MINUTES, skillOf(gk)));
      for (const idx of starters) rows.push(buildBaseRow(idx, randInt(45, 60), skillOf(idx)));
      for (const idx of subs) rows.push(buildBaseRow(idx, randInt(10, 35), skillOf(idx)));

      assignGoalsAndAssists(rows, def.goalsFor);

      // Tarjetas: 2 amarillas y 1 roja forzadas (alimentan las sanciones).
      const takeYellow = (idx: number) => {
        const total = yellowTotals.get(idx) ?? 0;
        const row = rows.find((r) => r.playerIdx === idx);
        if (row && total < 2) {
          row.yellowCards += 1;
          yellowTotals.set(idx, total + 1);
        }
      };
      if (k === 2) takeYellow(8);
      if (k === 4) takeYellow(6);
      if (k === 3) {
        const row = rows.find((r) => r.playerIdx === 4);
        if (row && (redTotals.get(4) ?? 0) < 1) {
          row.redCards += 1;
          redTotals.set(4, 1);
        }
      }
      // Amarillas extra: nunca a los ya sancionados ni por encima de 2 por jugador.
      const cardedPool = [4, 6, 8];
      const extraYellows = randInt(0, 1);
      for (let i = 0; i < extraYellows; i++) {
        const candidates = rows.filter(
          (r) =>
            positionOf(r.playerIdx) !== 'POR' &&
            !cardedPool.includes(r.playerIdx) &&
            r.redCards === 0 &&
            (yellowTotals.get(r.playerIdx) ?? 0) < 2,
        );
        if (candidates.length === 0) break;
        const candidate = candidates[randInt(0, candidates.length - 1)] as StatRow;
        candidate.yellowCards += 1;
        yellowTotals.set(candidate.playerIdx, (yellowTotals.get(candidate.playerIdx) ?? 0) + 1);
      }

      for (const row of rows) row.rating = computeRating(row);

      const matchId = Number(
        insertMatch.run(
          def.opponent,
          def.competition,
          def.kickOff,
          def.venue,
          def.isHome ? 1 : 0,
          'jugado',
          def.formation,
          SEED_FORMAT,
          MATCH_MINUTES,
          def.goalsFor,
          def.goalsAgainst,
          def.notes,
        ).lastInsertRowid,
      );
      matchIds.push(matchId);

      for (const row of rows) {
        insertStat.run(
          matchId,
          (players[row.playerIdx] as SeedPlayer).playerId,
          row.minutes,
          row.goals,
          row.assists,
          row.shots,
          row.shotsOnTarget,
          row.passes,
          row.passesCompleted,
          row.tackles,
          row.interceptions,
          row.recoveries,
          row.dribbles,
          row.fouls,
          row.yellowCards,
          row.redCards,
          row.rating,
        );
      }

      // §12.6: lineup de 8 slots por partido (titulares coherentes con su posición).
      const playedFormation = getFormation(def.formation, SEED_FORMAT);
      const fillers: Record<string, number[]> = {
        POR: [gk],
        DEF: [...startersDef],
        MED: [...startersMed],
        DEL: [starterDel],
      };
      for (const slot of playedFormation.slots) {
        const playerIdx = (fillers[slot.role] ?? []).shift() ?? null;
        insertLineup.run(
          matchId,
          playerIdx === null ? null : (players[playerIdx] as SeedPlayer).playerId,
          slot.slotIndex,
          slot.x,
          slot.y,
          slot.role,
          slot.label,
        );
      }
    });

    /* 6) 2 próximos partidos: formaciones, estrategias y lineups --- */
    const saturday = currentWeekDay(6);
    const sunday = currentWeekDay(0);

    const nextDefs = [
      {
        opponent: 'Rivales FC',
        competition: 'Copa Provincial',
        kickOff: localDate(saturday, '18:00'),
        venue: 'Estadio Municipal',
        isHome: 1,
        formation: '1-3-3-1',
        notes: 'Clave: no conceder en el primer cuarto de hora.',
      },
      {
        opponent: 'Atlético Sur',
        competition: 'Liga Amateur',
        kickOff: localDate(sunday, '10:00'),
        venue: 'Campo del Sur',
        isHome: 0,
        formation: '1-2-3-2',
        notes: 'Revancha del empate de la fecha 2.',
      },
    ];

    const nextMatchIds = nextDefs.map(
      (def) =>
        Number(
          insertMatch.run(
            def.opponent,
            def.competition,
            def.kickOff,
            def.venue,
            def.isHome,
            'programado',
            def.formation,
            SEED_FORMAT,
            MATCH_MINUTES,
            null,
            null,
            def.notes,
          ).lastInsertRowid),
    );

    const strategyDefs: Array<[number, string, StrategyKind, string]> = [
      [0, 'Presión alta en salida', 'general', 'Sostener la línea de presión 10 metros más allá del mediocampo y cortar la salida corta del rival por el costado izquierdo. Los delanteros abren las líneas de pase y el mediocampo cierra por detrás.'],
      [0, 'Amplitud por bandas', 'ataque', 'Los laterales suben simultáneos con el balón para dejar el 1 contra 1 en banda; los extremos atacan el área y los mediocampistas llegan desde segunda línea a la estelar.'],
      [0, 'Bloque medio y cobertura', 'defensa', 'Defender en bloque 4-4-2 medio con los pivotes pegados a la defensa. Nunca salir de a uno: esperar la segunda jugada y cubrir el área central.'],
      [1, 'Control del mediocampo', 'general', 'Tener la pelota con los dos mediocampistas centrales abiertos entre líneas y buscar el desmarque del enganche. Ritmo pausado salvo en transición.'],
      [1, 'Transición rápida', 'transicion', 'Al recuperar, primer pase hacia adelante a los extremos en los primeros 6 segundos; si no hay opción, asegurar y reorganizar.'],
    ];
    for (const [matchOrder, title, kind, content] of strategyDefs) {
      insertStrategy.run(nextMatchIds[matchOrder] as number, title, kind, content);
    }

    // Alineaciones precargadas (coherentes con la posición de cada jugador).
    // §12.6: 8 slots por partido; el primero de los próximos va completo.
    const lineupPlans: Array<{ matchOrder: number; formation: string; assignment: Record<number, number> }> = [
      {
        matchOrder: 0,
        formation: '1-3-3-1',
        assignment: { 0: 0, 1: 1, 2: 2, 3: 3, 4: 6, 5: 8, 6: 7, 7: 11 },
      },
      {
        matchOrder: 1,
        formation: '1-2-3-2',
        assignment: { 0: 13, 1: 5, 2: 2, 3: 6, 4: 9, 5: 10, 6: 12, 7: 11 },
      },
    ];
    for (const plan of lineupPlans) {
      const formation = getFormation(plan.formation, SEED_FORMAT);
      for (const slot of formation.slots) {
        const playerIdx = plan.assignment[slot.slotIndex];
        insertLineup.run(
          nextMatchIds[plan.matchOrder] as number,
          playerIdx === undefined ? null : (players[playerIdx] as SeedPlayer).playerId,
          slot.slotIndex,
          slot.x,
          slot.y,
          slot.role,
          slot.label,
        );
      }
    }

    /* 7) 6 sanciones ---------------------------------------------- */
    const sanctionDefs: Array<[number, number | null, string, string, number, number, string, string | null]> = [
      [(players[8] as SeedPlayer).playerId, matchIds[2] ?? null, 'tarjeta_amarilla', 'Tarjeta amarilla por falta táctica sobre el mediocampo rival.', 0, 12, 'activa', dateOnly(playedDefs[2]?.kickOff ?? '')],
      [(players[6] as SeedPlayer).playerId, matchIds[4] ?? null, 'tarjeta_amarilla', 'Tarjeta amarilla por protestar al árbitro tras el córner.', 0, 10, 'activa', dateOnly(playedDefs[4]?.kickOff ?? '')],
      [(players[4] as SeedPlayer).playerId, matchIds[3] ?? null, 'tarjeta_roja', 'Tarjeta roja por entrada frontal sobre el delantero rival.', 0, 25, 'cumplida', dateOnly(playedDefs[3]?.kickOff ?? '')],
      [(players[4] as SeedPlayer).playerId, matchIds[3] ?? null, 'suspension', 'Suspensión de 1 partido por tarjeta roja directa.', 0, 0, 'activa', dateOnly(playedDefs[3]?.kickOff ?? '')],
      [(players[1] as SeedPlayer).playerId, null, 'multa', 'Multa por devolución tardía del buzo de equipo.', 50000, 0, 'cumplida', null],
      [(players[10] as SeedPlayer).playerId, null, 'multa', 'Multa por pérdida de las medias titulares.', 35000, 0, 'cumplida', null],
    ];
    for (const [playerId, matchId, type, reason, amount, points, status, matchDate] of sanctionDefs) {
      insertSanction.run(playerId, matchId, type, reason, amount, points, status, matchDate);
    }

    /* 8) Ajustes del equipo (§12.6): la demo corre en fútbol 8 -------- */
    db.prepare(
      `INSERT INTO team_settings (id, team_name, format, season)
       VALUES (1, 'Club Portal', ?, '2026')
       ON CONFLICT(id) DO UPDATE SET team_name = excluded.team_name,
                                     format = excluded.format,
                                     season = excluded.season,
                                     updated_at = datetime('now')`,
    ).run(SEED_FORMAT);

    return { adminId, players, matchIds, nextMatchIds };
  });

  const result = seedAll();

  /* Resumen por consola ------------------------------------------- */
  const count = (sql: string): number => {
    const row = db.prepare(sql).get() as { total: number };
    return row.total;
  };

  const inscriptionCounts = db
    .prepare(`SELECT status, COUNT(*) AS total FROM inscriptions GROUP BY status`)
    .all() as Array<{ status: string; total: number }>;
  const counts = inscriptionCounts.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = row.total;
    return acc;
  }, {});

  const teamSettings = db.prepare(`SELECT team_name, format, season FROM team_settings WHERE id = 1`).get() as {
    team_name: string;
    format: number;
    season: string;
  };
  const maxMinutes = db.prepare(`SELECT COALESCE(MAX(minutes), 0) AS total FROM match_stats`).get() as { total: number };

  console.log('');
  console.log('==============================================');
  console.log('  Portal de fútbol · seed completado' + (reset ? ' (--reset)' : ''));
  console.log('==============================================');
  console.log(`Base de datos : ${dbPath}`);
  console.log(
    `Equipo       : ${teamSettings.team_name} · formato ${teamSettings.format} (fútbol ${teamSettings.format}) · temporada ${teamSettings.season}`,
  );
  console.log('');
  console.log('Credenciales:');
  console.log('  admin       admin@club.com          / Admin123!');
  for (const player of result.players) {
    console.log(`  jugador     ${player.email.padEnd(24)} / Jugador123!  (${player.fullName})`);
  }
  console.log('');
  console.log('Contenido:');
  console.log(`  · Usuarios: 1 admin + ${result.players.length} jugadores`);
  console.log(
    `  · Inscripciones 2026: ${count('SELECT COUNT(*) AS total FROM inscriptions')} ` +
      `(${counts['pagada'] ?? 0} pagadas / ${counts['parcial'] ?? 0} parciales / ${counts['pendiente'] ?? 0} pendientes)`,
  );
  console.log(`  · Uniformes: ${count('SELECT COUNT(*) AS total FROM uniforms')} ítems de catálogo, ` +
    `${count('SELECT COUNT(*) AS total FROM uniform_issues')} entregas, ` +
    `${count('SELECT COUNT(*) AS total FROM uniform_requests')} solicitudes`);
  console.log(`  · Partidos: ${count(`SELECT COUNT(*) AS total FROM matches WHERE status = 'jugado'`)} jugados + ` +
    `${count(`SELECT COUNT(*) AS total FROM matches WHERE status = 'programado'`)} próximos`);
  console.log(`  · Estrategias: ${count('SELECT COUNT(*) AS total FROM strategies')} · ` +
    `Alineaciones: ${count('SELECT COUNT(*) AS total FROM lineups')} slots`);
  console.log(`  · Estadísticas de partidos: ${count('SELECT COUNT(*) AS total FROM match_stats')} filas ` +
    `(máx. ${maxMinutes.total}' jugados por jugador)`);
  console.log(`  · Sanciones: ${count('SELECT COUNT(*) AS total FROM sanctions')}`);
  console.log('  · model.json: NO pre-generado (se entrena en runtime con POST /api/ai/model/train)');
  console.log('==============================================');
  console.log('');
  console.log('Tip: npm run dev -w backend  →  API en http://localhost:4000');
  console.log('');

  closeDb();
}

main();
