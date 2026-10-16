import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import Database from "better-sqlite3";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { formationsFor, getFormation } from "../backend/src/domain/formations";
import {
  phaseSlots,
  resolvePhaseFormations,
  validatePhaseFormations,
} from "../backend/src/domain/tactical-phases";
import { validateBody } from "../backend/src/adapters/in/rest/body-validation";
import { testPostgres } from "./postgres-helper.mts";

const directory = fs.mkdtempSync(
  path.join(os.tmpdir(), "futapp-phase-systems-"),
);
process.env.DB_PATH = path.join(directory, "fixture.db");
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "phase-system-isolated-tests-12345678901234567890";
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

test("every phase changes the actual system without losing identities, portraits, sides or the goalkeeper", () => {
  for (const format of [5, 7, 8, 11] as const)
    for (const base of formationsFor(format)) {
      const slots = base.slots.map((slot) => ({
        ...slot,
        playerId: slot.slotIndex + 1,
        avatarUrl: `/api/media/photo-${slot.slotIndex}`,
        highlighted: slot.slotIndex === 2,
      }));
      const before = structuredClone(slots);
      for (const target of formationsFor(format)) {
        const mapped = phaseSlots(slots, target.key, format);
        assert.equal(mapped.length, format);
        assert.equal(
          new Set(mapped.map((slot) => `${slot.x}/${slot.y}`)).size,
          format,
        );
        assert.deepEqual(
          mapped.map((slot) => slot.playerId),
          slots.map((slot) => slot.playerId),
        );
        assert.deepEqual(
          mapped.map((slot) => slot.avatarUrl),
          slots.map((slot) => slot.avatarUrl),
        );
        assert.deepEqual(
          mapped.map((slot) => slot.highlighted),
          slots.map((slot) => slot.highlighted),
        );
        assert.equal(
          mapped.find((slot) => slot.role === "POR")?.playerId,
          slots[0].playerId,
        );
        for (const role of ["POR", "DEF", "MED", "DEL"])
          assert.equal(
            mapped.filter((slot) => slot.role === role).length,
            target.slots.filter((slot) => slot.role === role).length,
          );
        assert.deepEqual(
          mapped.map((slot) => `${slot.x}/${slot.y}/${slot.label}`).sort(),
          target.slots
            .map((slot) => `${slot.x}/${slot.y}/${slot.label}`)
            .sort(),
        );
        assert.deepEqual(
          phaseSlots(slots, target.key, format),
          mapped,
          "deterministic player assignments",
        );
      }
      assert.deepEqual(slots, before);
      const allowed = [base.key];
      assert.deepEqual(
        resolvePhaseFormations(base.key, format, null, allowed),
        { ataque: base.key, repliegue: base.key },
      );
    }
  const base = getFormation("1-3-3-1", 8).slots;
  const attack = phaseSlots(base, "1-2-3-2", 8);
  assert.equal(attack.filter((slot) => slot.role === "DEF").length, 2);
  assert.equal(attack.filter((slot) => slot.role === "DEL").length, 2);
  assert(attack.find((slot) => slot.slotIndex === 1)!.x < 50);
  assert(attack.find((slot) => slot.slotIndex === 3)!.x > 50);
});

test("phase input rejects other formats, prohibited systems and nested unknown/prototype fields", () => {
  for (const value of [
    null,
    [],
    {},
    { ataque: "4-3-3", repliegue: "1-3-3-1" },
    { ataque: "1-2-3-2", repliegue: "1-3-3-1" },
    JSON.parse('{"ataque":"1-3-3-1","repliegue":"1-3-3-1","__proto__":{}}'),
  ]) {
    assert.throws(() => validatePhaseFormations(value, 8, ["1-3-3-1"]));
  }
  for (const key of ["constructor", "__proto__", "toString"])
    assert.throws(() =>
      validateBody("/matches/1/lineup", "PUT", {
        slots: [],
        phaseFormations: JSON.parse(
          `{"ataque":"1-3-3-1","repliegue":"1-3-3-1","${key}":{}}`,
        ),
      }),
    );
  validateBody("/matches/1/lineup", "PUT", {
    slots: [],
    phaseFormations: { ataque: "1-2-3-2", repliegue: "1-3-3-1" },
  });
});

test("the board exposes independent phase systems and renders their actual roles and editable selector", async () => {
  (globalThis as any).React = React;
  const { AuthProvider } = await import("../frontend/src/context/AuthContext");
  const { TacticalBoard } = await import(
    "../frontend/src/organisms/TacticalBoard"
  );
  const slots = getFormation("1-3-3-1", 8).slots.map((slot) => ({
    ...slot,
    playerId: slot.slotIndex + 1,
    playerName: `Compañero ${slot.slotIndex}`,
  }));
  const phases = { ataque: "1-2-3-2", repliegue: "1-3-2-2" };
  const render = (phase: "estructura" | "ataque" | "repliegue") =>
    renderToStaticMarkup(
      React.createElement(AuthProvider, {
        children: React.createElement(TacticalBoard, {
          slots,
          format: 8,
          formation: "1-3-3-1",
          phaseFormations: phases,
          phase,
          onPhaseFormationChange: () => {},
        }),
      }),
    );
  const base = render("estructura"),
    attack = render("ataque"),
    defense = render("repliegue");
  assert(base.includes("Sistema 1-3-3-1"));
  assert(attack.includes("Sistema con balón"));
  assert(attack.includes('value="1-2-3-2" selected=""'));
  assert(defense.includes("Sistema sin balón"));
  assert(defense.includes('value="1-3-2-2" selected=""'));
  const anchors = (html: string) =>
    [...html.matchAll(/class="fc-position-anchor" style="([^"]+)/g)].map(
      (match) => match[1],
    );
  assert.notDeepEqual(anchors(base), anchors(attack));
  assert.notDeepEqual(anchors(attack), anchors(defense));
  for (const html of [base, attack, defense])
    assert.equal((html.match(/class="fc-position"/g) ?? []).length, 8);
});

for (const dialect of ["sqlite", "postgres"] as const)
  test(`${dialect}: draft phases, publication, authorization, rollback and backup compatibility`, async () => {
    migrate();
    const pg = dialect === "postgres" ? await testPostgres() : null;
    if (pg) await migratePostgres(pg);
    const db = pg ?? asAsyncDatabase(getDb());
    const c = createContainer({
      db,
      media: { read: async () => null },
      model: { load: async () => null, save: async () => {} },
    } as any);
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
    try {
      const password = "Phase test passphrase 123!";
      const players = [];
      for (const [index, slot] of getFormation("1-3-3-1", 8).slots.entries())
        players.push(
          await c.playerService.create({
            email: `phase-${dialect}-${index}@test.local`,
            password,
            fullName: `Jugador ${index}`,
            position: slot.role,
            shirtNumber: index,
          }),
        );
      const adminEmail = `phase-admin-${dialect}@test.local`;
      await db
        .prepare(
          "INSERT INTO users(email,password_hash,full_name,role) SELECT ?,password_hash,'Admin de prueba','admin' FROM users WHERE id=?",
        )
        .run(adminEmail, players[0].user.id);
      const admin = (await c.authService.login({ email: adminEmail, password }))
        .token;
      const token = (
        await c.authService.login({ email: players[0].user.email, password })
      ).token;
      const request = async (
        method: string,
        route: string,
        body?: unknown,
        authorization = token,
      ) =>
        fetch(`http://127.0.0.1:${address.port}/api${route}`, {
          method,
          headers: {
            Authorization: `Bearer ${authorization}`,
            "Content-Type": "application/json",
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
      const match = await c.matchService.create({
        opponent: "Rival de prueba",
        kickOff: "2099-01-01T18:00",
        format: 8,
        formation: "1-3-3-1",
      });
      await db
        .prepare("UPDATE match_referee_fees SET total=0 WHERE match_id=?")
        .run(match.id);
      const slots = getFormation("1-3-3-1", 8).slots.map((slot, index) => ({
        ...slot,
        playerId: players[index].player.id,
      }));
      const first = { ataque: "1-2-3-2", repliegue: "1-3-3-1" };
      const second = { ataque: "1-3-2-2", repliegue: "1-3-2-2" };
      assert.equal(
        (
          await request("PUT", `/matches/${match.id}/lineup`, {
            slots,
            phaseFormations: first,
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await fetch(
            `http://127.0.0.1:${address.port}/api/matches/${match.id}`,
          )
        ).status,
        401,
      );
      assert.equal(
        (
          await request(
            "PUT",
            `/matches/${match.id}/lineup`,
            { slots, phaseFormations: { ...first, extra: "field" } },
            admin,
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await request(
            "PUT",
            `/matches/${match.id}/lineup`,
            { slots, phaseFormations: first },
            admin,
          )
        ).status,
        200,
      );
      assert.deepEqual(
        (await c.matchService.get(match.id)).match.phaseFormations,
        first,
      );
      assert.equal(
        (await (await request("GET", `/matches/${match.id}`)).json()).match
          .phaseFormations,
        null,
      );
      assert.equal(
        (await (await request("GET", "/matches")).json()).find(
          (row: any) => row.id === match.id,
        ).phaseFormations,
        null,
      );
      await c.matchService.publishLineup(match.id);
      await c.matchService.setLineup(match.id, slots, second);
      assert.deepEqual(
        (await c.matchService.get(match.id)).match.phaseFormations,
        second,
      );
      assert.deepEqual(
        (await c.matchService.get(match.id, true)).match.phaseFormations,
        first,
      );
      assert.deepEqual(
        (await (await request("GET", "/me/matches")).json()).upcoming.find(
          (row: any) => row.id === match.id,
        ).phaseFormations,
        first,
      );
      assert.deepEqual(
        (await (await request("GET", "/dashboard/player")).json()).upcomingMatch
          .phaseFormations,
        first,
      );
      assert.deepEqual(
        (await c.aiService.playerInsight(players[0].player.id, match.id))
          .preparation.phaseFormations,
        first,
      );
      assert.deepEqual(
        (await c.aiService.tacticalPlan(match.id)).recommendation
          .phaseFormations,
        second,
      );
      const before = await c.matchService.get(match.id);
      await assert.rejects(
        c.matchService.setLineup(match.id, slots, {
          ataque: "4-3-3",
          repliegue: "1-3-3-1",
        }),
      );
      assert.deepEqual(await c.matchService.get(match.id), before);
      const repository = (c.matchService as any).matches;
      const update = repository.update;
      repository.update = async () => {
        throw new Error("isolated storage failure");
      };
      const reordered = slots.map((slot) => ({ ...slot }));
      [reordered[1].playerId, reordered[2].playerId] = [
        reordered[2].playerId,
        reordered[1].playerId,
      ];
      try {
        await assert.rejects(
          c.matchService.setLineup(match.id, reordered, first),
          /isolated storage failure/,
        );
      } finally {
        repository.update = update;
      }
      assert.deepEqual(
        await c.matchService.get(match.id),
        before,
        "phase and XI are one transaction",
      );
      await c.matchService.publishLineup(match.id);
      assert.deepEqual(
        (await c.matchService.get(match.id, true)).match.phaseFormations,
        second,
      );
      const tournament = await c.tournamentService.save(null, {
        name: "Liga con sistema limitado",
        leagueName: "Organizador",
        season: "2099",
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
      const limited = await c.matchService.create({
        opponent: "Rival",
        kickOff: "2099-02-01T18:00",
        tournamentId: tournament.id,
      });
      const empty = slots.map((slot) => ({ ...slot, playerId: null }));
      await assert.rejects(c.matchService.setLineup(limited.id, empty, first));
      await c.matchService.setLineup(limited.id, empty, {
        ataque: "1-3-3-1",
        repliegue: "1-3-3-1",
      });
      const exporter = pg
        ? new PostgresMigrationStore(pg, { read: async () => null } as any)
        : new FileMigrationStore(getDb(), directory);
      const bytes = await exporter.exportData(),
        snapshot = JSON.parse(gunzipSync(bytes).toString());
      const trial = new Database(":memory:");
      try {
        migrate(trial);
        const store = new FileMigrationStore(trial, directory);
        const packet = store.validateForImport(bytes);
        const table = packet.tables.matches;
        assert(
          table.rows.some(
            (row) =>
              row[table.columns.indexOf("phase_formations")] ===
              JSON.stringify(second),
          ),
        );
        trial
          .prepare(
            "INSERT INTO users(email,password_hash,full_name,role) VALUES('bootstrap@test.local','isolated-bootstrap','Bootstrap','admin')",
          )
          .run();
        store.enable(true);
        const preview = await store.preview(1, bytes);
        await store.commit(1, preview.id, "IMPORTAR");
        assert.deepEqual(
          trial
            .prepare(
              "SELECT phase_formations,published_phase_formations FROM matches WHERE id=?",
            )
            .get(match.id),
          {
            phase_formations: JSON.stringify(second),
            published_phase_formations: JSON.stringify(second),
          },
        );
        for (const column of [
          "phase_formations",
          "published_phase_formations",
        ]) {
          const corrupt = structuredClone(snapshot);
          corrupt.tables.matches.rows[0][
            corrupt.tables.matches.columns.indexOf(column)
          ] = '{"ataque":"4-3-3","repliegue":"1-3-3-1"}';
          assert.throws(() =>
            store.validateForImport(gzipSync(JSON.stringify(corrupt))),
          );
          const index = snapshot.tables.matches.columns.indexOf(column);
          snapshot.tables.matches.columns.splice(index, 1);
          snapshot.tables.matches.rows = snapshot.tables.matches.rows.map(
            (row: any[]) => row.filter((_, i) => i !== index),
          );
        }
        const old = store.validateForImport(gzipSync(JSON.stringify(snapshot)));
        assert.equal(
          old.tables.users.rows.length,
          packet.tables.users.rows.length,
        );
        assert.deepEqual(old.tables.players, packet.tables.players);
        for (const column of ["phase_formations", "published_phase_formations"])
          assert(
            old.tables.matches.rows.every(
              (row) => row[old.tables.matches.columns.indexOf(column)] === null,
            ),
          );
      } finally {
        trial.close();
      }
      await repository.unpublishLineup(match.id);
      assert.equal(
        (await c.matchService.get(match.id, true)).match.phaseFormations,
        null,
      );
      assert.equal(
        (await repository.findById(match.id)).publishedPhaseFormations,
        null,
      );
      await c.matchService.update(match.id, { tournamentId: tournament.id });
      assert.deepEqual(
        (await c.matchService.get(match.id)).match.phaseFormations,
        {
          ataque: "1-3-3-1",
          repliegue: "1-3-3-1",
        },
      );
      const resized = await c.matchService.update(match.id, {
        tournamentId: null,
        format: 7,
      });
      assert(resized.phaseFormations);
      validatePhaseFormations(resized.phaseFormations, 7);
      // Upgrade an existing database, twice, without rebuilding business rows.
      const usersBefore = await db
        .prepare("SELECT id,email FROM users ORDER BY id")
        .all();
      if (pg) {
        await pg.execute("ALTER TABLE matches DROP COLUMN phase_formations");
        await pg.execute(
          "ALTER TABLE matches DROP COLUMN published_phase_formations",
        );
        await migratePostgres(pg);
        await migratePostgres(pg);
      } else {
        getDb().exec(
          "ALTER TABLE matches DROP COLUMN phase_formations; ALTER TABLE matches DROP COLUMN published_phase_formations",
        );
        migrate();
        migrate();
      }
      assert.deepEqual(
        await db.prepare("SELECT id,email FROM users ORDER BY id").all(),
        usersBefore,
      );
      assert.equal((await repository.findById(match.id)).phaseFormations, null);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      if (pg) {
        await pg.execute("DROP SCHEMA futapp CASCADE");
        await pg.close();
      }
    }
  });
