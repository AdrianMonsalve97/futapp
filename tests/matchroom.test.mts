import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatKickoffDate,
  kickoffTime,
  matchClock,
} from "../frontend/src/utils/match-clock";
import { tacticalLayout } from "../frontend/src/utils/tactical-board";
import { formationsFor } from "../frontend/src/data/formations";
import {
  assignLineupSlot,
  pitchSlotsFrom,
} from "../frontend/src/utils/lineup-slots";
import { MENU_BY_ROLE } from "../frontend/src/data/navigation";

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

test("every tactical system keeps exactly its format, a goalkeeper and readable touch targets in all phases", () => {
  for (const format of [5, 7, 8, 11] as const)
    for (const formation of formationsFor(format))
      for (const phase of ["estructura", "ataque", "repliegue"] as const) {
        const slots = pitchSlotsFrom(formation.key, [], format),
          original = structuredClone(slots),
          layout = tacticalLayout(slots, format, phase);
        assert.equal(layout.slots.length, format, formation.key);
        assert.equal(
          layout.slots.filter((slot) => slot.role === "POR").length,
          1,
        );
        assert.deepEqual(
          slots,
          original,
          "display projections must not change saved positions",
        );
        for (const width of [320, 390, 768, 1200]) {
          const fieldWidth = Math.max(width, layout.minWidth),
            fieldHeight = Math.max(fieldWidth / 1.65, layout.minHeight),
            tileWidth = Math.min(114, (fieldWidth * layout.tileWidth) / 100);
          assert(tileWidth >= 47.99, "touch targets must remain at least 48px");
          for (const [index, slot] of layout.slots.entries()) {
            assert((slot.left * fieldWidth) / 100 - tileWidth / 2 >= 0);
            assert(
              (slot.left * fieldWidth) / 100 + tileWidth / 2 <= fieldWidth,
            );
            for (const other of layout.slots.slice(index + 1)) {
              const dx = (Math.abs(slot.left - other.left) * fieldWidth) / 100,
                dy = (Math.abs(slot.top - other.top) * fieldHeight) / 100;
              assert(
                dx >= tileWidth + 2 || dy >= 56,
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
  }
});
