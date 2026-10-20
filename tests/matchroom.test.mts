import {
  phaseSlots,
  resolvePhaseFormations,
} from "../backend/src/domain/tactical-phases";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatKickoffDate,
  kickoffTime,
  matchClock,
} from "../frontend/src/utils/match-clock";
import {
  tacticalLayout,
  TACTICAL_TILE_HEIGHT,
} from "../frontend/src/utils/tactical-board";
import { formationsFor } from "../frontend/src/data/formations";
import {
  assignLineupSlot,
  pitchSlotsFrom,
} from "../frontend/src/utils/lineup-slots";
import { MENU_BY_ROLE } from "../frontend/src/data/navigation";
import { squadParams, squadView } from "../frontend/src/utils/squad-navigation";

test("countdown interprets Colombian fixtures consistently and reaches zero without claiming a live match", () => {
  const kickoff = kickoffTime("2026-10-18T18:00");
  assert.equal(kickoff, Date.parse("2026-10-18T23:00:00Z"));
  assert.equal(kickoffTime("2026-10-18T18:00:00-05:00"), kickoff);
  const now = kickoff - (2 * 86400 + 3 * 3600 + 4 * 60 + 5) * 1000;
  assert.deepEqual(matchClock("2026-10-18T18:00", now), {
    kickoff,
    reached: false,
    days: 2,
    hours: 3,
    minutes: 4,
    seconds: 5,
  });
  assert.equal(matchClock("2026-10-18T18:00", kickoff)!.reached, true);
  assert.equal(matchClock("2026-10-18T18:00", kickoff + 10000)!.seconds, 0);
  assert.equal(matchClock("bad date", now), null);
  assert.equal(
    formatKickoffDate("2026-10-18T18:00", {
      hour: "2-digit",
      hourCycle: "h23",
    }),
    "18",
  );
  assert.equal(formatKickoffDate("bad date"), "Horario por confirmar");
  assert.equal(matchClock("2026-10-18T18:00", kickoff - 1)!.seconds, 1);
});

test("the complete compact field fits mobile and desktop without clipping or overlapping touch targets", () => {
  for (const format of [5, 7, 8, 11] as const)
    for (const formation of formationsFor(format))
      for (const phase of ["estructura", "ataque", "repliegue"] as const) {
        const slots = pitchSlotsFrom(formation.key, [], format),
          original = structuredClone(slots);
        for (const width of [224, 256, 320, 390, 768, 860]) {
          const layout = tacticalLayout(
            phase === "estructura"
              ? slots
              : phaseSlots(
                  slots,
                  resolvePhaseFormations(formation.key, format)[phase],
                  format,
                ),
            width,
          );
          assert.equal(layout.slots.length, format);
          assert.equal(
            layout.slots.filter((slot) => slot.role === "POR").length,
            1,
          );
          assert.deepEqual(
            slots,
            original,
            "display must not change saved positions",
          );
          assert(
            layout.height >= 320 && layout.height <= 450,
            "whole pitch uses a bounded height even for F11",
          );
          assert(
            layout.tileWidth >= 44 && layout.tileWidth <= 76,
            "touch targets stay usable without large cards",
          );
          for (const [index, slot] of layout.slots.entries()) {
            const x = (slot.left * width) / 100,
              y = (slot.top * layout.height) / 100;
            assert(
              x - layout.tileWidth / 2 >= 0 &&
                x + layout.tileWidth / 2 <= width,
              "no horizontal crop or scroll",
            );
            assert(
              y - TACTICAL_TILE_HEIGHT / 2 >= 0 &&
                y + TACTICAL_TILE_HEIGHT / 2 <= layout.height,
              "all rows remain visible",
            );
            for (const other of layout.slots.slice(index + 1)) {
              const dx = (Math.abs(slot.left - other.left) * width) / 100;
              const dy = (Math.abs(slot.top - other.top) * layout.height) / 100;
              assert(
                dx >= layout.tileWidth + 3.99 || dy >= TACTICAL_TILE_HEIGHT + 8,
                `${format} ${formation.key} ${phase} ${width}: ${slot.label}/${other.label} collide (${dx.toFixed(1)},${dy.toFixed(1)})`,
              );
            }
          }
        }
      }
});

test("moving players cannot duplicate them, retains dorsal zero and clears old portraits without changing saved slots", () => {
  const slots = pitchSlotsFrom("1-3-3-1", [], 8);
  const assigned = assignLineupSlot(slots, 0, {
    playerId: 42,
    playerName: "Portero",
    shirtNumber: 0,
    avatarUrl: "/api/media/portrait",
    playerPosition: "POR",
  });
  const moved = assignLineupSlot(assigned, 1, {
    playerId: 42,
    playerName: "Portero",
    shirtNumber: 0,
    avatarUrl: "/api/media/portrait",
    playerPosition: "POR",
  });
  assert.equal(moved.length, 8);
  assert.equal(moved.filter((slot) => slot.playerId === 42).length, 1);
  assert.equal(moved[1].shirtNumber, 0);
  assert.equal(moved[0].avatarUrl, null);
  assert.equal(assigned[0].playerId, 42);
  assert.equal(slots[0].playerId, null);
  assert.equal(assignLineupSlot(moved, 1, null)[1].playerName, null);
  assert.equal(assignLineupSlot(moved, 500, null), moved);
});

test("a single navigation inventory preserves all role destinations and primary routes without duplicates", () => {
  for (const role of ["admin", "player"] as const) {
    const base = role === "admin" ? "/admin" : "/jugador",
      items = MENU_BY_ROLE[role];
    assert.equal(new Set(items.map((item) => item.to)).size, items.length);
    for (const route of [
      "inicio",
      "plantilla",
      "partidos",
      "posiciones",
      "uniformes",
    ])
      assert(items.some((item) => item.to === `${base}/${route}`));
    assert(items.every((item) => item.to.startsWith(base + "/")));
    assert(!items.some((item) => item.to === `${base}/jugadores`));
  }
});

test("squad navigation restricts private management and preserves the tournament across section changes", () => {
  assert.equal(squadView("management", "admin"), "management");
  for (const role of ["player", undefined] as const) {
    assert.equal(squadView("management", role), "gallery");
    assert.equal(squadView("system", role), "system");
  }
  assert.equal(squadView("unknown", "admin"), "gallery");
  const original = new URLSearchParams("torneo=7&vista=system");
  const management = squadParams(original, "vista", "management");
  assert.equal(management.get("torneo"), "7");
  assert.equal(
    original.get("vista"),
    "system",
    "navigation must not mutate the previous entry",
  );
  const allClub = squadParams(management, "torneo", "");
  assert.equal(allClub.get("vista"), "management");
  assert.equal(allClub.has("torneo"), false);
  const gallery = squadParams(management, "vista", "");
  assert.equal(gallery.get("torneo"), "7");
  assert.equal(gallery.has("vista"), false);
});
