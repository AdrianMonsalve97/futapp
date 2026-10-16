import type { Match } from "./entities";

export interface LeagueRules {
  win: number;
  draw: number;
  loss: number;
  tiebreak: "difference" | "goals";
}
export interface LeagueResult {
  id: string;
  matchday: number;
  home: string;
  away: string;
  homeGoals: number | null;
  awayGoals: number | null;
  status: "programado" | "jugado" | "pospuesto" | "cancelado";
}
export interface LeagueConfig {
  version: number;
  teams: string[];
  rules: LeagueRules;
  results: LeagueResult[];
  matchRounds: Record<string, number>;
}
export interface Standing {
  position: number;
  name: string;
  club: boolean;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  difference: number;
  points: number;
  form: ("V" | "E" | "D")[];
}
export interface LeagueView {
  config: LeagueConfig;
  rows: Standing[];
  results: (LeagueResult & { source: "club" | "league"; matchId?: number })[];
  counted: number;
  missingScores: number;
  provisional: true;
}
export const defaultLeague = (): LeagueConfig => ({
  version: 0,
  teams: [],
  rules: { win: 3, draw: 1, loss: 0, tiebreak: "difference" },
  results: [],
  matchRounds: {},
});
export const teamKey = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ")
    .trim();
export const validScore = (score: unknown): score is number =>
  Number.isInteger(score) && Number(score) >= 0 && Number(score) <= 99;

/** Derived on each read: editing/cancelling/deleting a fixture never leaves cached points behind. */
export function calculateLeague(
  config: LeagueConfig,
  matches: Match[],
  clubName: string,
): LeagueView {
  const table = new Map<string, Standing>();
  const add = (name: string, club = false) => {
    const key = teamKey(name);
    if (!table.has(key))
      table.set(key, {
        position: 0,
        name,
        club,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        difference: 0,
        points: 0,
        form: [],
      });
    return table.get(key)!;
  };
  add(clubName, true);
  config.teams.forEach((name) => add(name));
  const results: LeagueView["results"] = [
    ...matches.map((match) => ({
      id: `club-${match.id}`,
      matchId: match.id,
      source: "club" as const,
      matchday: config.matchRounds[String(match.id)] ?? 0,
      home: match.isHome ? clubName : match.opponent,
      away: match.isHome ? match.opponent : clubName,
      homeGoals: match.isHome ? match.goalsFor : match.goalsAgainst,
      awayGoals: match.isHome ? match.goalsAgainst : match.goalsFor,
      status: match.status,
    })),
    ...config.results.map((result) => ({
      ...result,
      source: "league" as const,
    })),
  ];
  let counted = 0,
    missingScores = 0;
  for (const result of [...results].sort(
    (a, b) =>
      a.matchday - b.matchday ||
      a.id.localeCompare(b.id, "es", { numeric: true }),
  )) {
    const home = add(result.home),
      away = add(result.away);
    if (home === away || result.status !== "jugado") continue;
    if (!validScore(result.homeGoals) || !validScore(result.awayGoals)) {
      missingScores++;
      continue;
    }
    counted++;
    const hg = result.homeGoals,
      ag = result.awayGoals;
    home.played++;
    away.played++;
    home.goalsFor += hg;
    home.goalsAgainst += ag;
    away.goalsFor += ag;
    away.goalsAgainst += hg;
    if (hg === ag) {
      home.drawn++;
      away.drawn++;
      home.points += config.rules.draw;
      away.points += config.rules.draw;
      home.form.push("E");
      away.form.push("E");
    } else {
      const winner = hg > ag ? home : away,
        loser = hg > ag ? away : home;
      winner.won++;
      loser.lost++;
      winner.points += config.rules.win;
      loser.points += config.rules.loss;
      winner.form.push("V");
      loser.form.push("D");
    }
  }
  const rows = [...table.values()];
  rows.forEach((row) => {
    row.difference = row.goalsFor - row.goalsAgainst;
    row.form = row.form.slice(-5);
  });
  const compare = (a: Standing, b: Standing) =>
    b.points - a.points ||
    (config.rules.tiebreak === "difference"
      ? b.difference - a.difference || b.goalsFor - a.goalsFor
      : b.goalsFor - a.goalsFor || b.difference - a.difference);
  rows.sort((a, b) => compare(a, b) || a.name.localeCompare(b.name, "es"));
  rows.forEach((row, index) => {
    row.position =
      index > 0 && compare(rows[index - 1], row) === 0
        ? rows[index - 1].position
        : index + 1;
  });
  return {
    config,
    rows,
    results: results.sort((a, b) => b.matchday - a.matchday),
    counted,
    missingScores,
    provisional: true,
  };
}
