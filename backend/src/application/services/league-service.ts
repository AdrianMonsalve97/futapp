import type { TournamentRepository } from "../ports/out/tournament.repository";
import type { MatchRepository } from "../ports/out/match.repository";
import type { LeagueRepository } from "../ports/out/league.repository";
import type { SettingsRepository } from "../ports/out/settings.repository";
import type { UnitOfWork } from "../ports/out/unit-of-work";
import type { LeaguePort } from "../ports/in/league.port";
import { AppError, NotFoundError } from "../../domain/errors";
import {
  calculateLeague,
  type LeagueConfig,
  type LeagueView,
} from "../../domain/standings";
import { normalizeLeagueConfig } from "../../domain/league-config";

export class LeagueService implements LeaguePort {
  constructor(
    private readonly tournaments: TournamentRepository,
    private readonly matches: MatchRepository,
    private readonly leagues: LeagueRepository,
    private readonly settings: SettingsRepository,
    private readonly uow: UnitOfWork,
  ) {}
  private async requireTournament(id: number, admin: boolean): Promise<void> {
    const tournament = await this.tournaments.find(id);
    if (!tournament || (!admin && tournament.status === "borrador"))
      throw new NotFoundError("Torneo no encontrado");
  }
  async get(id: number, admin: boolean): Promise<LeagueView> {
    await this.requireTournament(id, admin);
    const matches = (await this.matches.list()).filter(
        (match) => match.tournamentId === id,
      ),
      config = await this.leagues.get(id);
    const ids = new Set(matches.map((match) => String(match.id)));
    config.matchRounds = Object.fromEntries(
      Object.entries(config.matchRounds).filter(([matchId]) =>
        ids.has(matchId),
      ),
    );
    return calculateLeague(
      config,
      matches,
      (await this.settings.get()).teamName,
    );
  }
  async save(id: number, input: LeagueConfig): Promise<LeagueView> {
    return this.uow.run(async () => {
      await this.requireTournament(id, true);
      const matches = (await this.matches.list()).filter(
        (match) => match.tournamentId === id,
      );
      const config = normalizeLeagueConfig(
        input,
        (await this.settings.get()).teamName,
        matches,
      );
      const current = await this.leagues.get(id);
      if (current.version !== config.version)
        throw new AppError(
          "La clasificación cambió en otra sesión. Recarga antes de guardar.",
          409,
        );
      await this.leagues.save(id, config);
      return this.get(id, true);
    });
  }
}
