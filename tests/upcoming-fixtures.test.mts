import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { upcomingFixtures } from "../frontend/src/utils/upcoming-fixtures";
import type { CalendarMatch, MatchStatus } from "../frontend/src/types/api";

const fixture = (
  id: number,
  kickOff: string,
  status: MatchStatus = "programado",
) => ({ id, kickOff, status });
const now = Date.parse("2026-10-16T12:00:00Z");

test("the spotlight chooses the earliest confirmed future fixture across timezones, without repeating it or changing the input", () => {
  const matches = [
    fixture(1, "2026-10-16T18:00", "pospuesto"),
    fixture(2, "2026-10-17T18:00", "jugado"),
    fixture(3, "2026-10-18T08:00:00Z"),
    fixture(4, "2026-10-18T01:00"),
    fixture(5, "2026-10-15T18:00"),
    fixture(6, "invalid date"),
    fixture(7, "2026-10-17T18:00", "cancelado"),
  ];
  const original = structuredClone(matches);
  const { featured, remaining } = upcomingFixtures(matches, now);
  assert.equal(featured?.id, 4);
  assert(!remaining.some((match) => match.id === featured?.id));
  assert.deepEqual(
    remaining.map((match) => match.id),
    [3, 6, 1],
  );
  assert.deepEqual(matches, original);
});

test("overdue, postponed, undated and empty calendars retain usable access without inventing fixtures", () => {
  const overdue = [
    fixture(1, "2026-10-12T18:00"),
    fixture(2, "2026-10-13T18:00"),
  ];
  assert.equal(upcomingFixtures(overdue, now).featured, null);
  assert.equal(
    upcomingFixtures(
      [fixture(3, "invalid"), fixture(4, "2026-10-10T18:00", "pospuesto")],
      now,
    ).featured?.id,
    3,
  );
  assert.equal(
    upcomingFixtures([fixture(4, "2026-10-10T18:00", "pospuesto")], now)
      .featured?.id,
    4,
  );
  assert.deepEqual(upcomingFixtures([], now), {
    featured: null,
    remaining: [],
  });
  assert.equal(
    upcomingFixtures([fixture(9, "2026-10-18T18:00", "cancelado")], now)
      .featured,
    null,
  );
});

test("the match presentation keeps drafts and administrative actions private, uses the published F8 system and marks postponements without a false countdown", async (t) => {
  (globalThis as { React?: typeof React }).React = React;
  t.mock.method(Date, "now", () => now);
  const { AuthProvider } = await import("../frontend/src/context/AuthContext");
  const { SettingsProvider } = await import(
    "../frontend/src/context/SettingsContext"
  );
  const { NextMatchSpotlight } = await import(
    "../frontend/src/organisms/NextMatchSpotlight"
  );
  const match: CalendarMatch = {
    ...fixture(8, "2026-10-18T18:00"),
    opponent: "Rival <script>prueba</script>",
    competition: "Liga del equipo",
    venue: "Cancha del equipo",
    isHome: false,
    formation: "PRIVATE-DRAFT-SYSTEM",
    format: 8,
    minutes: 50,
    goalsFor: null,
    goalsAgainst: null,
    notes: null,
    createdAt: "2026-10-01",
    venueMap: {
      url: "https://www.google.com/maps?cid=123",
      embedUrl: "https://www.google.com/maps?cid=123&output=embed",
      directionsUrl: "https://www.google.com/maps?cid=123",
    },
  };
  const render = (value: CalendarMatch, mode: "player" | "admin") =>
    renderToStaticMarkup(
      React.createElement(MemoryRouter, {
        children: React.createElement(AuthProvider, {
          children: React.createElement(SettingsProvider, {
            children: React.createElement(NextMatchSpotlight, {
              match: value,
              mode,
              detailHref: (row) =>
                `/${mode === "admin" ? "admin" : "jugador"}/partidos/${row.id}`,
              onEdit: () => {},
              onDelete: () => {},
            }),
          }),
        }),
      }),
    );
  const draft = render(match, "player");
  assert(!draft.includes("PRIVATE-DRAFT-SYSTEM"));
  assert(!draft.includes("Eliminar partido"));
  assert(!draft.includes("Editar datos"));
  assert(draft.includes("Por publicar"));
  assert(draft.includes('href="/jugador/partidos/8"'));
  assert(!draft.includes("<script>"));
  assert(draft.includes("&lt;script&gt;"));
  assert(draft.includes('rel="noopener noreferrer"'));
  const published = render(
    {
      ...match,
      lineupPublishedAt: "2026-10-16T12:00:00Z",
      publishedFormation: "1-3-3-1",
    },
    "player",
  );
  assert(published.includes("1-3-3-1"));
  assert(!published.includes("PRIVATE-DRAFT-SYSTEM"));
  assert(published.includes("50"));
  assert(published.includes("8 jugadores por equipo"));
  const admin = render(match, "admin");
  assert(admin.includes("PRIVATE-DRAFT-SYSTEM"));
  assert(admin.includes("Editar datos"));
  assert(admin.includes("Eliminar partido"));
  const postponed = render({ ...match, status: "pospuesto" }, "player");
  assert(postponed.includes("Fecha por reprogramar"));
  assert(!postponed.includes('role="timer"'));
  assert(!postponed.includes("<time"));
});
