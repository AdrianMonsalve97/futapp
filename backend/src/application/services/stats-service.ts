import type { StatsPort } from '../ports/in/stats.port';
import type { StatsRepository } from '../ports/out/stats.repository';
import type { MatchStat, Position, TeamStats } from '../../domain/entities';
import { round2, summarizeStats } from './shared';

const POSITION_ORDER: Position[] = ['POR', 'DEF', 'MED', 'DEL'];
const TOP_LIMIT = 10;

interface PlayerAggregate {
  playerId: number;
  playerName: string;
  shirtNumber: number | null;
  position: Position | null;
  goals: number;
  assists: number;
  ratingSum: number;
  ratingCount: number;
}

function aggregateByPlayer(stats: MatchStat[]): PlayerAggregate[] {
  const map = new Map<number, PlayerAggregate>();
  for (const s of stats) {
    let entry = map.get(s.playerId);
    if (!entry) {
      entry = {
        playerId: s.playerId,
        playerName: s.playerName ?? `Jugador ${s.playerId}`,
        shirtNumber: s.shirtNumber ?? null,
        position: s.position ?? null,
        goals: 0,
        assists: 0,
        ratingSum: 0,
        ratingCount: 0,
      };
      map.set(s.playerId, entry);
    }
    entry.goals += s.goals;
    entry.assists += s.assists;
    entry.ratingSum += s.rating;
    entry.ratingCount += 1;
    if (s.shirtNumber !== undefined && s.shirtNumber !== null) entry.shirtNumber = s.shirtNumber;
    if (s.position) entry.position = s.position;
  }
  return [...map.values()];
}

export class StatsService implements StatsPort {
  constructor(private readonly stats: StatsRepository) {}

  async list(filter: { matchId?: number; playerId?: number } = {}): Promise<MatchStat[]> {
    return (await this.stats.list(filter));
  }

  async teamStats(): Promise<TeamStats> {
    const all = (await this.stats.listAll());
    const aggregates = aggregateByPlayer(all);

    const ranked = (pick: (entry: PlayerAggregate) => number) =>
      aggregates
        .map((entry) => ({
          playerId: entry.playerId,
          playerName: entry.playerName,
          shirtNumber: entry.shirtNumber,
          value: round2(pick(entry)),
        }))
        .filter((row) => row.value > 0)
        .sort((a, b) => b.value - a.value || a.playerName.localeCompare(b.playerName))
        .slice(0, TOP_LIMIT);

    const byPosition = POSITION_ORDER.map((position) => {
      const entries = aggregates.filter((entry) => entry.position === position);
      const ratings = all.filter((s) => s.position === position).map((s) => s.rating);
      if (entries.length === 0) return null;
      return {
        position,
        count: entries.length,
        avgRating: round2(ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0),
      };
    }).filter((row): row is { position: Position; count: number; avgRating: number } => row !== null);

    return {
      topScorers: ranked((e) => e.goals),
      topAssists: ranked((e) => e.assists),
      topRated: ranked((e) => (e.ratingCount > 0 ? e.ratingSum / e.ratingCount : 0)),
      byPosition,
      teamAverages: summarizeStats(all),
    };
  }
}
