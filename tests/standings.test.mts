import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { gunzipSync, gzipSync } from "node:zlib";
import { testPostgres } from "./postgres-helper.mts";
import {
  calculateLeague,
  defaultLeague,
  type LeagueConfig,
} from "../backend/src/domain/standings";

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "futapp-league-"));
process.env.DB_PATH = path.join(directory, "fixture.db");
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "league-disposable-tests-12345678901234567890";
const { migrate } = await import(
  "../backend/src/adapters/out/persistence/migrate"
);
const { migratePostgres } = await import(
  "../backend/src/adapters/out/persistence/postgres-schema"
);
const { getDb, closeDb } = await import(
  "../backend/src/adapters/out/persistence/database"
);
const { asAsyncDatabase } = await import(
  "../backend/src/adapters/out/persistence/async-database"
);
const { createContainer } = await import("../backend/src/container");
const { createHttpServer } = await import(
  "../backend/src/adapters/in/rest/http-server"
);
const { FileMigrationStore } = await import(
  "../backend/src/adapters/out/persistence/migration-store"
);
const { PostgresMigrationStore } = await import(
  "../backend/src/adapters/out/persistence/postgres-migration-store"
);
after(() => {
  closeDb();
  assert.equal(path.dirname(directory), os.tmpdir());
  fs.rmSync(directory, { recursive: true, force: true });
});

test("ranking uses configured points, both tiebreak orders and shared positions without fabricated wins", () => {
  const config = defaultLeague();
  config.teams = ["Rival", "Otro", "Igual"];
  assert(
    calculateLeague(config, [], "Club").rows.every(
      (row) => row.points === 0 && row.position === 1 && row.played === 0,
    ),
  );
  config.results = [
    {
      id: "one",
      matchday: 1,
      home: "Rival",
      away: "Otro",
      homeGoals: 4,
      awayGoals: 0,
      status: "jugado",
    },
    {
      id: "two",
      matchday: 2,
      home: "Igual",
      away: "Otro",
      homeGoals: 5,
      awayGoals: 4,
      status: "jugado",
    },
    {
      id: "future",
      matchday: 3,
      home: "Igual",
      away: "Rival",
      homeGoals: 99,
      awayGoals: 0,
      status: "programado",
    },
  ];
  let view = calculateLeague(config, [], "Club");
  assert.equal(view.counted, 2);
  assert.equal(view.rows[0].name, "Rival");
  config.rules = { win: 2, draw: 1, loss: 0, tiebreak: "goals" };
  view = calculateLeague(config, [], "Club");
  assert.equal(view.rows[0].name, "Igual");
  assert.equal(view.rows[0].points, 2);
  config.results[0].status = "cancelado";
  assert.equal(calculateLeague(config, [], "Club").counted, 1);
});

for (const dialect of ["sqlite", "postgres"] as const)
  test(`${dialect}: league results, permissions and private snapshot compatibility`, async (t) => {
    migrate();
    const pg = dialect === "postgres" ? await testPostgres() : null;
    if (pg) await migratePostgres(pg);
    const db = pg ?? asAsyncDatabase(getDb());
    const media = {
      save: async () => {
        throw new Error("No uploads in league tests");
      },
      read: async () => null,
      delete: async () => {},
    };
    const c = createContainer({
      db,
      media,
      model: { load: async () => null, save: async () => {} },
    } as any);
    const password = "League fixture 123!";
    await db
      .prepare(
        "INSERT INTO users(email,password_hash,full_name,role) VALUES(?,?,?,'admin')",
      )
      .run(
        `league-admin-${dialect}@test.local`,
        bcrypt.hashSync(password, 4),
        "Admin de prueba",
      );
    const player = await c.playerService.create({
      email: `league-player-${dialect}@test.local`,
      password,
      fullName: "Jugador de prueba",
      position: "POR",
    });
    const admin = (
      await c.authService.login({
        email: `league-admin-${dialect}@test.local`,
        password,
      })
    ).token;
    const own = (
      await c.authService.login({ email: player.user.email, password })
    ).token;
    const tournament = await c.tournamentService.save(null, {
      name: "Liga de prueba",
      leagueName: "Organizador",
      season: "2026",
      status: "publicado",
      notes: "",
      rules: {
        format: 8,
        periods: 2,
        minutesPerPeriod: 25,
        breakMinutes: null,
        maxSquad: null,
        maxSubstitutions: null,
        rollingSubstitutions: true,
        allowedFormations: ["1-3-3-1"],
        tacticalStyle: "equilibrado",
      },
    });
    const clubName = (await c.settingsService.get()).teamName;
    const server = createHttpServer({
      notifications: c.notificationService,
      qrPayments: c.qrPaymentService,
      tournaments: c.tournamentService,
      media: c.mediaService,
      auth: c.authService,
      me: c.meService,
      players: c.playerService,
      inscriptions: c.inscriptionService,
      uniforms: c.uniformService,
      matches: c.matchService,
      sanctions: c.sanctionService,
      stats: c.statsService,
      ai: c.aiService,
      dashboard: c.dashboardService,
      settings: c.settingsService,
    }).listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    assert(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}/api`;
    const request = async (
      method: string,
      url: string,
      body?: unknown,
      token = admin,
    ) => {
      const response = await fetch(base + url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, data: (await response.json()) as any };
    };
    const endpoint = `/tournaments/${tournament.id}/standings`;
    const get = () => c.tournamentService.standings(tournament.id, true);
    const save = async (input: LeagueConfig) => {
      const result = await request("PUT", endpoint, input);
      assert.equal(result.status, 200, JSON.stringify(result.data));
      return result.data as import("../backend/src/domain/standings").LeagueView;
    };
    let firstId = 0;
    try {
      await t.test(
        "empty classifications have no fictitious scores; anonymous and player writes are denied",
        async () => {
          const initial = await get();
          assert.equal(initial.counted, 0);
          assert.equal(initial.rows.length, 1);
          assert.equal(initial.rows[0].name, clubName);
          assert.equal(
            (await request("GET", endpoint, undefined, "")).status,
            401,
          );
          assert.equal(
            (await request("GET", endpoint, undefined, own)).status,
            200,
          );
          assert.equal(
            (await request("PUT", endpoint, defaultLeague(), own)).status,
            403,
          );
          assert.equal(
            (await request("PUT", endpoint, defaultLeague(), "")).status,
            401,
          );
          const saved = await request("PUT", endpoint, initial.config);
          assert.equal(saved.status, 200);
          assert.equal(saved.data.config.version, 1);
          await c.tournamentService.addPlayers(tournament.id, [
            player.player.id,
          ]);
          const roster = await c.tournamentService.roster(
            tournament.id,
            false,
            player.user.id,
          );
          assert.equal(roster.players[0].avatarUrl, null);
          assert(!JSON.stringify(roster).includes("password"));
          assert(!JSON.stringify(roster).includes("eps"));
        },
      );
      await t.test(
        "club and league results aggregate once with correct away goals and tournament isolation",
        async () => {
          const first = await c.matchService.create({
            tournamentId: tournament.id,
            opponent: "River",
            kickOff: "2026-10-17T18:00",
            isHome: false,
          });
          firstId = first.id;
          assert.equal(first.format, 8);
          assert.equal(first.minutes, 50);
          await c.matchService.update(first.id, {
            status: "jugado",
            goalsFor: 3,
            goalsAgainst: 1,
          });
          const other = await c.matchService.create({
            tournamentId: null,
            opponent: "Amistoso",
            kickOff: "2026-10-18T18:00",
          });
          await c.matchService.update(other.id, {
            status: "jugado",
            goalsFor: 99,
            goalsAgainst: 0,
          });
          let view = await get();
          assert.equal(view.counted, 1);
          assert.equal(view.rows.find((row) => row.club)!.goalsFor, 3);
          view = await save({
            ...view.config,
            teams: ["Norte", "Sur"],
            matchRounds: { [first.id]: 1 },
            results: [
              {
                id: "league-1",
                matchday: 1,
                home: "Norte",
                away: "Sur",
                homeGoals: 2,
                awayGoals: 2,
                status: "jugado",
              },
            ],
          });
          assert.equal(view.counted, 2);
          assert.equal(view.rows.find((row) => row.club)!.points, 3);
          assert.equal(
            view.rows.find((row) => row.name === "River")!.goalsFor,
            1,
          );
          assert.equal(view.rows.find((row) => row.name === "Norte")!.drawn, 1);
          assert(!view.rows.some((row) => row.name === "Amistoso"));
          assert.equal(
            view.results.find((row) => row.source === "club")!.home,
            "River",
          );
        },
      );
      await t.test(
        "corrections, postponed matches, deletion and custom point changes recalculate immediately",
        async () => {
          await c.matchService.update(firstId, {
            goalsFor: 0,
            goalsAgainst: 0,
          });
          let view = await get();
          assert.equal(view.rows.find((row) => row.club)!.points, 1);
          await c.matchService.update(firstId, { status: "pospuesto" });
          view = await get();
          assert.equal(view.counted, 1);
          assert.equal(view.rows.find((row) => row.club)!.played, 0);
          await c.matchService.update(firstId, {
            status: "jugado",
            goalsFor: 1,
            goalsAgainst: 2,
          });
          view = await get();
          assert.equal(view.rows.find((row) => row.club)!.lost, 1);
          view = await save({
            ...view.config,
            rules: { win: 2, draw: 2, loss: 1, tiebreak: "goals" },
            results: [
              { ...view.config.results[0], homeGoals: 3, awayGoals: 0 },
            ],
          });
          assert.equal(view.rows.find((row) => row.club)!.points, 1);
          assert.equal(
            view.rows.find((row) => row.name === "Norte")!.points,
            2,
          );
          view = await save({ ...view.config, results: [] });
          assert.equal(view.counted, 1);
          assert.equal(
            view.rows.find((row) => row.name === "Norte")!.played,
            0,
          );
          await c.matchService.remove(firstId);
          view = await get();
          assert.equal(view.counted, 0);
          assert.deepEqual(view.config.matchRounds, {});
          await save(view.config);
        },
      );
      await t.test(
        "invalid scores, duplicate fixtures and club re-entry are rejected without losing data",
        async () => {
          const view = await get(),
            config = view.config;
          const result = {
            id: "valid",
            matchday: 2,
            home: "Norte",
            away: "Sur",
            homeGoals: 0,
            awayGoals: 1,
            status: "jugado" as const,
          };
          const bad = [
            { ...config, teams: ["Norte", " norte "] },
            { ...config, teams: [clubName] },
            { ...config, results: [{ ...result, homeGoals: 1.5 }] },
            { ...config, results: [{ ...result, awayGoals: null }] },
            { ...config, results: [{ ...result, home: clubName }] },
            { ...config, results: [{ ...result, away: "norte" }] },
            {
              ...config,
              results: [
                result,
                { ...result, id: "duplicate", home: "Sur", away: "Norte" },
              ],
            },
            { ...config, matchRounds: { 999999: 1 } },
            { ...config, rules: { ...config.rules, win: -1 } },
            { ...config, role: "admin" },
            { ...config, results: [{ ...result, role: "admin" }] },
          ];
          for (const input of bad)
            assert.equal((await request("PUT", endpoint, input)).status, 400);
          assert.deepEqual((await get()).config, config);
          await assert.rejects(() =>
            c.matchService.create({
              tournamentId: tournament.id,
              opponent: "Test",
              kickOff: "2026-10-20T18:00",
              goalsFor: 2.5,
            }),
          );
        },
      );
      await t.test(
        "stale edits cannot overwrite newer results and draft tournaments stay private",
        async () => {
          const config = (await get()).config;
          await save({ ...config, teams: ["Norte", "Sur", "Este"] });
          assert.equal(
            (await request("PUT", endpoint, { ...config, teams: [] })).status,
            409,
          );
          assert((await get()).config.teams.includes("Este"));
          await c.tournamentService.save(tournament.id, {
            ...tournament,
            status: "borrador",
          });
          assert.equal(
            (await request("GET", endpoint, undefined, own)).status,
            404,
          );
          assert.equal((await request("GET", endpoint)).status, 200);
          await c.tournamentService.save(tournament.id, {
            ...tournament,
            status: "publicado",
          });
        },
      );
      await t.test(
        "new standings survive snapshots and snapshots from before the redesign still validate",
        async () => {
          const migration = pg
            ? new PostgresMigrationStore(
                pg,
                {
                  put: async () => {},
                  get: async () => Buffer.alloc(0),
                  remove: async () => {},
                },
                "http://localhost",
              )
            : new FileMigrationStore(getDb(), directory);
          const exported = await migration.exportData(),
            packet = JSON.parse(gunzipSync(exported).toString("utf8"));
          assert(packet.tables.tournament_leagues.rows.length > 0);
          const target = new Database(":memory:");
          migrate(target);
          try {
            const validator = new FileMigrationStore(target, directory);
            const valid = validator.validateForImport(exported);
            assert(valid.tables.tournament_leagues.rows.length > 0);
            delete packet.tables.tournament_leagues;
            const legacy = validator.validateForImport(
              gzipSync(Buffer.from(JSON.stringify(packet))),
            );
            assert.deepEqual(legacy.tables.tournament_leagues.rows, []);
            assert(legacy.tables.users.rows.length > 0);
          } finally {
            target.close();
          }
        },
      );
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      if (pg) {
        await pg.execute("DROP SCHEMA futapp CASCADE");
        await pg.close();
      }
    }
  });
