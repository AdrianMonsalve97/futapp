import { AuthProvider } from "../frontend/src/context/AuthContext";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import bcrypt from "bcryptjs";
import { testPostgres } from "./postgres-helper.mts";
import {
  awaitingResult,
  kickoffTime,
  matchCalendar,
  upcomingFixtures,
} from "../backend/src/domain/match-schedule";
import { tacticalMotion } from "../frontend/src/utils/tactical-motion";
import {
  TACTICAL_TILE_HEIGHT,
  tacticalLayout,
} from "../frontend/src/utils/tactical-board";
import {
  phaseSlots,
  resolvePhaseFormations,
} from "../backend/src/domain/tactical-phases";
import { formationsFor } from "../backend/src/domain/formations";
import { pitchSlotsFrom } from "../frontend/src/utils/lineup-slots";
import { buildPlays } from "../backend/src/domain/coaching";
import { tacticalPlayPhase } from "../frontend/src/utils/tactical-play";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { CoachingPlanPanel } from "../frontend/src/organisms/CoachingPlanPanel";
import { buildTrainingPlan } from "../backend/src/domain/training-plan";
import { getFormat } from "../backend/src/domain/formats";

const directory = fs.mkdtempSync(
  path.join(os.tmpdir(), "futapp-match-experience-"),
);
process.env.DB_PATH = path.join(directory, "fixture.db");
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "match-experience-isolated-tests-123456789012345";
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
after(() => {
  closeDb();
  assert.equal(path.dirname(directory), os.tmpdir());
  fs.rmSync(directory, { recursive: true, force: true });
});

test("elapsed F8 fixtures leave upcoming without inventing completion; live regulation and confirmed breaks stay visible", () => {
  const match = {
    id: 1,
    status: "programado" as const,
    kickOff: "2026-10-18T15:00",
    minutes: 50,
  };
  const start = kickoffTime(match.kickOff);
  assert.equal(awaitingResult(match, start + 50 * 60_000 - 1), false);
  assert.equal(awaitingResult(match, start + 50 * 60_000), true);
  assert.equal(upcomingFixtures([match], start + 20 * 60_000).featured?.id, 1);
  const snapshot = structuredClone(match);
  const calendar = matchCalendar([match], start + 51 * 60_000);
  assert.equal(calendar.upcoming.length, 0);
  assert.equal(calendar.results[0].id, 1);
  assert.equal(calendar.results[0].status, "programado");
  assert.deepEqual(match, snapshot);
  assert.equal(
    awaitingResult({ ...match, status: "pospuesto" }, start + 999999999),
    false,
  );
  assert.equal(awaitingResult({ ...match, kickOff: "invalid" }, start), false);
  const rules = { periods: 2, breakMinutes: 10 } as any;
  assert.equal(
    awaitingResult({ ...match, tournamentRules: rules }, start + 59 * 60_000),
    false,
  );
  assert.equal(
    awaitingResult({ ...match, tournamentRules: rules }, start + 60 * 60_000),
    true,
  );
  const future = { ...match, id: 2, kickOff: "2026-10-25T15:00" };
  assert.equal(
    upcomingFixtures([match, future], start + 51 * 60_000).featured?.id,
    2,
  );
});

test("off-ball rehearsal moves the actual cards, preserves photos and goalkeeper, and keeps every format separated on phones", () => {
  let moving = 0;
  for (const format of [5, 7, 8, 11] as const)
    for (const formation of formationsFor(format)) {
      const slots = pitchSlotsFrom(formation.key, [], format).map((slot) => ({
        ...slot,
        playerId: slot.slotIndex + 1,
        avatarUrl: "/api/media/private-photo",
      }));
      const original = structuredClone(slots);
      for (const play of buildPlays(slots, "equilibrado"))
        for (let step = 0; step < play.route.length; step++)
          for (const width of [224, 320, 390, 768, 860]) {
            const phase = tacticalPlayPhase(play.phase, step);
            const active =
              phase === "estructura"
                ? slots
                : phaseSlots(
                    slots,
                    resolvePhaseFormations(formation.key, format)[phase],
                    format,
                  );
            const layout = tacticalLayout(active, width);
            const frame = tacticalMotion(
              layout.slots,
              play.route,
              step,
              width,
              layout.height,
              layout.tileWidth,
            );
            assert.deepEqual(
              frame.map((row) => row.playerId),
              layout.slots.map((row) => row.playerId),
            );
            assert(
              frame.every(
                (row) => row.avatarUrl === "/api/media/private-photo",
              ),
            );
            assert.deepEqual(
              frame.find((row) => row.role === "POR"),
              layout.slots.find((row) => row.role === "POR"),
            );
            for (const [index, slot] of frame.entries()) {
              if (
                slot.left !== layout.slots[index].left ||
                slot.top !== layout.slots[index].top
              )
                moving++;
              assert(
                (slot.left * width) / 100 - layout.tileWidth / 2 >= 0 &&
                  (slot.left * width) / 100 + layout.tileWidth / 2 <= width,
              );
              assert(
                (slot.top * layout.height) / 100 >= TACTICAL_TILE_HEIGHT / 2 &&
                  (slot.top * layout.height) / 100 <=
                    layout.height - TACTICAL_TILE_HEIGHT / 2,
              );
              for (const other of frame.slice(index + 1))
                assert(
                  (Math.abs(slot.left - other.left) * width) / 100 >=
                    layout.tileWidth + 3.99 ||
                    (Math.abs(slot.top - other.top) * layout.height) / 100 >=
                      TACTICAL_TILE_HEIGHT + 8,
                  `${format}/${formation.key}/${play.id}/${step}/${width}: overlapping cards`,
                );
            }
          }
      assert.deepEqual(slots, original);
    }
  assert(
    moving > 100,
    "replay includes real off-ball movement, not only a moving ball",
  );
});

test("free rehearsal renders without a match, exposes assignment and all systems, and cannot apply an official draft", () => {
  (globalThis as any).React = React;
  const plan = buildTrainingPlan(getFormat(8), [], { style: "equilibrado" });
  const html = renderToStaticMarkup(
    React.createElement(AuthProvider, {
      children: React.createElement(MemoryRouter, {
        children: React.createElement(CoachingPlanPanel, {
          plan,
          busy: null,
          editable: false,
          onApply: () => {},
          onFormation: () => {},
          onSlotSelect: () => {},
        }),
      }),
    }),
  );
  assert(html.includes("ENSAYO LIBRE"));
  assert(html.includes("Sistema de juego"));
  assert(!html.includes("Usar propuesta como borrador"));
  assert(!html.includes("/partidos/null"));
  assert.equal((html.match(/class="fc-position"/g) ?? []).length, 8);
  assert(html.includes("Elegir jugador"));
  assert(!html.includes("asistencia, pagos aprobados"));
});

for (const dialect of ["sqlite", "postgres"] as const)
  test(`${dialect}: free rehearsal ignores attendance and fees; final scores update the real league exactly once`, async (t) => {
    migrate();
    const pg = dialect === "postgres" ? await testPostgres() : null;
    if (pg) await migratePostgres(pg);
    const db = pg ?? asAsyncDatabase(getDb());
    const c = createContainer({
      db,
      media: {
        save: async () => {
          throw new Error("No real uploads");
        },
        read: async () => null,
        delete: async () => {},
      },
      model: { load: async () => null, save: async () => {} },
    } as any);
    const password = "Private test 123!";
    await db
      .prepare(
        "INSERT INTO users(email,password_hash,full_name,role) VALUES(?,?,?,'admin')",
      )
      .run(`${dialect}@match.test`, bcrypt.hashSync(password, 4), "Test admin");
    const players = [];
    for (const [index, position] of [
      "POR",
      "DEF",
      "DEF",
      "DEF",
      "MED",
      "MED",
      "MED",
      "DEL",
      "POR",
    ].entries())
      players.push(
        await c.playerService.create({
          email: `${dialect}-${index}@match.test`,
          password,
          fullName: `Test ${index}`,
          position: position as any,
          shirtNumber: index,
        }),
      );
    await db
      .prepare("UPDATE users SET active=0 WHERE id=?")
      .run(players[8].user.id);
    await c.sanctionService.create({
      playerId: players[6].player.id,
      type: "suspension",
      reason: "Sporting suspension in isolated fixture",
    });
    const tournament = await c.tournamentService.save(null, {
      name: "Isolated league",
      leagueName: "Test",
      season: "2026",
      status: "publicado",
      notes: "",
      rules: {
        format: 8,
        periods: 2,
        minutesPerPeriod: 25,
        breakMinutes: 5,
        maxSquad: 8,
        maxSubstitutions: null,
        rollingSubstitutions: true,
        allowedFormations: ["1-3-3-1"],
        tacticalStyle: "equilibrado",
      },
    });
    await c.tournamentService.addPlayers(tournament.id, [players[0].player.id]);
    const game = await c.matchService.create({
      opponent: "Isolated rival",
      kickOff: "2026-10-18T15:00",
      tournamentId: tournament.id,
    });
    const admin = (
      await c.authService.login({ email: `${dialect}@match.test`, password })
    ).token;
    const player = (
      await c.authService.login({ email: players[0].user.email, password })
    ).token;
    const app = createHttpServer({
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
    });
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    assert(address && typeof address !== "string");
    const request = async (
      method: string,
      route: string,
      body?: unknown,
      token = admin,
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
      await t.test(
        "training uses all active players with no attendance, enrollment or payment requirement and never writes a lineup",
        async () => {
          const before = await c.matchService.get(game.id);
          const plan = await request("POST", "/ai/training-plan", {
            matchId: game.id,
            formation: "1-2-3-2",
          });
          assert.equal(plan.status, 200);
          assert.equal(plan.data.mode, "training");
          assert.equal(plan.data.roster.length, 8);
          assert.equal(
            plan.data.recommendation.lineup.filter(
              (slot: any) => slot.playerId !== null,
            ).length,
            8,
          );
          assert.equal(
            new Set(
              plan.data.recommendation.lineup.map((slot: any) => slot.playerId),
            ).size,
            8,
          );
          assert(
            plan.data.recommendation.lineup.some(
              (slot: any) => slot.playerId === players[6].player.id,
            ),
            "sporting suspension does not block rehearsal",
          );
          assert(
            !plan.data.roster.some(
              (row: any) => row.playerId === players[8].player.id,
            ),
          );
          assert(
            plan.data.recommendation.lineup.every(
              (slot: any) => !slot.refereePaymentPending,
            ),
          );
          assert(!JSON.stringify(plan.data).includes("selectionPriority"));
          assert(!JSON.stringify(plan.data.roster).includes("email"));
          assert.equal(plan.data.plays.length, 12);
          const official = await c.aiService.tacticalPlan(game.id);
          assert.equal(
            official.recommendation.lineup.filter(
              (slot) => slot.playerId !== null,
            ).length,
            0,
          );
          assert.deepEqual(await c.matchService.get(game.id), before);
          const free = await request("POST", "/ai/training-plan", {});
          assert.equal(free.status, 200);
          assert.equal(free.data.match.id, null);
          assert.equal(free.data.match.opponent, null);
          assert.equal(
            (await request("POST", "/ai/training-plan", {}, "")).status,
            401,
          );
          assert.equal(
            (await request("POST", "/ai/training-plan", {}, player)).status,
            403,
          );
          for (const body of [
            { matchId: -1 },
            { formation: "4-4-2" },
            { mode: "match" },
            { constructor: "bad" },
          ])
            assert.equal(
              (await request("POST", "/ai/training-plan", body)).status,
              400,
            );
        },
      );
      await t.test(
        "a saved draft score is visibly pending, finalization counts it once, corrections recalculate and player writes fail",
        async () => {
          await c.matchService.update(game.id, {
            goalsFor: 1,
            goalsAgainst: 5,
          });
          let view = await c.tournamentService.standings(tournament.id, true);
          assert.equal(view.counted, 0);
          const calendar = await c.meService.getMatches(players[0].user.id);
          assert.equal(calendar.upcoming.length, 0);
          assert.equal(calendar.finished[0].id, game.id);
          for (const token of ["", player])
            assert.equal(
              (
                await request(
                  "PUT",
                  `/matches/${game.id}`,
                  { status: "jugado", goalsFor: 1, goalsAgainst: 5 },
                  token,
                )
              ).status,
              token ? 403 : 401,
            );
          for (let repeat = 0; repeat < 2; repeat++) {
            assert.equal(
              (
                await request("PUT", `/matches/${game.id}`, {
                  status: "jugado",
                  goalsFor: 1,
                  goalsAgainst: 5,
                })
              ).status,
              200,
            );
            view = await c.tournamentService.standings(tournament.id, true);
            const club = view.rows.find((row) => row.club)!;
            assert.equal(view.counted, 1);
            assert.equal(club.played, 1);
            assert.equal(club.lost, 1);
            assert.equal(club.goalsFor, 1);
            assert.equal(club.goalsAgainst, 5);
            assert.equal(club.points, 0);
          }
          await c.matchService.update(game.id, {
            goalsFor: 5,
            goalsAgainst: 1,
          });
          const club = (
            await c.tournamentService.standings(tournament.id, true)
          ).rows.find((row) => row.club)!;
          assert.equal(club.played, 1);
          assert.equal(club.won, 1);
          assert.equal(club.points, 3);
          assert.equal(
            (await c.meService.getMatches(players[0].user.id)).finished[0]
              .status,
            "jugado",
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
