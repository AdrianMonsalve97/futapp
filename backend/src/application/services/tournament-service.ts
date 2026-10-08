import type { TournamentPort } from '../ports/in/tournament.port';
import type { TournamentInput, TournamentRepository } from '../ports/out/tournament.repository';
import type { Tournament, TournamentRoster } from '../../domain/tournament';
import type { PlayerRepository } from '../ports/out/player.repository';
import type { MatchRepository } from '../ports/out/match.repository';
import type { UnitOfWork } from '../ports/out/unit-of-work';
import { NotFoundError, ValidationError } from '../../domain/errors';
import { formationsFor } from '../../domain/formations';
import { isTeamFormat } from '../../domain/formats';

export class TournamentService implements TournamentPort {
  constructor(private readonly tournaments: TournamentRepository, private readonly players: PlayerRepository,
    private readonly matches: MatchRepository, private readonly uow: UnitOfWork) {}
  async roster(id: number, admin: boolean, userId: number): Promise<TournamentRoster> {
    (await this.get(id, admin));
    return { players: (await this.tournaments.roster(id)), myPlayerId: (await this.players.findByUserId(userId))?.id ?? null };
  }
  async addPlayers(id: number, playerIds: number[]): Promise<void> {
    (await this.uow.run(async () => {
            (await this.get(id, true));
            if (!Array.isArray(playerIds) || !playerIds.length || playerIds.length > 100 ||
              playerIds.some(id => !Number.isSafeInteger(id) || id <= 0) || new Set(playerIds).size !== playerIds.length) {
              throw new ValidationError('Selecciona entre 1 y 100 jugadores distintos');
            }
            for (const playerId of playerIds) {
              const row = (await this.players.findWithUser(playerId));
              if (!row) throw new NotFoundError(`El jugador ${playerId} no existe`);
              if (!row.user.active) throw new ValidationError(`${row.user.fullName} está inactivo`);
            }
            (await this.tournaments.addPlayers(id, playerIds));
          }));
  }
  async removePlayer(id: number, playerId: number): Promise<void> {
    (await this.uow.run(async () => {
            (await this.get(id, true));
            (await this.tournaments.removePlayer(id, playerId));
            for (const match of (await this.matches.list()).filter(m => m.tournamentId === id && ['programado', 'pospuesto'].includes(m.status))) {
              const draft = (await this.matches.getLineup(match.id));
              if (draft.some(slot => slot.playerId === playerId)) {
                (await this.matches.replaceLineup(match.id, draft.map(slot => ({ ...slot, playerId: slot.playerId === playerId ? null : slot.playerId }))));
              }
              if ((await this.matches.getPublishedLineup(match.id)).some(slot => slot.playerId === playerId)) (await this.matches.unpublishLineup(match.id));
            }
          }));
  }
  async list(admin: boolean): Promise<Tournament[]> { return (await this.tournaments.list()).filter(row => admin || row.status !== 'borrador'); }
  async get(id: number, admin: boolean): Promise<Tournament> {
    const row = (await this.tournaments.find(id));
    if (!row || (!admin && row.status === 'borrador')) throw new NotFoundError('Torneo no encontrado');
    return row;
  }
  async save(id: number | null, input: TournamentInput): Promise<Tournament> {
    if (id !== null) (await this.get(id, true));
    const rules = input.rules;
    if (!input.name?.trim() || !input.leagueName?.trim() || !input.season?.trim()) throw new ValidationError('Nombre, liga y temporada son obligatorios');
    if (!rules || !isTeamFormat(rules.format)) throw new ValidationError('Formato de torneo inválido');
    if (!Number.isInteger(rules.periods) || rules.periods < 1 || rules.periods > 4 || !Number.isInteger(rules.minutesPerPeriod) || rules.minutesPerPeriod < 1 || rules.periods * rules.minutesPerPeriod > 400) throw new ValidationError('Indica tiempos y minutos válidos, con duración total de hasta 400 minutos');
    if (rules.maxSquad !== null && (!Number.isInteger(rules.maxSquad) || rules.maxSquad < rules.format || rules.maxSquad > 50)) throw new ValidationError('La convocatoria debe admitir al menos los jugadores en cancha');
    const allowed = formationsFor(rules.format).map(row => row.key);
    if (!rules.allowedFormations.length || new Set(rules.allowedFormations).size !== rules.allowedFormations.length || rules.allowedFormations.some(key => !allowed.includes(key))) throw new ValidationError('Selecciona formaciones válidas para el formato del torneo');
    return (await this.tournaments.save(id, input));
  }
}
