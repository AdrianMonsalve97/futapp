import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthProvider } from "../frontend/src/context/AuthContext";
import { TacticalField } from "../frontend/src/organisms/TacticalField";
import { TacticalPlayboard } from "../frontend/src/organisms/TacticalPlayboard";
import { TacticalBoard } from "../frontend/src/organisms/TacticalBoard";
import { tacticalLayout } from "../frontend/src/utils/tactical-board";
import {
  tacticalBallPoint,
  tacticalPlayPhase,
  tacticalRoute,
} from "../frontend/src/utils/tactical-play";
import { formationsFor } from "../frontend/src/data/formations";
import { pitchSlotsFrom } from "../frontend/src/utils/lineup-slots";
import { buildPlays } from "../backend/src/domain/coaching";

(globalThis as any).React = React;
const render = (element: React.ReactNode) =>
  renderToStaticMarkup(
    React.createElement(AuthProvider, { children: element }),
  );

test("actual coaching routes follow the shared perspective in every system, step and screen width", () => {
  for (const format of [5, 7, 8, 11] as const)
    for (const formation of formationsFor(format)) {
      const slots = pitchSlotsFrom(formation.key, [], format).map((slot) => ({
        ...slot,
        playerId: slot.slotIndex + 1,
      }));
      const original = structuredClone(slots);
      for (const style of ["equilibrado", "ofensivo", "defensivo"] as const)
        for (const play of buildPlays(slots, style)) {
          for (let step = 0; step < play.route.length; step++) {
            for (const fieldWidth of [224, 256, 320, 390, 768, 860]) {
              const layout = tacticalLayout(
                slots,
                tacticalPlayPhase(play.phase, step),
                fieldWidth,
              );
              const route = tacticalRoute(play.route, layout.slots);
              assert.deepEqual(
                route.map((slot) => slot.slotIndex),
                play.route,
              );
              const point = tacticalBallPoint(
                route[step],
                layout.tileWidth,
                fieldWidth,
              );
              const cardWidth = layout.tileWidth;
              assert.equal(point.top, route[step].top);
              assert(
                Math.abs(
                  ((point.left - route[step].left) * fieldWidth) / 100 -
                    cardWidth / 2 -
                    12,
                ) < 0.001,
                "ball stays 12px beside its receiver, while fitting the whole pitch",
              );
              assert(
                (point.left * fieldWidth) / 100 <= fieldWidth - 6 &&
                  point.left > 0,
                "ball remains inside the field",
              );
            }
          }
        }
      assert.deepEqual(
        slots,
        original,
        "replay must never change the official selection",
      );
    }
});

test("routes handle empty, missing and repeated positions without losing a return pass", () => {
  const slots = pitchSlotsFrom("1-3-3-1", [], 8);
  assert.deepEqual(
    tacticalRoute([0, 900, 1, 0], slots).map((slot) => slot.slotIndex),
    [0, 1, 0],
  );
  assert.deepEqual(tacticalRoute([900], slots), []);
  assert.deepEqual(tacticalRoute([], slots), []);
  assert.equal(tacticalPlayPhase("Transición", 0), "repliegue");
  assert.equal(tacticalPlayPhase("Transición", 1), "ataque");
  assert.equal(tacticalPlayPhase("Ataque organizado", 1), "ataque");
  assert.equal(tacticalPlayPhase("Sin balón", 1), "repliegue");
  assert.equal(tacticalPlayPhase("Balón parado", 1), "estructura");
});

test("formation and animated play share the exact field, portraits and eight positions", () => {
  const slots = pitchSlotsFrom("1-3-3-1", [], 8).map((slot) => ({
    ...slot,
    playerId: slot.slotIndex + 1,
    playerName: `Integrante ${slot.slotIndex}`,
    shirtNumber: slot.slotIndex,
    avatarUrl: "/brand/club-crest.webp",
    highlighted: slot.slotIndex === 0,
  }));
  const play = buildPlays(slots, "equilibrado")[0];
  const board = render(
    React.createElement(TacticalBoard, { slots, format: 8 }),
  );
  const replay = render(
    React.createElement(TacticalPlayboard, { slots, format: 8, play }),
  );
  for (const html of [board, replay]) {
    assert.equal((html.match(/class="fc-position"/g) ?? []).length, 8);
    assert.equal((html.match(/class="fc-position-photo"/g) ?? []).length, 8);
    assert.equal((html.match(/<img /g) ?? []).length, 8);
    assert.equal((html.match(/data-own="true"/g) ?? []).length, 1);
    assert(html.includes("dorsal 0"));
    assert(html.includes('d="M17 7H83L98 96H2Z"'));
    assert(html.includes('data-format="8"'));
    assert(!html.includes("formation-field"));
  }
  assert(replay.includes('class="fc-play-ball"'));
  assert(replay.includes('class="fc-play-route"'));
  assert(replay.includes('aria-current="step"'));
  assert(replay.includes("Reproducir jugada"));
  assert(replay.includes("Paso 1/4"));
});

test("role focus, support lines and replay arrows retain the same projected coordinates", () => {
  const slots = pitchSlotsFrom("1-3-3-1", [], 8).map((slot) => ({
    ...slot,
    playerId: slot.slotIndex + 1,
  }));
  const layout = tacticalLayout(slots, "repliegue");
  const route = [0, 1, 0];
  const points = tacticalRoute(route, layout.slots).map((slot) =>
    tacticalBallPoint(slot, layout.tileWidth, 320),
  );
  const html = render(
    React.createElement(TacticalField, {
      slots,
      format: 8,
      phase: "repliegue",
      focusRole: "POR",
      connections: true,
      playback: { route, step: 1 },
    }),
  );
  assert.equal((html.match(/class="fc-role-zone"/g) ?? []).length, 1);
  assert(html.includes('class="fc-support-line"'));
  assert(
    html.includes(
      `d="M${points[0].left} ${points[0].top}L${points[1].left} ${points[1].top}"`,
    ),
  );
  assert(html.includes(`left:${points[1].left}%;top:${points[1].top}%`));
  assert(html.includes('stroke-dasharray="1.2 1"'));
  assert(!html.includes("NaN"));
});

test("an unavailable route renders an explanation and no ball or enabled transport", () => {
  const slots = pitchSlotsFrom("1-3-3-1", [], 8).map((slot) => ({
    ...slot,
    playerId: slot.playerId ?? null,
  }));
  const play = { ...buildPlays(slots, "equilibrado")[0], route: [900] };
  const html = render(
    React.createElement(TacticalPlayboard, { slots, format: 8, play }),
  );
  assert(html.includes("Sin recorrido disponible"));
  assert(html.includes("no tiene posiciones válidas"));
  assert(!html.includes('class="fc-play-ball"'));
  assert(!html.includes("NaN"));
  assert.equal((html.match(/disabled=""/g) ?? []).length, 11);
});
