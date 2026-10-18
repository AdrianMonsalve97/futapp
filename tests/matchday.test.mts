import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import sharp from "sharp";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { colombiaDay, matchDayPolicy } from "../backend/src/domain/matchday";
import { phaseSlots } from "../backend/src/domain/tactical-phases";
import { getFormation } from "../backend/src/domain/formations";
import { refereePaymentLabel } from "../frontend/src/utils/referee-payment-label";
import { testPostgres } from "./postgres-helper.mts";

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "futapp-matchday-"));
process.env.DB_PATH = path.join(directory, "fixture.db");
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "matchday-isolated-test-secret-12345678901234567890";
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
const { FileMediaStorage } = await import(
  "../backend/src/adapters/out/persistence/media-storage"
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

test("today means Colombia: the one-match authorization expires exactly at midnight and does not follow a reschedule", () => {
  const game = { kickOff: "2026-10-18T15:00", status: "programado" as const };
  const end = Date.parse("2026-10-19T05:00:00Z");
  assert.equal(colombiaDay(end - 1), "2026-10-18");
  assert.equal(colombiaDay(end), "2026-10-19");
  assert.equal(
    matchDayPolicy(game, "2026-10-18", end - 1).attendanceOnlyUntil,
    new Date(end).toISOString(),
  );
  assert.equal(
    matchDayPolicy(game, "2026-10-18", end).attendanceOnlyUntil,
    null,
  );
  assert.equal(matchDayPolicy(game, null, end - 1).attendanceOnlyUntil, null);
  assert.equal(
    matchDayPolicy(
      { ...game, kickOff: "2026-10-18T20:00:00Z" },
      "2026-10-18",
      end - 1,
    ).isMatchDay,
    true,
  );
  for (const status of ["pospuesto", "jugado", "cancelado"] as const)
    assert.equal(
      matchDayPolicy({ ...game, status }, "2026-10-18", end - 1)
        .attendanceOnlyUntil,
      null,
    );
  assert.equal(
    matchDayPolicy(
      { ...game, kickOff: "2026-10-19T15:00" },
      "2026-10-18",
      end + 1,
    ).attendanceOnlyUntil,
    null,
  );
});

for (const dialect of ["sqlite", "postgres"] as const)
  test(`${dialect}: confirmed matchday roster, unpaid XI, real debt, privacy, expiration and backup`, async (t) => {
    migrate();
    const pg = dialect === "postgres" ? await testPostgres() : null;
    if (pg) await migratePostgres(pg);
    const db = pg ?? asAsyncDatabase(getDb());
    let now = Date.parse("2026-10-18T15:00:00Z");
    t.mock.method(Date, "now", () => now);
    const media = new FileMediaStorage(db);
    const c = createContainer({
      db,
      media,
      model: { load: async () => null, save: async () => {} },
    } as any);
    const password = "Matchday fixture 123!";
    const players = [];
    for (const [index, role] of [
      ...getFormation("1-3-3-1", 8).slots.map((slot) => slot.role),
      "DEL" as const,
    ].entries())
      players.push(
        await c.playerService.create({
          email: `matchday-${dialect}-${index}@test.local`,
          password,
          fullName: `Jugador de prueba ${index}`,
          position: role,
          shirtNumber: index,
        }),
      );
    const email = `matchday-admin-${dialect}@test.local`;
    await db
      .prepare(
        "INSERT INTO users(email,password_hash,full_name,role) SELECT ?,password_hash,'Admin','admin' FROM users WHERE id=?",
      )
      .run(email, players[0].user.id);
    const adminUser = await c.authService.login({ email, password }),
      own = await c.authService.login({
        email: players[0].user.email,
        password,
      });
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
      route: string,
      body?: unknown,
      token = adminUser.token,
    ) => {
      const response = await fetch(
        `http://127.0.0.1:${address.port}/api${route}`,
        {
          method,
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        },
      );
      return { status: response.status, data: (await response.json()) as any };
    };
    try {
      const game = await c.matchService.create({
        opponent: "Rival de hoy",
        kickOff: "2026-10-18T15:00",
        format: 8,
      });
      const tomorrow = await c.matchService.create({
        opponent: "Próxima fecha",
        kickOff: "2026-10-19T15:00",
        format: 8,
      });
      for (const row of players.slice(0, 8))
        await c.matchService.setAttendance(game.id, row.user.id, "confirmado");
      const slots = getFormation("1-3-3-1", 8).slots.map((slot, index) => ({
        ...slot,
        playerId: players[index].player.id,
      }));
      await assert.rejects(c.matchService.setLineup(game.id, slots));
      const endpoint = `/matches/${game.id}/referee/allow-confirmed-today`;
      assert.equal(
        (await request("POST", endpoint, { date: "2026-10-18" }, "")).status,
        401,
      );
      assert.equal(
        (await request("POST", endpoint, { date: "2026-10-18" }, own.token))
          .status,
        403,
      );
      for (const body of [
        { date: "2026-10-19" },
        { date: "2026-02-30" },
        { date: "2026-10-18", total: 0 },
        JSON.parse('{"date":"2026-10-18","__proto__":{}}'),
      ])
        assert.equal((await request("POST", endpoint, body)).status, 400);
      assert.equal(
        (
          await request(
            "POST",
            `/matches/${tomorrow.id}/referee/allow-confirmed-today`,
            { date: "2026-10-18" },
          )
        ).status,
        400,
      );
      const activated = await request("POST", endpoint, { date: "2026-10-18" });
      assert.equal(activated.status, 200);
      const view = activated.data;
      assert.equal(view.isMatchDay, true);
      assert.equal(view.attendanceOnlyUntil, "2026-10-19T05:00:00.000Z");
      assert.equal(view.total, 120000);
      assert.equal(view.collected, 0);
      assert.equal(view.outstanding, 120000);
      assert.equal(view.attendees, 8);
      assert(
        view.rows
          .filter((row: any) => row.amount > 0)
          .every(
            (row: any) =>
              row.starterEligible &&
              row.benchEligible &&
              row.status === "pendiente" &&
              row.amount === 15000 &&
              row.paid === 0,
          ),
      );
      assert.equal(
        view.rows.find((row: any) => row.playerId === players[8].player.id)
          .starterEligible,
        false,
      );
      assert.equal(
        (await request("POST", endpoint, { date: "2026-10-18" })).status,
        200,
        "idempotent activation",
      );
      assert.equal(
        (await c.matchService.referee(tomorrow.id)).attendanceOnlyUntil,
        null,
      );
      const bad = slots.map((row) => ({ ...row }));
      bad[7].playerId = players[8].player.id;
      await assert.rejects(c.matchService.setLineup(game.id, bad));
      const suspension = await c.sanctionService.create({
        playerId: players[7].player.id,
        type: "suspension",
        reason: "Fixture aislado",
      });
      await assert.rejects(c.matchService.setLineup(game.id, slots));
      await c.sanctionService.remove(suspension.id);
      await db
        .prepare("UPDATE users SET active=0 WHERE id=?")
        .run(players[7].user.id);
      await assert.rejects(c.matchService.setLineup(game.id, slots));
      await db
        .prepare("UPDATE users SET active=1 WHERE id=?")
        .run(players[7].user.id);
      const recommendation = await c.aiService.recommendXi(game.id);
      assert.equal(
        recommendation.lineup.filter((row) => row.playerId !== null).length,
        8,
      );
      assert(
        recommendation.lineup.every(
          (row) => row.playerId !== players[8].player.id,
        ),
      );
      await c.matchService.setLineup(game.id, slots);
      await c.matchService.publishLineup(game.id);
      assert.equal(
        (await c.matchService.get(game.id)).lineup.filter(
          (row) => row.refereePaymentPending,
        ).length,
        8,
      );
      assert.equal(
        (await c.aiService.tacticalPlan(game.id)).recommendation.lineup.filter(
          (row) => row.refereePaymentPending,
        ).length,
        8,
      );
      const publicGame = await request(
        "GET",
        `/matches/${game.id}`,
        undefined,
        own.token,
      );
      assert.equal(
        publicGame.data.lineup.filter((row: any) => row.playerId !== null)
          .length,
        8,
      );
      assert(
        publicGame.data.lineup.every(
          (row: any) => !Object.hasOwn(row, "refereePaymentPending"),
        ),
      );
      const ownFees = (
        await request(
          "GET",
          `/matches/${game.id}/referee`,
          undefined,
          own.token,
        )
      ).data;
      assert.equal(ownFees.rows.length, 1);
      assert.equal(ownFees.collected, undefined);
      const image = await sharp({
        create: { width: 8, height: 8, channels: 3, background: "#edcf84" },
      })
        .png()
        .toBuffer();
      const proof = await c.qrPaymentService.submit(
        players[0].user.id,
        {
          kind: "referee",
          targetId: game.id,
          amount: 15000,
          reference: "MATCHDAY-" + randomUUID(),
          paidAt: "2026-10-18T14:00:00Z",
          idempotencyKey: randomUUID(),
        },
        "comprobante.png",
        image,
      );
      const pending = (await c.matchService.referee(game.id)).rows.find(
        (row) => row.playerId === players[0].player.id,
      )!;
      assert.equal(pending.status, "en_revision");
      assert.equal(pending.outstanding, 15000);
      assert.equal(pending.starterEligible, true);
      assert(
        refereePaymentLabel(pending, view.attendanceOnlyUntil).includes(
          "revisión",
        ),
      );
      assert(
        !refereePaymentLabel(pending, view.attendanceOnlyUntil).includes(
          "solo suplente",
        ),
      );
      await c.qrPaymentService.review(
        proof.id,
        adminUser.user.id,
        "aprobado",
        "Prueba aislada, sin envío externo",
      );
      const paid = (await c.matchService.referee(game.id)).rows.find(
        (row) => row.playerId === players[0].player.id,
      )!;
      assert.equal(paid.status, "tardio");
      assert.equal(paid.paid, 15000);
      assert.equal(paid.outstanding, 0);
      assert.equal(paid.starterEligible, true);
      const marked = (await c.matchService.get(game.id)).lineup;
      assert.equal(marked.filter((row) => row.refereePaymentPending).length, 7);
      assert.equal(
        marked.find((row) => row.playerId === players[0].player.id)
          ?.refereePaymentPending,
        false,
      );
      assert.equal(
        phaseSlots(marked, "1-2-3-2", 8).filter(
          (row) => row.refereePaymentPending,
        ).length,
        7,
      );
      (globalThis as any).React = React;
      const { AuthProvider } = await import(
        "../frontend/src/context/AuthContext"
      );
      const { TacticalBoard } = await import(
        "../frontend/src/organisms/TacticalBoard"
      );
      const { MatchdayRoster } = await import(
        "../frontend/src/molecules/MatchdayRoster"
      );
      const render = (children: React.ReactNode) =>
        renderToStaticMarkup(React.createElement(AuthProvider, { children }));
      const board = render(
        React.createElement(TacticalBoard, {
          slots: marked,
          format: 8,
          formation: "1-3-3-1",
          phase: "ataque",
        }),
      );
      assert.equal(
        (board.match(/class="referee-pending-dot"/g) ?? []).length,
        7,
      );
      assert(board.includes("arbitraje pendiente de pago aprobado"));
      const attendance = await c.matchService.attendance(game.id),
        confirmed = attendance.filter((row) => row.status === "confirmado");
      const roster = render(
        React.createElement(MatchdayRoster, {
          confirmed,
          slots: marked.slice(0, 7),
        }),
      );
      assert.equal(
        (roster.match(/class="referee-pending-dot"/g) ?? []).length,
        7,
      );
      assert(roster.includes("Banco"));
      assert(!roster.includes(players[8].user.fullName));
      const publicBoard = render(
        React.createElement(TacticalBoard, {
          slots: publicGame.data.lineup,
          format: 8,
          formation: "1-3-3-1",
        }),
      );
      assert(!publicBoard.includes("referee-pending-dot"));
      const exporter = pg
        ? new PostgresMigrationStore(pg, {
            get: async (key: string) =>
              fs.promises.readFile(path.join(directory, "uploads", key)),
          } as any)
        : new FileMigrationStore(getDb(), directory);
      const bytes = await exporter.exportData(),
        snapshot = JSON.parse(gunzipSync(bytes).toString());
      const trial = new Database(":memory:");
      try {
        migrate(trial);
        const store = new FileMigrationStore(
          trial,
          path.join(directory, `restored-${dialect}`),
        );
        const packet = store.validateForImport(bytes),
          fees = packet.tables.match_referee_fees;
        assert(
          fees.rows.some(
            (row) =>
              row[fees.columns.indexOf("matchday_access_date")] ===
              "2026-10-18",
          ),
        );
        trial
          .prepare(
            "INSERT INTO users(email,password_hash,full_name,role) VALUES('bootstrap@test.local','isolated','Bootstrap','admin')",
          )
          .run();
        store.enable(true);
        const preview = await store.preview(1, bytes);
        await store.commit(1, preview.id, "IMPORTAR");
        assert.equal(
          (
            trial
              .prepare(
                "SELECT matchday_access_date FROM match_referee_fees WHERE match_id=?",
              )
              .get(game.id) as any
          ).matchday_access_date,
          "2026-10-18",
        );
        assert.equal(
          (
            trial
              .prepare("SELECT amount FROM payment_receipts WHERE id=?")
              .get(proof.id) as any
          ).amount,
          15000,
        );
        const corrupt = structuredClone(snapshot);
        corrupt.tables.match_referee_fees.rows[0][
          corrupt.tables.match_referee_fees.columns.indexOf(
            "matchday_access_date",
          )
        ] = "2026-02-30";
        assert.throws(() =>
          store.validateForImport(gzipSync(JSON.stringify(corrupt))),
        );
        const legacy = snapshot.tables.match_referee_fees,
          index = legacy.columns.indexOf("matchday_access_date");
        legacy.columns.splice(index, 1);
        legacy.rows = legacy.rows.map((row: any[]) =>
          row.filter((_, i) => i !== index),
        );
        const compatible = store.validateForImport(
          gzipSync(JSON.stringify(snapshot)),
        );
        assert(
          compatible.tables.match_referee_fees.rows.every(
            (row) =>
              row[
                compatible.tables.match_referee_fees.columns.indexOf(
                  "matchday_access_date",
                )
              ] === null,
          ),
        );
        assert.deepEqual(
          compatible.tables.payment_receipts,
          packet.tables.payment_receipts,
        );
        assert.deepEqual(compatible.files, packet.files);
      } finally {
        trial.close();
      }
      now = Date.parse("2026-10-19T04:59:59.999Z");
      assert((await c.matchService.referee(game.id)).attendanceOnlyUntil);
      now++;
      const expired = await c.matchService.referee(game.id);
      assert.equal(expired.attendanceOnlyUntil, null);
      assert.equal(
        expired.rows.find((row) => row.playerId === players[0].player.id)
          ?.starterEligible,
        false,
      );
      assert.equal(
        expired.rows.find((row) => row.playerId === players[0].player.id)
          ?.benchEligible,
        true,
      );
      assert.equal(expired.outstanding, 105000);
      assert.equal(expired.collected, 15000);
      assert(
        (await c.matchService.get(game.id, true)).lineup.every(
          (row) => row.playerId === null,
        ),
      );
      await assert.rejects(c.matchService.setLineup(game.id, slots));
      await assert.rejects(
        c.matchService.allowConfirmedToday(game.id, "2026-10-18"),
      );
      // Another same-day fixture proves a paid reserve wins the initial place,
      // even when the unpaid natural striker was listed first.
      now = Date.parse("2026-10-18T15:00:00Z");
      const preferredGame = await c.matchService.create({
        opponent: "Prioridad de pago",
        kickOff: "2026-10-18T16:00",
        format: 8,
      });
      for (const player of players)
        await c.matchService.setAttendance(
          preferredGame.id,
          player.user.id,
          "confirmado",
        );
      await c.matchService.allowConfirmedToday(preferredGame.id, "2026-10-18");
      const share = (await c.matchService.referee(preferredGame.id)).rows.find(
        (row) => row.playerId === players[8].player.id,
      )!.amount;
      const paidReserve = await c.qrPaymentService.submit(
        players[8].user.id,
        {
          kind: "referee",
          targetId: preferredGame.id,
          amount: share,
          reference: "PRIORITY-" + randomUUID(),
          paidAt: "2026-10-18T14:00:00Z",
          idempotencyKey: randomUUID(),
        },
        "reserva.png",
        image,
      );
      await c.qrPaymentService.review(
        paidReserve.id,
        adminUser.user.id,
        "aprobado",
        "Prueba aislada de prioridad",
      );
      const prioritized = await c.aiService.recommendXi(
        preferredGame.id,
        "1-3-3-1",
      );
      assert.equal(
        prioritized.lineup.filter((row) => row.playerId !== null).length,
        8,
      );
      assert(
        prioritized.lineup.some((row) => row.playerId === players[8].player.id),
      );
      assert(
        !prioritized.bench?.some(
          (row) => row.playerId === players[8].player.id,
        ),
      );
      assert(
        prioritized.bench?.some((row) => row.playerId === players[7].player.id),
      );
      assert(
        prioritized.lineup.every((row) => row.role === row.playerPosition),
      );
      assert(prioritized.explanation.includes("Prioridad del inicial"));
      assert(
        prioritized.bench?.every(
          (row) => !Object.hasOwn(row, "selectionPriority"),
        ),
      );
      const prioritizedPlan = await c.aiService.tacticalPlan(
        preferredGame.id,
        undefined,
        "1-3-3-1",
      );
      assert.equal(
        prioritizedPlan.recommendation.lineup.find(
          (row) => row.playerId === players[8].player.id,
        )?.refereePaymentPending,
        false,
      );
      const accounts = await db
          .prepare("SELECT id,email FROM users ORDER BY id")
          .all(),
        receipts = await db.prepare("SELECT * FROM payment_receipts").all();
      if (pg) {
        await pg.execute(
          "ALTER TABLE match_referee_fees DROP COLUMN matchday_access_date",
        );
        await migratePostgres(pg);
        await migratePostgres(pg);
      } else {
        getDb().exec(
          "ALTER TABLE match_referee_fees DROP COLUMN matchday_access_date",
        );
        migrate();
        migrate();
      }
      assert.deepEqual(
        await db.prepare("SELECT id,email FROM users ORDER BY id").all(),
        accounts,
      );
      assert.deepEqual(
        await db.prepare("SELECT * FROM payment_receipts").all(),
        receipts,
      );
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      if (pg) {
        await pg.execute("DROP SCHEMA futapp CASCADE");
        await pg.close();
      }
    }
  });
