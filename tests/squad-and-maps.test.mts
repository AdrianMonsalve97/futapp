import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { gzipSync, gunzipSync } from "node:zlib";
import { testPostgres } from "./postgres-helper.mts";
import { venueMap, parseVenueUrl } from "../backend/src/domain/venue-map";
import { GoogleMapsResolver } from "../backend/src/adapters/out/maps/google-maps-resolver";

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "futapp-squad-maps-"));
process.env.DB_PATH = path.join(directory, "fixture.db");
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "squad-disposable-tests-12345678901234567890";
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
const { SqliteStatsRepository } = await import(
  "../backend/src/adapters/out/persistence/repositories/stats.repository"
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

test("venue maps preserve a precise pin over the viewport, normalize search and accept Google share embeds", () => {
  const map = venueMap(
    "https://www.google.com/maps/place/Cancha/@1,2,14z/data=!3d4.65!4d-74.12?utm_source=test",
  )!;
  assert.equal(new URL(map.url).searchParams.get("query"), "4.65,-74.12");
  assert.equal(new URL(map.embedUrl).searchParams.get("output"), "embed");
  assert.equal(
    new URL(map.directionsUrl).searchParams.get("destination"),
    "4.65,-74.12",
  );
  assert(!map.url.includes("utm_"));
  assert.equal(venueMap(map.url)!.embedUrl, map.embedUrl);
  assert.equal(
    new URL(
      venueMap("https://www.google.com/maps/place/Cancha+del+club/")!.url,
    ).searchParams.get("query"),
    "Cancha del club",
  );
  assert.equal(
    venueMap("https://www.google.com/maps/embed?pb=trusted-encoded-place")!
      .embedUrl,
    "https://www.google.com/maps/embed?pb=trusted-encoded-place",
  );
  assert.equal(venueMap(null), null);
  assert.equal(
    venueMap("https://www.google.com/maps?cid=123456")!.embedUrl,
    "https://www.google.com/maps?cid=123456&output=embed",
  );
  assert.equal(
    new URL(
      venueMap("https://www.google.com.co/maps/search/Cancha+Colombia")!.url,
    ).searchParams.get("query"),
    "Cancha Colombia",
  );
});

test("venue map allowlist rejects scripts, credentials, arbitrary hosts, Google open redirect paths and unresolved shortlinks", () => {
  for (const value of [
    "javascript:alert(1)",
    "http://www.google.com/maps?q=Cancha",
    "https://www.google.com.evil.test/maps?q=Cancha",
    "https://www.google.com@127.0.0.1/maps",
    "https://user:pass@www.google.com/maps?q=Cancha",
    "https://www.google.com:444/maps?q=Cancha",
    "https://www.google.com/url?q=https://evil.test",
    "https://goo.gl/other",
    "https://127.0.0.1/maps?q=test",
  ])
    assert.throws(() => parseVenueUrl(value));
  assert.throws(() => venueMap("https://maps.app.goo.gl/abc"));
  assert.throws(() => venueMap("https://www.google.com/maps/@1,2,14z"));
});

test("short Maps links resolve with bounded redirects and never request an unapproved target", async () => {
  const calls: string[] = [];
  const resolver = new GoogleMapsResolver((async (input, options) => {
    calls.push(String(input));
    assert.equal(options?.redirect, "manual");
    assert(options?.signal);
    return new Response(null, {
      status: 302,
      headers: {
        location:
          "https://www.google.com/maps/place/Cancha/data=!3d4.6!4d-74.1",
      },
    });
  }) as typeof fetch);
  assert.equal(
    new URL(
      (await resolver.resolve("https://maps.app.goo.gl/abc"))!,
    ).searchParams.get("query"),
    "4.6,-74.1",
  );
  assert.equal(calls.length, 1);
  assert.equal(await resolver.resolve(""), null);
  let requests = 0;
  const unsafe = new GoogleMapsResolver((async () => {
    requests++;
    return new Response(null, {
      status: 302,
      headers: { location: "https://127.0.0.1/private" },
    });
  }) as typeof fetch);
  await assert.rejects(unsafe.resolve("https://maps.app.goo.gl/abc"));
  assert.equal(requests, 1);
  const loop = new GoogleMapsResolver(
    (async () =>
      new Response(null, {
        status: 302,
        headers: { location: "https://maps.app.goo.gl/loop" },
      })) as typeof fetch,
  );
  await assert.rejects(loop.resolve("https://maps.app.goo.gl/abc"));
});

for (const dialect of ["sqlite", "postgres"] as const)
  test(`${dialect}: sporting roster privacy, actual results, venue persistence and old backups`, async (t) => {
    migrate();
    const pg = dialect === "postgres" ? await testPostgres() : null;
    if (pg) await migratePostgres(pg);
    const db = pg ?? asAsyncDatabase(getDb());
    const media = {
      save: async () => {
        throw new Error("No uploads in these tests");
      },
      read: async () => null,
      delete: async () => {},
    };
    const c = createContainer({
      db,
      media,
      model: { load: async () => null, save: async () => {} },
    } as any);
    const password = "Squad fixture 123!";
    await db
      .prepare(
        "INSERT INTO users(email,password_hash,full_name,role) VALUES(?,?,?,'admin')",
      )
      .run(
        `squad-admin-${dialect}@test.local`,
        bcrypt.hashSync(password, 4),
        "Admin de prueba",
      );
    const player = await c.playerService.create({
      email: `squad-player-${dialect}@test.local`,
      password,
      fullName: "Portero de prueba",
      position: "POR",
      shirtNumber: 0,
      eps: "Dato privado",
      dni: "Privado",
    });
    const bench = await c.playerService.create({
      email: `squad-bench-${dialect}@test.local`,
      password,
      fullName: "Sin actuaciones",
      position: "DEF",
      shirtNumber: 2,
    });
    const admin = (
      await c.authService.login({
        email: `squad-admin-${dialect}@test.local`,
        password,
      })
    ).token;
    const own = (
      await c.authService.login({ email: player.user.email, password })
    ).token;
    const tournamentInput = {
      name: "Liga de prueba",
      leagueName: "Organizador",
      season: "2026",
      status: "publicado" as const,
      notes: "",
      rules: {
        format: 8 as const,
        periods: 2,
        minutesPerPeriod: 25,
        breakMinutes: null,
        maxSquad: null,
        maxSubstitutions: null,
        rollingSubstitutions: true,
        allowedFormations: ["1-3-3-1"],
        tacticalStyle: "equilibrado" as const,
      },
    };
    const tournament = await c.tournamentService.save(null, tournamentInput);
    const draft = await c.tournamentService.save(null, {
      ...tournamentInput,
      name: "Borrador",
      status: "borrador",
    });
    await c.tournamentService.addPlayers(tournament.id, [
      player.player.id,
      bench.player.id,
    ]);
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
    const request = async (
      method: string,
      url: string,
      body?: unknown,
      token = admin,
    ) => {
      const response = await fetch(
        `http://127.0.0.1:${address.port}/api${url}`,
        {
          method,
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        },
      );
      return {
        status: response.status,
        headers: response.headers,
        data: (await response.json()) as any,
      };
    };
    let matchId = 0;
    try {
      await t.test(
        "maps are writable only by admin, persist after unrelated edits, and can be cleared",
        async () => {
          const created = await request("POST", "/matches", {
            opponent: "Rival",
            competition: "Liga",
            kickOff: "2026-10-18T18:00",
            isHome: true,
            tournamentId: tournament.id,
            venue: "Cancha del club",
            venueMapsUrl:
              "https://www.google.com/maps/search/?api=1&query=Cancha+del+club",
          });
          assert.equal(created.status, 200, JSON.stringify(created.data));
          matchId = created.data.id;
          assert(
            created.data.venueMap.embedUrl.startsWith(
              "https://www.google.com/maps?",
            ),
          );
          assert.equal(created.data.minutes, 50);
          const patch = {
            venueMapsUrl:
              "https://www.google.com/maps/search/?api=1&query=Otra+cancha",
          };
          assert.equal(
            (await request("PUT", `/matches/${matchId}`, patch, own)).status,
            403,
          );
          assert.equal(
            (
              await request("PUT", `/matches/${matchId}`, {
                venueMapsUrl: "https://evil.test/maps",
              })
            ).status,
            400,
          );
          assert.equal(
            (
              await request("PUT", `/matches/${matchId}`, {
                venueMapsUrl: { url: "https://evil.test" },
              })
            ).status,
            400,
          );
          const updated = await request("PUT", `/matches/${matchId}`, {
            notes: "Punto de encuentro",
          });
          assert.equal(updated.status, 200);
          assert.equal(updated.data.venueMapsUrl, created.data.venueMapsUrl);
          const read = await request(
            "GET",
            `/matches/${matchId}`,
            undefined,
            own,
          );
          assert.equal(read.status, 200);
          assert.equal(
            read.data.match.venueMap.embedUrl,
            created.data.venueMap.embedUrl,
          );
          assert(
            read.headers
              .get("content-security-policy")
              ?.includes("https://www.google.com/maps"),
          );
          const cleared = await request("PUT", `/matches/${matchId}`, {
            venueMapsUrl: null,
          });
          assert.equal(cleared.data.venueMap, null);
          await request("PUT", `/matches/${matchId}`, patch);
        },
      );
      await t.test(
        "roster uses only played statistics, keeps empty records honest, scopes tournaments and hides personal data",
        async () => {
          const stats = new SqliteStatsRepository(db);
          await stats.upsert(matchId, [
            {
              playerId: player.player.id,
              minutes: 50,
              goals: 0,
              assists: 1,
              passes: 20,
              passesCompleted: 17,
              rating: 8,
            },
          ]);
          let result = await c.statsService.squad(tournament.id, false);
          assert.equal(
            result.find((row) => row.playerId === player.player.id)!.stats
              .appearances,
            0,
          );
          await c.matchService.update(matchId, {
            status: "jugado",
            goalsFor: 1,
            goalsAgainst: 0,
          });
          result = await c.statsService.squad(tournament.id, false);
          const member = result.find(
            (row) => row.playerId === player.player.id,
          )!;
          assert.equal(member.shirtNumber, 0);
          assert.equal(member.position, "POR");
          assert.equal(member.stats.minutes, 50);
          assert.equal(member.stats.avgRating, 8);
          assert.equal(member.stats.passesCompleted, 17);
          assert.equal(member.recent[0].opponent, "Rival");
          assert.equal(
            result.find((row) => row.playerId === bench.player.id)!.stats
              .appearances,
            0,
          );
          for (const key of [
            "email",
            "phone",
            "dni",
            "eps",
            "prepaidHealth",
            "password",
            "emergencyContact",
            "birthDate",
          ])
            assert(!JSON.stringify(result).includes(`"${key}"`));
          assert.equal(
            (await request("GET", "/squad", undefined, "")).status,
            401,
          );
          assert.equal(
            (
              await request(
                "GET",
                `/squad?tournamentId=${draft.id}`,
                undefined,
                own,
              )
            ).status,
            404,
          );
          assert.equal(
            (
              await request(
                "GET",
                "/squad?tournamentId=invalid",
                undefined,
                own,
              )
            ).status,
            400,
          );
          assert.equal(
            (
              await request(
                "GET",
                `/squad?tournamentId=${tournament.id}`,
                undefined,
                own,
              )
            ).data.length,
            2,
          );
          await c.tournamentService.save(draft.id, {
            ...tournamentInput,
            name: "Borrador",
            status: "publicado",
          });
          const other = await c.matchService.create({
            opponent: "Privado",
            competition: "Borrador",
            kickOff: "2026-10-19T18:00",
            isHome: true,
            tournamentId: draft.id,
          });
          await stats.upsert(other.id, [
            { playerId: player.player.id, minutes: 50, goals: 20, rating: 10 },
          ]);
          await c.matchService.update(other.id, {
            status: "jugado",
            goalsFor: 20,
            goalsAgainst: 0,
          });
          await c.tournamentService.save(draft.id, {
            ...tournamentInput,
            name: "Borrador",
            status: "borrador",
          });
          assert.equal(
            (await c.statsService.squad(undefined, false)).find(
              (row) => row.playerId === player.player.id,
            )!.stats.goals,
            0,
          );
          assert.equal(
            (await c.statsService.squad(undefined, true)).find(
              (row) => row.playerId === player.player.id,
            )!.stats.goals,
            20,
          );
          await db
            .prepare("UPDATE users SET active=0 WHERE id=?")
            .run(bench.user.id);
          assert(
            !(await c.statsService.squad(undefined, true)).some(
              (row) => row.playerId === bench.player.id,
            ),
          );
          await db
            .prepare("UPDATE users SET active=1 WHERE id=?")
            .run(bench.user.id);
          await db
            .prepare("INSERT INTO registration_requests(user_id) VALUES(?)")
            .run(bench.user.id);
          assert(
            !(await c.statsService.squad(undefined, true)).some(
              (row) => row.playerId === bench.player.id,
            ),
          );
        },
      );
      await t.test(
        "additive migration is repeatable and old snapshots receive an empty map without losing match/account data",
        async () => {
          if (pg) await migratePostgres(pg);
          else migrate();
          const exporter = pg
            ? new PostgresMigrationStore(pg, { read: async () => null } as any)
            : new FileMigrationStore(getDb(), directory);
          const exported = await exporter.exportData();
          const snapshot = JSON.parse(gunzipSync(exported).toString());
          const target = new Database(":memory:");
          try {
            migrate(target);
            const validator = new FileMigrationStore(target, directory);
            const current = validator.validateForImport(exported);
            const column =
              current.tables.matches.columns.indexOf("venue_maps_url");
            assert(
              current.tables.matches.rows.some((row) =>
                String(row[column]).includes("Otra"),
              ),
            );
            const unsafe = structuredClone(snapshot);
            unsafe.tables.matches.rows[0][column] = "https://evil.test/map";
            assert.throws(() =>
              validator.validateForImport(gzipSync(JSON.stringify(unsafe))),
            );
            const legacy = snapshot.tables.matches,
              index = legacy.columns.indexOf("venue_maps_url");
            legacy.columns.splice(index, 1);
            legacy.rows = legacy.rows.map((row: any[]) =>
              row.filter((_, i) => i !== index),
            );
            const restored = validator.validateForImport(
              gzipSync(JSON.stringify(snapshot)),
            );
            assert.equal(
              restored.tables.users.rows.length,
              current.tables.users.rows.length,
            );
            assert.equal(
              restored.tables.matches.rows.length,
              current.tables.matches.rows.length,
            );
            const mapIndex =
              restored.tables.matches.columns.indexOf("venue_maps_url");
            assert(
              restored.tables.matches.rows.every(
                (row) => row[mapIndex] === null,
              ),
            );
          } finally {
            target.close();
          }
        },
      );
      await t.test(
        "an existing database without the map column upgrades without rebuilding matches or users",
        async () => {
          const users = await db
            .prepare("SELECT id,email FROM users ORDER BY id")
            .all();
          const matches = await db
            .prepare("SELECT id,opponent,kick_off FROM matches ORDER BY id")
            .all();
          if (pg) {
            await pg.execute("ALTER TABLE matches DROP COLUMN venue_maps_url");
            await migratePostgres(pg);
          } else {
            getDb().exec("ALTER TABLE matches DROP COLUMN venue_maps_url");
            migrate();
          }
          assert.deepEqual(
            await db.prepare("SELECT id,email FROM users ORDER BY id").all(),
            users,
          );
          assert.deepEqual(
            await db
              .prepare("SELECT id,opponent,kick_off FROM matches ORDER BY id")
              .all(),
            matches,
          );
          assert(
            (
              await db.prepare("SELECT venue_maps_url FROM matches").all()
            ).every((row) => row.venue_maps_url === null),
          );
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
