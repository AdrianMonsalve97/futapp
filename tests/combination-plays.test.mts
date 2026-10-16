import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildPlays } from "../backend/src/domain/coaching";
import { formationsFor, getFormation } from "../backend/src/domain/formations";
import { TacticalPlayPicker } from "../frontend/src/molecules/TacticalPlayPicker";

const lineup = (key = "1-3-3-1", format: 5 | 7 | 8 | 11 = 8) =>
  getFormation(key, format).slots.map((slot) => ({
    ...slot,
    playerId: slot.slotIndex + 10,
    playerName: `Compañero ${slot.slotIndex}`,
  }));

test("the expanded library adapts to every real formation and style without inventing players or mutating selections", () => {
  for (const format of [5, 7, 8, 11] as const)
    for (const formation of formationsFor(format))
      for (const style of ["equilibrado", "ofensivo", "defensivo"] as const) {
        const slots = lineup(formation.key, format),
          original = structuredClone(slots);
        const plays = buildPlays(slots, style),
          positions = new Set(slots.map((slot) => slot.slotIndex));
        assert.equal(plays.length, 12, `${format}/${formation.key}`);
        assert.equal(new Set(plays.map((play) => play.id)).size, plays.length);
        assert.deepEqual(
          new Set(plays.map((play) => play.category)),
          new Set(["salida", "asociacion", "finalizacion", "recuperacion"]),
        );
        for (const play of plays) {
          assert(
            play.route.length >= 3 && new Set(play.route).size >= 3,
            play.id,
          );
          assert(
            play.route.every(
              (index, step) =>
                positions.has(index) &&
                (step === 0 || index !== play.route[step - 1]),
            ),
            play.id,
          );
          assert(play.steps.length >= 3);
          assert(!JSON.stringify(play).includes("undefined"));
          assert.equal(
            new URL(play.source.url).hostname,
            "www.fifatrainingcentre.com",
          );
          assert.equal(new URL(play.source.url).protocol, "https:");
        }
        assert.deepEqual(slots, original);
        assert.deepEqual(
          buildPlays([...slots].reverse(), style),
          plays,
          "database row order must not change the exercise",
        );
      }
});

test("F8 short combinations preserve the wall return, third-player layoff and actual goalkeeper reset", () => {
  const slots = lineup(),
    plays = buildPlays(slots, "equilibrado");
  const route = (id: string) => plays.find((play) => play.id === id)!.route;
  assert.deepEqual(route("pared"), [4, 5, 4, 7]);
  assert.deepEqual(route("tercer-hombre"), [1, 7, 5, 6]);
  assert.deepEqual(route("pausa-giro"), [5, 4, 5, 6, 7]);
  assert.deepEqual(route("reinicio"), [5, 4, 5, 0, 3, 5]);
  assert.equal(
    slots.find((slot) => slot.slotIndex === route("reinicio")[3])!.role,
    "POR",
  );
  assert(
    plays
      .find((play) => play.id === "falso-nueve")!
      .coaching.includes("fuera de juego"),
  );
  const defensive = buildPlays(slots, "defensivo");
  assert(
    defensive
      .find((play) => play.id === "pared")!
      .coaching.includes("apoyo del portero"),
  );
  assert(defensive.some((play) => play.id === "transicion"));
  assert(buildPlays(slots, "ofensivo").some((play) => play.id === "presion"));
});

test("vacancies remain practice positions and an incomplete formation cannot manufacture a valid eleven", () => {
  const slots = lineup().map((slot) => ({
    ...slot,
    playerId: null,
    playerName: null,
  }));
  const plays = buildPlays(slots, "equilibrado");
  assert.equal(plays.length, 12);
  assert(
    plays.every((play) =>
      play.steps.some((step) => step.includes("puesto vacante")),
    ),
  );
  assert.deepEqual(buildPlays([], "equilibrado"), []);
  assert.deepEqual(
    buildPlays(
      slots.filter((slot) => slot.role !== "POR"),
      "equilibrado",
    ),
    [],
  );
  assert.deepEqual(
    buildPlays(
      slots.filter((slot) => slot.role !== "DEL"),
      "equilibrado",
    ),
    [],
  );
});

test("the shared picker groups the full library, retains the selected wall and does not expand into twelve buttons", () => {
  (globalThis as any).React = React;
  const html = renderToStaticMarkup(
    React.createElement(TacticalPlayPicker, {
      plays: buildPlays(lineup(), "equilibrado"),
      selectedId: "pared",
      onSelect: () => {},
    }),
  );
  assert.equal((html.match(/<optgroup /g) ?? []).length, 4);
  assert.equal((html.match(/<option /g) ?? []).length, 12);
  assert.match(html, /<option value="pared" selected="">/);
  assert(
    html.includes("Salida y portero") &&
      html.includes("Asociación y posesión") &&
      html.includes("Llegada y finalización") &&
      html.includes("Recuperación y transiciones"),
  );
  assert(!html.includes("<button"));
  assert(
    html.includes("Inspiración Fàbregas") &&
      html.includes('rel="noopener noreferrer"'),
  );
});
