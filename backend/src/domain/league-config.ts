import type { Match } from "./entities";
import { ValidationError } from "./errors";
import {
  teamKey,
  validScore,
  type LeagueConfig,
  type LeagueResult,
  type LeagueRules,
} from "./standings";

function assertValid(condition: boolean, message: string): asserts condition {
  if (!condition) throw new ValidationError(message);
}
const validName = (name: unknown): name is string =>
  typeof name === "string" &&
  name.trim().length > 0 &&
  name.trim().length <= 100 &&
  !/[\u0000-\u001f]/.test(name);

function normalizeRules(rules: LeagueRules): LeagueRules {
  const { win, draw, loss, tiebreak } = rules;
  assertValid(
    [win, draw, loss].every(
      (value) => Number.isInteger(value) && value >= 0 && value <= 20,
    ) && ["difference", "goals"].includes(tiebreak),
    "Indica puntos entre 0 y 20 y un criterio de desempate válido",
  );
  return { win, draw, loss, tiebreak };
}

function normalizeTeams(teams: string[], club: string): string[] {
  assertValid(
    teams.every((name) => validName(name) && teamKey(name) !== club) &&
      new Set(teams.map(teamKey)).size === teams.length,
    "Usa nombres de equipos distintos; tu club se agrega automáticamente",
  );
  return teams.map((name) => name.trim().replace(/\s+/g, " "));
}

function normalizeResults(
  results: LeagueResult[],
  allowedTeams: Set<string>,
  club: string,
): LeagueResult[] {
  const ids = new Set<string>(),
    fixtures = new Set<string>();
  return results.map((result) => {
    assertValid(
      !!result &&
        typeof result.id === "string" &&
        /^[a-zA-Z0-9_-]{1,80}$/.test(result.id) &&
        !ids.has(result.id) &&
        Number.isInteger(result.matchday) &&
        result.matchday >= 1 &&
        result.matchday <= 1000 &&
        validName(result.home) &&
        validName(result.away) &&
        ["programado", "jugado", "pospuesto", "cancelado"].includes(
          result.status,
        ),
      "Revisa la jornada, los equipos y el estado de cada encuentro",
    );
    const home = teamKey(result.home),
      away = teamKey(result.away);
    assertValid(
      home !== away,
      "Los equipos de un encuentro deben ser distintos",
    );
    assertValid(
      home !== club && away !== club,
      "Los resultados de tu club se registran en Partidos para evitar contarlos dos veces",
    );
    assertValid(
      allowedTeams.has(home) && allowedTeams.has(away),
      "Agrega primero los equipos participantes",
    );
    assertValid(
      (result.homeGoals === null || validScore(result.homeGoals)) &&
        (result.awayGoals === null || validScore(result.awayGoals)) &&
        (result.status !== "jugado" ||
          (validScore(result.homeGoals) && validScore(result.awayGoals))),
      "Un resultado jugado necesita ambos marcadores enteros entre 0 y 99",
    );
    const fixture = JSON.stringify([result.matchday, ...[home, away].sort()]);
    assertValid(
      !fixtures.has(fixture),
      "Ese encuentro ya está registrado en la jornada",
    );
    fixtures.add(fixture);
    ids.add(result.id);
    const { id, matchday, homeGoals, awayGoals, status } = result;
    return {
      id,
      matchday,
      home: result.home.trim(),
      away: result.away.trim(),
      homeGoals,
      awayGoals,
      status,
    };
  });
}

function normalizeMatchRounds(
  rounds: Record<string, number>,
  matches: Match[],
): Record<string, number> {
  const matchIds = new Set(matches.map((match) => String(match.id)));
  return Object.fromEntries(
    Object.entries(rounds).map(([id, round]) => {
      assertValid(
        matchIds.has(id) &&
          Number.isInteger(round) &&
          round >= 1 &&
          round <= 1000,
        "Asigna una jornada válida a un partido de este torneo",
      );
      return [id, round];
    }),
  );
}

/** Validated domain data only; it performs no I/O and discards presentation fields. */
export function normalizeLeagueConfig(
  input: LeagueConfig,
  clubName: string,
  matches: Match[],
): LeagueConfig {
  assertValid(
    !!input &&
      Number.isSafeInteger(input.version) &&
      input.version >= 0 &&
      Array.isArray(input.teams) &&
      input.teams.length <= 100 &&
      Array.isArray(input.results) &&
      input.results.length <= 2000 &&
      !!input.rules &&
      !!input.matchRounds &&
      typeof input.matchRounds === "object" &&
      !Array.isArray(input.matchRounds),
    "Configuración de clasificación inválida",
  );
  const club = teamKey(clubName),
    teams = normalizeTeams(input.teams, club);
  const allowedTeams = new Set(
    [...teams, ...matches.map((match) => match.opponent)].map(teamKey),
  );
  return {
    version: input.version,
    teams,
    rules: normalizeRules(input.rules),
    results: normalizeResults(input.results, allowedTeams, club),
    matchRounds: normalizeMatchRounds(input.matchRounds, matches),
  };
}
