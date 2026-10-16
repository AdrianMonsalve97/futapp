import type { TournamentPort } from "../ports/in/tournament.port";
import type {
  TournamentInput,
  TournamentRepository,
} from "../ports/out/tournament.repository";
import type { Tournament, TournamentRoster } from "../../domain/tournament";
import type { PlayerRepository } from "../ports/out/player.repository";
import type { MatchRepository } from "../ports/out/match.repository";
import type { UnitOfWork } from "../ports/out/unit-of-work";
import { AppError, NotFoundError, ValidationError } from "../../domain/errors";
import {
  calculateLeague,
  teamKey,
  validScore,
  type LeagueConfig,
  type LeagueView,
} from "../../domain/standings";
import type { LeagueRepository } from "../ports/out/league.repository";
import type { SettingsRepository } from "../ports/out/settings.repository";
import { formationsFor } from "../../domain/formations";
import { isTeamFormat } from "../../domain/formats";

export class TournamentService implements TournamentPort {
  constructor(
    private readonly tournaments: TournamentRepository,
    private readonly players: PlayerRepository,
    private readonly matches: MatchRepository,
    private readonly uow: UnitOfWork,
    private readonly leagues: LeagueRepository,
    private readonly settings: SettingsRepository,
  ) {}
  async standings(id: number, admin: boolean): Promise<LeagueView> {
    await this.get(id, admin);
    const matches = (await this.matches.list()).filter(
        (match) => match.tournamentId === id,
      ),
      config = await this.leagues.get(id);
    // Deleted or moved fixtures must not leave an uneditable round assignment.
    config.matchRounds = Object.fromEntries(
      Object.entries(config.matchRounds).filter(([key]) =>
        matches.some((match) => String(match.id) === key),
      ),
    );
    return calculateLeague(
      config,
      matches,
      (await this.settings.get()).teamName,
    );
  }
  async saveStandings(id: number, input: LeagueConfig): Promise<LeagueView> {
    return this.uow.run(async () => {
      await this.get(id, true);
      if (
        !input ||
        !Number.isSafeInteger(input.version) ||
        input.version < 0 ||
        !Array.isArray(input.teams) ||
        input.teams.length > 100 ||
        !Array.isArray(input.results) ||
        input.results.length > 2000 ||
        !input.rules ||
        !input.matchRounds ||
        typeof input.matchRounds !== "object" ||
        Array.isArray(input.matchRounds)
      )
        throw new ValidationError("Configuración de clasificación inválida");
      const old = await this.leagues.get(id);
      if (old.version !== input.version)
        throw new AppError(
          "La clasificación cambió en otra sesión. Recarga antes de guardar.",
          409,
        );
      const { win, draw, loss, tiebreak } = input.rules;
      if (
        [win, draw, loss].some(
          (value) => !Number.isInteger(value) || value < 0 || value > 20,
        ) ||
        !["difference", "goals"].includes(tiebreak)
      )
        throw new ValidationError(
          "Indica puntos entre 0 y 20 y un criterio de desempate válido",
        );
      const club = teamKey((await this.settings.get()).teamName);
      const validName = (value: unknown): value is string =>
        typeof value === "string" &&
        value.trim().length > 0 &&
        value.trim().length <= 100 &&
        !/[\u0000-\u001f]/.test(value);
      if (
        input.teams.some(
          (name) => !validName(name) || teamKey(name) === club,
        ) ||
        new Set(input.teams.map(teamKey)).size !== input.teams.length
      )
        throw new ValidationError(
          "Usa nombres de equipos distintos; tu club se agrega automáticamente",
        );
      const teams = input.teams.map((name) => name.trim().replace(/\s+/g, " "));
      const allMatches = (await this.matches.list()).filter(
        (match) => match.tournamentId === id,
      );
      const allowedTeams = new Set(
        [...teams, ...allMatches.map((match) => match.opponent)].map(teamKey),
      );
      const ids = new Set<string>(),
        fixtures = new Set<string>();
      const results = input.results.map((row) => {
        if (
          !row ||
          typeof row.id !== "string" ||
          !/^[a-zA-Z0-9_-]{1,80}$/.test(row.id) ||
          ids.has(row.id) ||
          !Number.isInteger(row.matchday) ||
          row.matchday < 1 ||
          row.matchday > 1000 ||
          !validName(row.home) ||
          !validName(row.away) ||
          teamKey(row.home) === teamKey(row.away) ||
          !["programado", "jugado", "pospuesto", "cancelado"].includes(
            row.status,
          )
        )
          throw new ValidationError(
            "Revisa la jornada, los equipos y el estado de cada encuentro",
          );
        const home = teamKey(row.home),
          away = teamKey(row.away);
        if (home === club || away === club)
          throw new ValidationError(
            "Los resultados de tu club se registran en Partidos para evitar contarlos dos veces",
          );
        if (!allowedTeams.has(home) || !allowedTeams.has(away))
          throw new ValidationError("Agrega primero los equipos participantes");
        if (
          (row.homeGoals !== null && !validScore(row.homeGoals)) ||
          (row.awayGoals !== null && !validScore(row.awayGoals)) ||
          (row.status === "jugado" &&
            (!validScore(row.homeGoals) || !validScore(row.awayGoals)))
        )
          throw new ValidationError(
            "Un resultado jugado necesita ambos marcadores enteros entre 0 y 99",
          );
        const key = JSON.stringify([row.matchday, ...[home, away].sort()]);
        if (fixtures.has(key))
          throw new ValidationError(
            "Ese encuentro ya está registrado en la jornada",
          );
        fixtures.add(key);
        ids.add(row.id);
        return {
          id: row.id,
          matchday: row.matchday,
          home: row.home.trim(),
          away: row.away.trim(),
          homeGoals: row.homeGoals,
          awayGoals: row.awayGoals,
          status: row.status,
        };
      });
      const matchRounds: Record<string, number> = {};
      for (const [matchId, round] of Object.entries(input.matchRounds)) {
        if (
          !allMatches.some((match) => String(match.id) === matchId) ||
          !Number.isInteger(round) ||
          round < 1 ||
          round > 1000
        )
          throw new ValidationError(
            "Asigna una jornada válida a un partido de este torneo",
          );
        matchRounds[matchId] = round;
      }
      await this.leagues.save(id, {
        version: input.version,
        teams,
        results,
        matchRounds,
        rules: { win, draw, loss, tiebreak },
      });
      return this.standings(id, true);
    });
  }
  async roster(
    id: number,
    admin: boolean,
    userId: number,
  ): Promise<TournamentRoster> {
    await this.get(id, admin);
    return {
      players: await this.tournaments.roster(id),
      myPlayerId: (await this.players.findByUserId(userId))?.id ?? null,
    };
  }
  async addPlayers(id: number, playerIds: number[]): Promise<void> {
    await this.uow.run(async () => {
      await this.get(id, true);
      if (
        !Array.isArray(playerIds) ||
        !playerIds.length ||
        playerIds.length > 100 ||
        playerIds.some((id) => !Number.isSafeInteger(id) || id <= 0) ||
        new Set(playerIds).size !== playerIds.length
      ) {
        throw new ValidationError(
          "Selecciona entre 1 y 100 jugadores distintos",
        );
      }
      for (const playerId of playerIds) {
        const row = await this.players.findWithUser(playerId);
        if (!row) throw new NotFoundError(`El jugador ${playerId} no existe`);
        if (!row.user.active)
          throw new ValidationError(`${row.user.fullName} está inactivo`);
      }
      await this.tournaments.addPlayers(id, playerIds);
    });
  }
  async removePlayer(id: number, playerId: number): Promise<void> {
    await this.uow.run(async () => {
      await this.get(id, true);
      await this.tournaments.removePlayer(id, playerId);
      for (const match of (await this.matches.list()).filter(
        (m) =>
          m.tournamentId === id &&
          ["programado", "pospuesto"].includes(m.status),
      )) {
        const draft = await this.matches.getLineup(match.id);
        if (draft.some((slot) => slot.playerId === playerId)) {
          await this.matches.replaceLineup(
            match.id,
            draft.map((slot) => ({
              ...slot,
              playerId: slot.playerId === playerId ? null : slot.playerId,
            })),
          );
        }
        if (
          (await this.matches.getPublishedLineup(match.id)).some(
            (slot) => slot.playerId === playerId,
          )
        )
          await this.matches.unpublishLineup(match.id);
      }
    });
  }
  async list(admin: boolean): Promise<Tournament[]> {
    return (await this.tournaments.list()).filter(
      (row) => admin || row.status !== "borrador",
    );
  }
  async get(id: number, admin: boolean): Promise<Tournament> {
    const row = await this.tournaments.find(id);
    if (!row || (!admin && row.status === "borrador"))
      throw new NotFoundError("Torneo no encontrado");
    return row;
  }
  async save(id: number | null, input: TournamentInput): Promise<Tournament> {
    if (id !== null) await this.get(id, true);
    const rules = input.rules;
    if (
      !input.name?.trim() ||
      !input.leagueName?.trim() ||
      !input.season?.trim()
    )
      throw new ValidationError("Nombre, liga y temporada son obligatorios");
    if (!rules || !isTeamFormat(rules.format))
      throw new ValidationError("Formato de torneo inválido");
    if (
      !Number.isInteger(rules.periods) ||
      rules.periods < 1 ||
      rules.periods > 4 ||
      !Number.isInteger(rules.minutesPerPeriod) ||
      rules.minutesPerPeriod < 1 ||
      rules.periods * rules.minutesPerPeriod > 400
    )
      throw new ValidationError(
        "Indica tiempos y minutos válidos, con duración total de hasta 400 minutos",
      );
    if (
      rules.maxSquad !== null &&
      (!Number.isInteger(rules.maxSquad) ||
        rules.maxSquad < rules.format ||
        rules.maxSquad > 50)
    )
      throw new ValidationError(
        "La convocatoria debe admitir al menos los jugadores en cancha",
      );
    const allowed = formationsFor(rules.format).map((row) => row.key);
    if (
      !rules.allowedFormations.length ||
      new Set(rules.allowedFormations).size !==
        rules.allowedFormations.length ||
      rules.allowedFormations.some((key) => !allowed.includes(key))
    )
      throw new ValidationError(
        "Selecciona formaciones válidas para el formato del torneo",
      );
    return await this.tournaments.save(id, input);
  }
}
